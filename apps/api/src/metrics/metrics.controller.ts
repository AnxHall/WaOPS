import { Controller, Get, Param, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getPrisma } from '@waops/db';
import { requireTenantContext } from '@waops/tenancy';
import { RequirePermission } from '../auth/permissions.guard.js';
import { ApiError } from '../errors.js';

/**
 * Metric time-series read-model (HARD MISSION 03 — closes GAP-RM-001/002/004/008).
 * Tenant scope ALWAYS from TenantContext (JWT) — never from query params.
 * Uses Postgres date_bin over the Timescale hypertable (works with or without
 * Timescale extension); bucket count bounded to keep responses small.
 */

const QuerySchema = z.object({
  metric: z.string().min(1).max(128).optional(),
  from: z.coerce.number().int().min(0).optional(), // epoch ms
  to: z.coerce.number().int().min(0).optional(),
  buckets: z.coerce.number().int().min(1).max(200).optional(),
  mount: z.string().max(200).optional(), // filesystem dimension filter (GAP-RM-001)
  interface: z.string().max(200).optional(), // network dimension filter (GAP-RM-002)
});

const DEFAULT_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h
const DEFAULT_BUCKETS = 60;

const LongQuerySchema = z.object({
  metric: z.string().min(1).max(128).optional(),
  days: z.coerce.number().int().min(1).max(90).optional().default(7), // 7d/30d/…≤90d
  buckets: z.coerce.number().int().min(10).max(500).optional(),
});

interface SeriesPoint {
  t: string;
  avg: number;
  max: number;
  last: number;
}

@Controller('api/v1/hosts')
export class MetricsController {
  @Get(':id/metrics')
  @RequirePermission('hosts.read')
  async series(@Param('id') id: string, @Query() query: Record<string, unknown>): Promise<unknown> {
    const parsed = QuerySchema.safeParse(query);
    if (!parsed.success) {
      throw ApiError.validation('invalid metrics query', parsed.error.flatten());
    }
    const { metric, from, to, buckets: b, mount, interface: iface } = parsed.data;
    const tenantId = requireTenantContext().tenantId;
    const prisma = getPrisma();

    const host = await prisma.host.findFirst({ where: { id, tenantId } });
    if (!host) throw ApiError.notFound('Host');

    const resourceId = host.machineId ? `host_${host.machineId}` : host.id;
    const toMs = to ?? Date.now();
    const fromMs = from ?? toMs - DEFAULT_WINDOW_MS;
    if (fromMs >= toMs) throw ApiError.validation('from must be before to');
    const spanMs = toMs - fromMs;
    const buckets = b ?? Math.min(DEFAULT_BUCKETS, Math.max(10, Math.floor(spanMs / 60_000)));
    const bucketMs = Math.ceil(spanMs / buckets);

    const metricNames = metric
      ? [metric]
      : ['host.cpu.usage_percent', 'host.memory.used_bytes', 'host.memory.available_bytes', 'host.load.1', 'host.load.5', 'host.load.15', 'host.uptime_seconds'];

    // date_bin over observed_at; raw rows when bucket would be finer than data.
    // metricNames is an allowlist-derived array bound via Prisma.join (no injection).
    // Parameters appear only in value positions (Postgres cannot bind type names/
    // interval literals as parameters — hence make_interval / ::timestamptz casts).
    const rows = await prisma.$queryRaw<Array<{ metric: string; t: Date; avg: number; max: number; last: number }>>`
      WITH binned AS (
        SELECT
          metric,
          date_bin(make_interval(mins => ${Math.max(1, Math.round(bucketMs / 60_000))}::int), "observed_at", ${new Date(fromMs).toISOString()}::timestamptz) AS t,
          avg(value)::float8 AS avg,
          max(value)::float8 AS max,
          (array_agg(value ORDER BY "observed_at" DESC))[1]::float8 AS last
        FROM metric_samples
        WHERE tenant_id = ${tenantId}::uuid
          AND resource_id = ${resourceId}
          AND metric IN (${Prisma.join(metricNames)})
          AND "observed_at" >= ${new Date(fromMs).toISOString()}::timestamptz
          AND "observed_at" <= ${new Date(toMs).toISOString()}::timestamptz
          AND (${mount ?? null}::text IS NULL OR "dimensions_json"->>'mount' = ${mount ?? null})
          AND (${iface ?? null}::text IS NULL OR "dimensions_json"->>'interface' = ${iface ?? null})
        GROUP BY metric, t
      )
      SELECT metric, t, avg, max, last FROM binned ORDER BY metric ASC, t ASC`;

    const series: Record<string, SeriesPoint[]> = {};
    for (const r of rows) {
      (series[r.metric] ??= []).push({ t: new Date(r.t).toISOString(), avg: r.avg, max: r.max, last: r.last });
    }
    return {
      host_id: host.id,
      resource_id: resourceId,
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      bucket_ms: bucketMs,
      series,
    };
  }

  @Get(':id/containers')
  @RequirePermission('hosts.read')
  async containers(@Param('id') id: string): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    const prisma = getPrisma();
    const host = await prisma.host.findFirst({ where: { id, tenantId } });
    if (!host) throw ApiError.notFound('Host');
    const rows = await prisma.container.findMany({
      where: { tenantId, hostId: host.id },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
      select: { id: true, name: true, image: true, state: true, health: true, lastSeenAt: true },
    });
    return rows;
  }

  @Get(':id/filesystems')
  @RequirePermission('hosts.read')
  async filesystems(@Param('id') id: string): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    const prisma = getPrisma();
    const host = await prisma.host.findFirst({ where: { id, tenantId } });
    if (!host) throw ApiError.notFound('Host');
    const resourceId = host.machineId ? `host_${host.machineId}` : host.id;

    // Latest sample per mount (distinct on) from the last hour.
    const rows = await prisma.$queryRaw<Array<{ mount: string; used: number; available: number; observed_at: Date }>>`
      SELECT DISTINCT ON ("dimensions_json"->>'mount')
        "dimensions_json"->>'mount' AS mount,
        max(value) FILTER (WHERE metric = 'host.filesystem.used_bytes')::float8 AS used,
        max(value) FILTER (WHERE metric = 'host.filesystem.available_bytes')::float8 AS available,
        max("observed_at") AS observed_at
      FROM metric_samples
      WHERE tenant_id = ${tenantId}::uuid
        AND resource_id = ${resourceId}
        AND metric IN ('host.filesystem.used_bytes','host.filesystem.available_bytes')
        AND "observed_at" >= now() - interval '1 hour'
      GROUP BY "dimensions_json"->>'mount'
      ORDER BY "dimensions_json"->>'mount', "observed_at" DESC`;

    return {
      host_id: host.id,
      filesystems: rows.map((r) => ({
        mount: r.mount,
        used_bytes: r.used,
        available_bytes: r.available,
        observed_at: new Date(r.observed_at).toISOString(),
      })),
    };
  }

  /**
   * Long-window series (7d/30d) from the Timescale continuous aggregate
   * `metric_samples_5m` (ADR-009). Raw samples are retained 30d; the rollup
   * extends history to 365d. Falls back to an error hint if Timescale is absent.
   */
  @Get(':id/metrics/long')
  @RequirePermission('hosts.read')
  async longSeries(@Param('id') id: string, @Query() query: Record<string, unknown>): Promise<unknown> {
    const parsed = LongQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw ApiError.validation('invalid long-series query', parsed.error.flatten());
    }
    const { metric, days, buckets: b } = parsed.data;
    const tenantId = requireTenantContext().tenantId;
    const prisma = getPrisma();

    const host = await prisma.host.findFirst({ where: { id, tenantId } });
    if (!host) throw ApiError.notFound('Host');
    const resourceId = host.machineId ? `host_${host.machineId}` : host.id;

    const toMs = Date.now();
    const fromMs = toMs - days * 24 * 60 * 60 * 1000;

    const metricNames = metric ? [metric] : ['host.cpu.usage_percent', 'host.memory.used_bytes'];

    type RollupPoint = { metric: string; t: Date; avg: number; max: number; last: number };
    let rows: RollupPoint[];
    try {
      // CAgg provides avg/max per 5m bucket; 'last' is the newest bucket's avg.
      const raw = await prisma.$queryRaw<Array<{ metric: string; t: Date; avg: number; max: number }>>`
        SELECT metric, bucket AS t, avg::float8 AS avg, "max"::float8 AS max
        FROM metric_samples_5m
        WHERE tenant_id = ${tenantId}::uuid
          AND resource_id = ${resourceId}
          AND metric IN (${Prisma.join(metricNames)})
          AND bucket >= ${new Date(fromMs).toISOString()}::timestamptz
          AND bucket <= ${new Date(toMs).toISOString()}::timestamptz
        ORDER BY metric ASC, bucket ASC`;
      // reshape: per metric, the newest bucket's avg doubles as 'last' for all points
      const byMetric = new Map<string, Array<{ t: Date; avg: number; max: number }>>();
      for (const r of raw) {
        (byMetric.get(r.metric) ?? byMetric.set(r.metric, []).get(r.metric)!).push({ t: r.t, avg: r.avg, max: r.max });
      }
      rows = [];
      for (const [metric, pts] of byMetric) {
        const lastAvg = pts[pts.length - 1]?.avg ?? 0;
        for (const p of pts) rows.push({ metric, t: p.t, avg: p.avg, max: p.max, last: lastAvg });
      }
    } catch {
      throw new ApiError('dependency_unavailable', 'long-window rollup unavailable (Timescale aggregate missing)', 503);
    }

    // Downsample to the requested bucket count.
    const series: Record<string, Array<{ t: string; avg: number; max: number; last: number }>> = {};
    for (const r of rows) {
      (series[r.metric] ??= []).push({ t: new Date(r.t).toISOString(), avg: r.avg, max: r.max, last: r.last });
    }
    const downsampled: typeof series = {};
    for (const [m, pts] of Object.entries(series)) {
      const step = Math.max(1, Math.ceil(pts.length / (b ?? 288)));
      downsampled[m] = pts.filter((_, i) => i % step === 0);
    }

    return {
      host_id: host.id,
      resource_id: resourceId,
      window_days: days,
      source: 'metric_samples_5m (continuous aggregate)',
      series: downsampled,
    };
  }
}

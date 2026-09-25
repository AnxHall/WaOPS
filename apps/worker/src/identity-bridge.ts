import { getPrisma } from '@waops/db';
import { createLogger } from '@waops/observability';

/**
 * Identity bridge (HARD MISSION 03 — GAP-RM-003/005).
 * Bridges opaque agent resource ids (`host_<machineID>`) to real Host UUIDs:
 * - upserts a Host per (tenantId, machineId) — deterministic, idempotent;
 * - links the agent to its host (Agent.hostId / Agent.machineId);
 * - upserts Container inventory rows from container metrics dimensions.
 * Runs inside the ingest job (tenant from authenticated agent identity).
 */

const log = createLogger({ level: process.env.LOG_LEVEL ?? 'info', name: 'identity-bridge' });

type SampleLike = {
  metric: string;
  resource_id: string;
  observed_at: string;
  value: number;
  dimensions?: Record<string, unknown>;
};

function machineIdFromResource(resourceId: string): string | null {
  if (!resourceId.startsWith('host_')) return null;
  const id = resourceId.slice('host_'.length);
  return id.length >= 8 && id.length <= 128 ? id : null;
}

/**
 * Ensures a Host row exists for every `host_<machineId>` resource seen in the
 * batch and links the reporting agent to it. Cheap after first sighting
 * (upsert guarded by the unique index; errors swallowed to never drop telemetry).
 */
export async function bridgeIdentity(
  tenantId: string,
  agentId: string,
  samples: SampleLike[],
): Promise<Map<string, string>> {
  const prisma = getPrisma();
  const resourceToHost = new Map<string, string>();
  const machineIds = new Set<string>();
  for (const s of samples) {
    const mid = machineIdFromResource(s.resource_id);
    if (mid) machineIds.add(mid);
  }
  for (const machineId of machineIds) {
    const resourceId = `host_${machineId}`;
    try {
      const host = await prisma.host.upsert({
        where: { tenantId_machineId: { tenantId, machineId } },
        create: { tenantId, machineId, name: `host-${machineId.slice(0, 12)}`, status: 'online' },
        update: { status: 'online' },
      });
      resourceToHost.set(resourceId, host.id);
      await prisma.agent
        .updateMany({
          where: { id: agentId, tenantId },
          data: { hostId: host.id, machineId },
        })
        .catch(() => undefined);
    } catch (err) {
      log.warn({ err, machineId }, 'identity bridge upsert failed (telemetry kept)');
    }
  }
  return resourceToHost;
}

/**
 * Upserts container inventory rows from container.* metric dimensions.
 * Containers are reported in the same batch as their host's samples (agent
 * collects host + docker in one cycle), so they attach to the batch's host.
 */
export async function bridgeContainers(
  tenantId: string,
  samples: SampleLike[],
  resourceToHost: Map<string, string>,
): Promise<number> {
  const prisma = getPrisma();
  // The batch's host: all host_* samples in one agent batch belong to the same
  // physical machine — containers attach to it.
  const batchHostId = [...resourceToHost.values()][0] ?? null;
  if (!batchHostId) return 0;
  let upserts = 0;
  for (const s of samples) {
    if (!s.metric.startsWith('container.')) continue;
    const dims = (s.dimensions ?? {}) as { name?: unknown; image?: unknown };
    const runtimeId = s.resource_id.slice(0, 200);
    const name = typeof dims.name === 'string' && dims.name.length <= 200 ? dims.name : runtimeId;
    const image = typeof dims.image === 'string' && dims.image.length <= 200 ? dims.image : null;
    try {
      await prisma.container.upsert({
        where: { tenantId_hostId_runtimeId: { tenantId, hostId: batchHostId, runtimeId } },
        create: { tenantId, hostId: batchHostId, runtimeId, name, image, state: 'running', lastSeenAt: new Date(s.observed_at) },
        update: { lastSeenAt: new Date(s.observed_at), state: 'running', name, ...(image ? { image } : {}) },
      });
      upserts++;
    } catch {
      // never block telemetry on inventory issues
    }
  }
  return upserts;
}

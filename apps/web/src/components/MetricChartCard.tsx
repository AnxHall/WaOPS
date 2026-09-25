'use client';

/**
 * MetricChartCard — gráfico de série temporal canônico (designer.md §5):
 * SVG puro (sem nova dependência), grid horizontal dashed, série 2px com
 * área gradiente 12%→0%, tooltip nativo via <title>, unidades corretas.
 * Estados: loading / empty (sem samples) / normal — nunca mock.
 */
import { Skeleton } from './states';

export interface SeriesPoint {
  t: string;
  avg: number;
  max: number;
  last: number;
}

export type SeriesMap = Record<string, SeriesPoint[]>;

export function formatBytes(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let u = 0;
  let n = v;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n >= 100 ? n.toFixed(0) : n.toFixed(1)} ${units[u]}`;
}

export function formatPercent(v: number): string {
  return `${v.toFixed(1)} %`;
}

export function formatCount(v: number): string {
  return v >= 100 ? v.toFixed(0) : v.toFixed(2);
}

export type UnitKind = 'bytes' | 'percent' | 'count';

export function unitFormatter(kind: UnitKind): (v: number) => string {
  if (kind === 'bytes') return formatBytes;
  if (kind === 'percent') return formatPercent;
  return formatCount;
}

export function metricUnitKind(metric: string): UnitKind {
  if (metric.endsWith('_bytes') || metric.endsWith('_bytes_total')) return 'bytes';
  if (metric.endsWith('_percent')) return 'percent';
  return 'count';
}

const W = 480;
const H = 120;
const PAD = 4;

function path(points: SeriesPoint[], min: number, max: number, useMax: boolean): string {
  if (points.length === 0) return '';
  const span = max - min || 1;
  const step = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(PAD + i * step).toFixed(1)},${y(useMax ? p.max : p.avg).toFixed(1)}`)
    .join(' ');
}

export function MetricChartCard({
  title,
  points,
  unit,
  loading = false,
  label,
}: {
  title: string;
  points: SeriesPoint[] | undefined;
  unit: UnitKind;
  loading?: boolean;
  label?: string;
}) {
  const fmt = unitFormatter(unit);
  const last = points?.[points.length - 1]?.last;

  return (
    <section className="card" aria-label={title}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="card-title" style={{ margin: 0 }}>
          {title}
        </h2>
        <span style={{ fontSize: 20, fontWeight: 300, fontVariantNumeric: 'tabular-nums' }} title={label}>
          {loading ? '—' : last === undefined ? '—' : fmt(last)}
        </span>
      </div>
      <div style={{ marginTop: 12 }}>
        {loading ? (
          <Skeleton h={120} />
        ) : !points || points.length === 0 ? (
          <div className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>
            Sem amostras no período
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={120} role="img" aria-label={`${title}: série temporal`}>
            <defs>
              <linearGradient id={`grad-${title.replace(/\W+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={PAD}
                x2={W - PAD}
                y1={PAD + f * (H - PAD * 2)}
                y2={PAD + f * (H - PAD * 2)}
                stroke="var(--border-default)"
                strokeDasharray="3 4"
                strokeWidth="1"
              />
            ))}
            <path d={`${path(points, 0, Math.max(...points.map((p) => p.max)), true)} L${W - PAD},${H} L${PAD},${H} Z`} fill={`url(#grad-${title.replace(/\W+/g, '')})`} stroke="none" />
            <path d={path(points, 0, Math.max(...points.map((p) => p.max)), true)} fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinejoin="round" />
            {points.map((p, i) => (
              <rect key={p.t} x={(i * (W - PAD * 2)) / points.length} y={0} width={(W - PAD * 2) / points.length} height={H} fill="transparent">
                <title>{`${new Date(p.t).toLocaleTimeString('pt-BR')} — média ${fmt(p.avg)}, máx ${fmt(p.max)}`}</title>
              </rect>
            ))}
          </svg>
        )}
      </div>
    </section>
  );
}

'use client';

/**
 * RateLimitSparkline — barras 429/min dos últimos 15 minutos por classe de
 * rota (HM05 follow-up). Segue designer.md §5 / MetricChartCard: SVG puro
 * (sem nova dependência), tooltip nativo via <title>, cor de alerta quando
 * o bucket tem 429s, neutro quando zerado.
 */
export interface RateLimitPoint {
  windowStart: string;
  limited: number;
}

const W = 240;
const H = 48;
const GAP = 2;

export function RateLimitSparkline({ points }: { points: RateLimitPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.limited));
  const n = points.length;
  const bw = n > 0 ? (W - GAP * (n - 1)) / n : W;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label="429 por minuto nos últimos 15 minutos"
    >
      {points.map((p, i) => {
        // Bucket zerado mantém um stub de 1px: a série continua legível
        // (minutos sem 429 não viram buracos no gráfico).
        const h = Math.max(1, Math.round((p.limited / max) * (H - 2)));
        return (
          <rect
            key={p.windowStart}
            x={(i * (bw + GAP)).toFixed(1)}
            y={H - h}
            width={bw.toFixed(1)}
            height={h}
            fill={p.limited > 0 ? 'var(--status-warning)' : 'var(--border-default)'}
            rx={1}
          >
            <title>{`${new Date(p.windowStart).toLocaleTimeString('pt-BR')} — ${p.limited} limitado(s)`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

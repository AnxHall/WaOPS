'use client';

/**
 * Canonical status semantics (designer.md §2.3 + §7, UI_STATE_MATRIX).
 * Status NUNCA é comunicado apenas por cor: badge sempre com label textual;
 * classes derivadas dos tokens de status.
 */

export type StatusTone = 'ok' | 'info' | 'warning' | 'critical' | 'neutral';

/** Severidade de incidente → tone (designer.md §4.8: high = laranja profundo). */
export function severityTone(severity: string): StatusTone {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'high':
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'neutral';
  }
}

/** Estado de incidente → tone. */
export function incidentStatusTone(status: string): StatusTone {
  switch (status) {
    case 'resolved':
    case 'closed':
      return 'neutral';
    case 'acknowledged':
      return 'info';
    case 'detected':
      return severityOrCritical(status);
    default:
      return 'neutral';
  }
}

function severityOrCritical(_s: string): StatusTone {
  return 'critical';
}

/** Estado de host/agente → tone. */
export function resourceStatusTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case 'online':
    case 'active':
    case 'available':
      return 'ok';
    case 'degraded':
    case 'stale':
    case 'attention':
      return 'warning';
    case 'down':
    case 'unreachable':
      return 'critical';
    case 'pending':
      return 'info';
    case 'offline':
    case 'stopped':
    case null:
    case undefined:
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Classes CSS canônicas de badge (globals.css). */
export function badgeClass(tone: StatusTone): string {
  return `badge ${tone}`;
}

/** Ícone textual opcional por tone — status nunca depende só de cor (a11y). */
export function toneGlyph(tone: StatusTone): string {
  switch (tone) {
    case 'ok':
      return '●';
    case 'info':
      return '●';
    case 'warning':
      return '▲';
    case 'critical':
      return '■';
    default:
      return '○';
  }
}

/** Data/hora relativa para last seen / detected. */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'nunca';
  const delta = now - new Date(iso).getTime();
  if (Number.isNaN(delta)) return '—';
  const s = Math.max(0, Math.floor(delta / 1000));
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

/** Um sample fresco é < 60s; stale > 5min (fundação: intervalos de 10–30s). */
export function isStale(lastObservedAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastObservedAt) return true;
  const delta = now - new Date(lastObservedAt).getTime();
  return Number.isNaN(delta) || delta > 5 * 60_000;
}

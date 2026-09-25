import { createHash } from 'node:crypto';

/**
 * Deterministic fingerprint composition (EVENT_CATALOG.md). Same inputs → same
 * fingerprint, stable across restarts and services.
 */
export function composeFingerprint(
  rule: string,
  parts: { tenantId: string; hostId?: string | null; containerId?: string | null; resourceId?: string | null },
): string {
  const segments = [rule, parts.tenantId];
  if (parts.hostId) segments.push(parts.hostId);
  if (parts.containerId) segments.push(parts.containerId);
  if (parts.resourceId) segments.push(parts.resourceId);
  const hash = createHash('sha256').update(segments.join('|')).digest('hex');
  return `sha256:${hash}`;
}

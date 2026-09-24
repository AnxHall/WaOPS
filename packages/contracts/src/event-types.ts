import { z } from 'zod';
import type { EventSeverity } from './event-envelope.js';

/** Fingerprint compositions documented in EVENT_CATALOG.md. */
export const FingerprintRule = z.enum([
  'tenant_host_container',
  'tenant_host',
  'tenant_resource',
  'tenant_monitor',
  'tenant_issue',
  'tenant_database',
]);
export type FingerprintRule = z.infer<typeof FingerprintRule>;

export interface EventTypeDefinition {
  type: string;
  defaultSeverity: EventSeverity;
  /** Which fingerprint composition applies (EVENT_CATALOG.md). */
  fingerprintRule: FingerprintRule;
  /** Whether the engine may open incidents from this type by default. */
  incidentByDefault: boolean;
  module: string;
}

/**
 * Open registry of event types. New types are registered as data — the central
 * engine never needs modification (foundation requirement).
 */
const registry = new Map<string, EventTypeDefinition>();

export function registerEventType(def: EventTypeDefinition): void {
  if (registry.has(def.type)) {
    throw new Error(`event type already registered: ${def.type}`);
  }
  registry.set(def.type, def);
}

export function getEventType(type: string): EventTypeDefinition | undefined {
  return registry.get(type);
}

export function listEventTypes(): EventTypeDefinition[] {
  return [...registry.values()];
}

/** Event Catalog v1 seed (docs/development/contracts/EVENT_CATALOG.md). Partial by design. */
export const EVENT_CATALOG_V1: EventTypeDefinition[] = [
  {
    type: 'container.down',
    defaultSeverity: 'high',
    fingerprintRule: 'tenant_host_container',
    incidentByDefault: true,
    module: 'wamonitor',
  },
  {
    type: 'container.oom',
    defaultSeverity: 'critical',
    fingerprintRule: 'tenant_host_container',
    incidentByDefault: true,
    module: 'wamonitor',
  },
  {
    type: 'container.health_failed',
    defaultSeverity: 'high',
    fingerprintRule: 'tenant_host_container',
    incidentByDefault: true,
    module: 'wamonitor',
  },
  {
    type: 'host.unreachable',
    defaultSeverity: 'critical',
    fingerprintRule: 'tenant_host',
    incidentByDefault: true,
    module: 'wamonitor',
  },
  {
    type: 'infra.cpu.high',
    defaultSeverity: 'warning',
    fingerprintRule: 'tenant_host',
    incidentByDefault: true,
    module: 'wamonitor',
  },
  {
    type: 'infra.memory.high',
    defaultSeverity: 'warning',
    fingerprintRule: 'tenant_host',
    incidentByDefault: true,
    module: 'wamonitor',
  },
  {
    type: 'infra.disk.high',
    defaultSeverity: 'high',
    fingerprintRule: 'tenant_host',
    incidentByDefault: true,
    module: 'wamonitor',
  },
  {
    type: 'notification.failed',
    defaultSeverity: 'warning',
    fingerprintRule: 'tenant_resource',
    incidentByDefault: false,
    module: 'wanotify',
  },
];

/** Registers the v1 catalog into the open registry (idempotent at boot). */
export function registerEventCatalogV1(): void {
  for (const def of EVENT_CATALOG_V1) {
    if (!registry.has(def.type)) {
      registry.set(def.type, def);
    }
  }
}

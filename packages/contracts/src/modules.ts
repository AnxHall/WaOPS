/** Module registry contract — source of truth: contracts/entitlements/modules.v1.yaml. */
export interface ModuleDefinition {
  key: string;
  name: string;
  features: readonly string[];
}

export const MODULES_V1: readonly ModuleDefinition[] = [
  {
    key: 'wamonitor',
    name: 'WaMonitor',
    features: ['host_monitoring', 'docker_monitoring', 'synthetic_checks', 'application_templates'],
  },
  {
    key: 'wasupport',
    name: 'WaSupport',
    features: ['tickets', 'kanban', 'sla', 'customer_portal', 'auto_ticket_from_incident'],
  },
  {
    key: 'wantry',
    name: 'Wantry',
    features: ['error_ingestion', 'issue_grouping', 'release_context'],
  },
  {
    key: 'wadatabase',
    name: 'WaDatabase',
    features: ['postgres', 'mysql', 'mariadb', 'query_analysis'],
  },
  {
    key: 'wabackup',
    name: 'WaBackup',
    features: ['backup_jobs', 'managed_storage', 'customer_storage', 'restore_tests'],
  },
  {
    key: 'waknowledge',
    name: 'WaKnowledge',
    features: ['documents', 'runbooks', 'change_management'],
  },
  {
    key: 'wanotify',
    name: 'WaNotify',
    features: ['email', 'webhook', 'whatsapp', 'slack', 'ntfy'],
  },
  {
    key: 'warelease',
    name: 'WaRelease',
    features: ['github'],
  },
  {
    key: 'waai',
    name: 'WaAI',
    features: ['chat', 'contextual_popover', 'byok'],
  },
];

export const MODULE_KEYS_V1 = MODULES_V1.map((m) => m.key);
export type ModuleKey = (typeof MODULE_KEYS_V1)[number];

/** Quota metric keys (docs/04-billing/billing-entitlements.md). */
export const QUOTA_METRIC_KEYS = [
  'agents',
  'hosts',
  'monitors',
  'users',
  'subtenants',
  'databases',
  'storage',
  'backups',
  'retention_days',
  'tickets',
  'emails',
  'whatsapp_sessions',
] as const;

export type QuotaMetricKey = (typeof QUOTA_METRIC_KEYS)[number];

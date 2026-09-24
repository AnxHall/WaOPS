/**
 * Permission keys — source of truth: contracts/permissions/permissions.v1.yaml.
 * Kept in sync via contract test (paridade ADR-007).
 */
export const PERMISSION_KEYS_V1 = [
  'tenants.read',
  'tenants.manage',
  'users.read',
  'users.manage',
  'roles.read',
  'roles.manage',
  'billing.read',
  'billing.manage',
  'agents.read',
  'agents.enroll',
  'agents.revoke',
  'hosts.read',
  'hosts.manage',
  'monitors.read',
  'monitors.manage',
  'incidents.read',
  'incidents.ack',
  'incidents.resolve',
  'tickets.read',
  'tickets.create',
  'tickets.assign',
  'tickets.resolve',
  'knowledge.read',
  'knowledge.edit',
  'knowledge.publish',
  'databases.read',
  'databases.manage',
  'contracts.read',
  'contracts.manage',
  'backups.read',
  'backups.manage',
  'notifications.read',
  'notifications.manage',
  'integrations.read',
  'integrations.manage',
  'secrets.manage',
  'ai.use',
  'ai.configure',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS_V1)[number];

/** System roles (docs/development/contracts/PERMISSION_MATRIX.md defaults). */
export const SYSTEM_ROLES = [
  'platform_root',
  'tenant_owner',
  'tenant_admin',
  'technical_admin',
  'operator',
  'support_agent',
  'customer_user',
  'viewer',
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

/**
 * Role → permissions defaults from the Permission Matrix. Partial on purpose:
 * commercial/customer permissions are configured per tenant, not seeded broadly.
 */
export const ROLE_PERMISSIONS: Record<SystemRole, readonly PermissionKey[]> = {
  platform_root: PERMISSION_KEYS_V1,
  tenant_owner: PERMISSION_KEYS_V1.filter((k) => k !== 'tenants.manage'),
  tenant_admin: PERMISSION_KEYS_V1.filter(
    (k) => k !== 'tenants.manage' && !k.startsWith('billing.'),
  ),
  technical_admin: PERMISSION_KEYS_V1.filter(
    (k) =>
      k.startsWith('hosts.') ||
      k.startsWith('agents.') ||
      k.startsWith('monitors.') ||
      k.startsWith('incidents.') ||
      k.startsWith('databases.') ||
      k.startsWith('backups.') ||
      k.startsWith('notifications.') ||
      k.startsWith('integrations.') ||
      k === 'secrets.manage',
  ),
  operator: [
    'tenants.read',
    'hosts.read',
    'agents.read',
    'monitors.read',
    'incidents.read',
    'incidents.ack',
    'incidents.resolve',
    'tickets.read',
    'tickets.create',
    'notifications.read',
  ],
  support_agent: [
    'tenants.read',
    'hosts.read',
    'incidents.read',
    'tickets.read',
    'tickets.create',
    'tickets.assign',
    'tickets.resolve',
    'knowledge.read',
  ],
  customer_user: ['tickets.read', 'tickets.create', 'knowledge.read'],
  viewer: [
    'tenants.read',
    'hosts.read',
    'agents.read',
    'monitors.read',
    'incidents.read',
    'notifications.read',
  ],
};

import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

/** Test/CI helper: truncate all foundation tables (order respects FKs). */
export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      notification_deliveries, notification_channels,
      metric_samples,
      event_inbox, outbox_events,
      incident_timeline, incident_events, incidents, events,
      alert_rules,
      service_dependencies, services, containers, filesystems, network_interfaces, agents, hosts,
      usage_counters, subscriptions, tenant_entitlements, plan_entitlements, plans, modules,
      audit_logs, memberships, role_permissions, roles, permissions, users, tenants
    RESTART IDENTITY CASCADE;
  `);
}

export { PrismaClient };

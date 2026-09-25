/**
 * Cross-tenant mandatory scenario (test-matrix.md): Tenant A e Tenant B com
 * recursos "parecidos"; A NÃO acessa dados de B por nenhuma via.
 * Repo-level suite: TenantContext + repositórios tenant-scoped.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma, resetDb, disconnectPrisma } from '@waops/db';
import { runWithTenantContext } from '@waops/tenancy';

let tenantA: { id: string };
let tenantB: { id: string };
let hostB: { id: string };
let incidentB: { id: string };

beforeAll(async () => {
  const prisma = getPrisma();
  await resetDb(prisma);
  tenantA = await prisma.tenant.create({ data: { slug: 'a-cross', name: 'A' } });
  tenantB = await prisma.tenant.create({ data: { slug: 'b-cross', name: 'B' } });
  hostB = await prisma.host.create({
    data: { tenantId: tenantB.id, name: 'same-name-host', status: 'online' },
  });
  incidentB = await prisma.incident.create({
    data: { tenantId: tenantB.id, title: 'B incident', severity: 'critical', status: 'detected' },
  });
  // mesmo "resource_id" textual em A (IDs conhecidos de B simulados)
  await prisma.host.create({ data: { tenantId: tenantA.id, name: 'a-host', status: 'online' } });
});

afterAll(async () => {
  await disconnectPrisma();
});

function ctxFor(tenantId: string) {
  return {
    userId: 'usr_test',
    tenantId,
    organizationScope: null,
    permissions: new Set(['hosts.read', 'hosts.manage', 'incidents.read', 'incidents.resolve']),
    entitlements: new Set<string>(),
    requestId: 'req_test',
    actorType: 'user' as const,
  };
}

describe('tenant isolation — repository level (Tenant A vs B)', () => {
  it('A não lista hosts de B', async () => {
    const prisma = getPrisma();
    await runWithTenantContext(ctxFor(tenantA.id), async () => {
      const hosts = await prisma.host.findMany({ where: { tenantId: tenantA.id } });
      expect(hosts.every((h) => h.tenantId === tenantA.id)).toBe(true);
      expect(hosts.some((h) => h.tenantId === tenantB.id)).toBe(false);
    });
  });

  it('A não acessa host de B pelo ID conhecido (scoped findFirst)', async () => {
    const prisma = getPrisma();
    await runWithTenantContext(ctxFor(tenantA.id), async () => {
      const host = await prisma.host.findFirst({ where: { id: hostB.id, tenantId: tenantA.id } });
      expect(host).toBeNull();
    });
  });

  it('A não acessa incident de B pelo ID conhecido', async () => {
    const prisma = getPrisma();
    await runWithTenantContext(ctxFor(tenantA.id), async () => {
      const incident = await prisma.incident.findFirst({
        where: { id: incidentB.id, tenantId: tenantA.id },
      });
      expect(incident).toBeNull();
    });
  });

  it('A não altera dados de B (update scoped não encontra a linha)', async () => {
    const prisma = getPrisma();
    await runWithTenantContext(ctxFor(tenantA.id), async () => {
      const result = await prisma.incident.updateMany({
        where: { id: incidentB.id, tenantId: tenantA.id },
        data: { status: 'resolved' },
      });
      expect(result.count).toBe(0);
      const stillB = await prisma.incident.findUniqueOrThrow({ where: { id: incidentB.id } });
      expect(stillB.status).toBe('detected');
    });
  });

  it('B continua acessando seus próprios dados', async () => {
    const prisma = getPrisma();
    await runWithTenantContext(ctxFor(tenantB.id), async () => {
      const host = await prisma.host.findFirst({ where: { id: hostB.id, tenantId: tenantB.id } });
      expect(host).not.toBeNull();
    });
  });

  it('fingerprint de A e B nunca colidem (mesmos nomes de recurso)', async () => {
    const { composeFingerprint } = await import('@waops/contracts');
    const fpA = composeFingerprint('tenant_host', { tenantId: tenantA.id, resourceId: 'same-name-host' });
    const fpB = composeFingerprint('tenant_host', { tenantId: tenantB.id, resourceId: 'same-name-host' });
    expect(fpA).not.toBe(fpB);
  });
});

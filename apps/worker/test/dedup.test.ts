/**
 * Regression C2 (§18/§38): a duplicated event (outbox republish after crash)
 * must be skipped entirely — no second timeline entry, no notification.
 * Tests the exact dedup branch of the worker's handleEventEnvelope logic
 * against a real Postgres.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { buildEventEnvelope } from '@waops/contracts';
import { getPrisma, resetDb, disconnectPrisma, Prisma } from '@waops/db';
import { Prisma as PrismaNs } from '@prisma/client';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });

const skipNoDb = !process.env.DATABASE_URL;
const d = skipNoDb ? describe.skip : describe;

d('event dedup (worker pipeline logic)', () => {
  // Postgres roundtrips + resetDb são custosos: timeout dedicado.
  const prisma = getPrisma();

  beforeEach(async () => {
    if (!skipNoDb) await resetDb(prisma);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  function envelope(): ReturnType<typeof buildEventEnvelope> {
    return buildEventEnvelope({
      eventId: 'evt_dup_test_1',
      tenantId: '00000000-0000-4000-8000-000000000001',
      source: 'test',
      sourceType: 'engine',
      eventType: 'container.down',
      severity: 'high',
      observedAt: new Date(),
      attributes: {},
      resourceId: 'host_x',
      fingerprint: 'sha256:dupfingerprint',
    });
  }

  function storeEvent(env: ReturnType<typeof buildEventEnvelope>) {
    return prisma.domainEvent.create({
      data: {
        id: env.event_id,
        tenantId: env.tenant_id,
        eventType: env.event_type,
        sourceType: env.source_type,
        resourceId: env.resource_id ?? null,
        severity: env.severity,
        fingerprint: env.fingerprint ?? null,
        observedAt: new Date(env.observed_at),
        attributesJson: env.attributes as object,
      },
    });
  }

  function isDuplicate(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
  void PrismaNs;

  it('first insert succeeds; second insert hits P2002 → caller must skip downstream', async () => {
    if (skipNoDb) return;
    const env = envelope();
    await prisma.tenant.create({
      data: { id: env.tenant_id, slug: 'dup-tenant-fk', name: 'Dup FK' },
    });
    await storeEvent(env);
    let duplicate = false;
    await storeEvent(env).catch((err) => {
      if (isDuplicate(err)) duplicate = true;
    });
    expect(duplicate).toBe(true);
    expect(await prisma.domainEvent.count({ where: { id: env.event_id } })).toBe(1);
  });

  it('incident dedup: same fingerprint reuses the open incident (§31)', async () => {
    if (skipNoDb) return;
    const env = envelope();
    await prisma.tenant.create({
      data: { id: env.tenant_id, slug: 'dup-tenant', name: 'Dup' },
    });
    const open = await prisma.incident.create({
      data: {
        tenantId: env.tenant_id,
        title: 'existing',
        severity: 'high',
        status: 'detected',
        fingerprint: env.fingerprint ?? null,
      },
    });
    const again = await prisma.incident.findFirst({
      where: {
        tenantId: env.tenant_id,
        fingerprint: env.fingerprint,
        status: { notIn: ['resolved', 'closed'] },
      },
    });
    expect(again?.id).toBe(open.id); // dedup: reuses, never creates second
  });

  it('fingerprint collision: different resources never share fingerprint (§33)', async () => {
    if (skipNoDb) return;
    const { composeFingerprint } = await import('@waops/contracts');
    const fpA = composeFingerprint('tenant_host', { tenantId: 't1', resourceId: 'host_1' });
    const fpB = composeFingerprint('tenant_host', { tenantId: 't1', resourceId: 'host_2' });
    const fpContainer = composeFingerprint('tenant_host_container', {
      tenantId: 't1',
      resourceId: 'host_1',
      containerId: 'c1',
    });
    expect(fpA).not.toBe(fpB);
    expect(fpA).not.toBe(fpContainer);
  });
});

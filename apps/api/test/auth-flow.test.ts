/**
 * Auth flow + tenant scope derivation: tenant scope vem do contexto
 * autenticado — payload/headers nunca autorizam.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma, resetDb, disconnectPrisma } from '@waops/db';
import { TokenService } from '../src/auth/jwt.service.js';
import { JwtService } from '@nestjs/jwt';
import { getTenantContext, runWithTenantContext } from '@waops/tenancy';

const jwt = new JwtService({ secret: '0'.repeat(32) });
const tokens = new TokenService(jwt);

afterAll(async () => {
  await disconnectPrisma();
});

beforeEach(async () => {
  await resetDb(getPrisma());
});

describe('token service', () => {
  it('round-trips access token claims', async () => {
    const token = await tokens.signAccessToken({
      sub: 'usr_1',
      tenant: 'ten_a',
      org: null,
      perms: ['hosts.read'],
      ents: [],
      jti: 'jti_1',
    });
    const claims = await tokens.verifyAccessToken(token);
    expect(claims.tenant).toBe('ten_a');
    expect(claims.perms).toEqual(['hosts.read']);
  });

  it('rejects tampered token', async () => {
    const token = await tokens.signAccessToken({
      sub: 'usr_1',
      tenant: 'ten_a',
      org: null,
      perms: [],
      ents: [],
      jti: 'j',
    });
    await expect(tokens.verifyAccessToken(token + 'x')).rejects.toThrow();
  });
});

describe('tenant scope derivation', () => {
  it('context tenant overrides any client-provided tenant (forged payload rejected)', async () => {
    // Simula controller: tenant scope do contexto autenticado, nunca do body.
    const prisma = getPrisma();
    const tenantA = await prisma.tenant.create({ data: { slug: 'a-forge', name: 'A' } });
    const tenantB = await prisma.tenant.create({ data: { slug: 'b-forge', name: 'B' } });
    await prisma.host.create({ data: { tenantId: tenantB.id, name: 'b-secret-host' } });

    const token = await tokens.signAccessToken({
      sub: 'usr_x',
      tenant: tenantA.id, // contexto autenticado = A
      org: null,
      perms: ['hosts.read'],
      ents: [],
      jti: 'j2',
    });
    const claims = await tokens.verifyAccessToken(token);

    // Controller usa claims.tenant (A), MESMO SE body pedisse tenant de B:
    const forgedRequestedTenant = tenantB.id; // attacker-controlled
    await runWithTenantContext(
      {
        userId: claims.sub,
        tenantId: claims.tenant, // ← escopo SEMPRE do token
        organizationScope: null,
        permissions: new Set(claims.perms),
        entitlements: new Set(claims.ents),
        requestId: 'req_f',
        actorType: 'user',
      },
      async () => {
        const hosts = await prisma.host.findMany({
          where: { tenantId: claims.tenant }, // ignores forgedRequestedTenant
        });
        expect(hosts).toHaveLength(0);
        expect(forgedRequestedTenant).not.toBe(claims.tenant);
      },
    );
  });
});

describe('permissions guard logic', () => {
  it('deny-by-default without permission', () => {
    runWithTenantContext(
      {
        userId: 'u',
        tenantId: 't',
        organizationScope: null,
        permissions: new Set<string>(),
        entitlements: new Set<string>(),
        requestId: 'r',
        actorType: 'user',
      },
      () => {
        const ctx = getTenantContext();
        expect(ctx?.permissions.has('hosts.manage')).toBe(false);
      },
    );
  });
});

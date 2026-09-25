import { randomUUID } from 'node:crypto';
import { getPrisma, resetDb } from '@waops/db';
import { hash } from '@node-rs/argon2';

export interface TenantFixture {
  tenantId: string;
  userId: string;
  accessToken: string;
  agentCredential?: string;
}

export const DEMO_PASSWORD = 'Test1234!x';

export async function createTenantFixture(slugPrefix: string): Promise<TenantFixture> {
  const prisma = getPrisma();
  const suffix = randomUUID().slice(0, 8);
  const email = `${slugPrefix}-${suffix}@test.local`;
  const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const user = await prisma.user.create({
    data: { email, emailNormalized: email, passwordHash, name: slugPrefix },
  });
  const tenant = await prisma.tenant.create({
    data: { slug: `${slugPrefix}-${suffix}`, name: `Tenant ${slugPrefix}` },
  });
  const ownerRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: null, name: 'tenant_owner', isSystem: true },
  });
  await prisma.membership.create({
    data: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id },
  });
  return { tenantId: tenant.id, userId: user.id, accessToken: '' };
}

export { resetDb };

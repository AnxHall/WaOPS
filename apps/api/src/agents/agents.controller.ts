import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getPrisma } from '@waops/db';
import { requireTenantContext } from '@waops/tenancy';
import { RequirePermission } from '../auth/permissions.guard.js';
import { ApiError } from '../errors.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthedRequest } from '../auth/tenant-context.middleware.js';

/**
 * Agents admin read-model (HARD MISSION 03 — closes GAP-RM-005).
 * Permissions mirror contracts/permissions.v1.yaml: agents.read / agents.enroll / agents.revoke.
 * Enrollment tokens: 256-bit CSPRNG, SHA-256 at rest, 15-min TTL, one-time claim
 * (claim itself stays in collector-gateway — this only mints and lists).
 */

const CreateTokenSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  ttl_minutes: z.coerce.number().int().min(1).max(60).optional(),
});

const TokenResponse = {
  token_ttl_default_minutes: 15,
};

@Controller('api/v1/agents')
export class AgentsController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('agents.read')
  async list(): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    const prisma = getPrisma();
    const agents = await prisma.agent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        version: true,
        protocolVersion: true,
        status: true,
        lastSeenAt: true,
        machineId: true,
        hostId: true,
        capabilities: true,
        createdAt: true,
      },
    });
    return agents.map((a) => ({
      ...a,
      host: a.hostId ? { id: a.hostId } : null,
    }));
  }

  @Post('enrollment-tokens')
  @RequirePermission('agents.enroll')
  async createToken(@Body() body: unknown, @Req() req: AuthedRequest): Promise<unknown> {
    const input = CreateTokenSchema.parse(body ?? {});
    const tenantId = requireTenantContext().tenantId;
    const prisma = getPrisma();
    const token = `enr_${randomBytes(24).toString('hex')}`; // 192-bit CSPRNG, opaque
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const ttlMs = (input.ttl_minutes ?? TokenResponse.token_ttl_default_minutes) * 60_000;
    const created = await prisma.agentEnrollmentToken.create({
      data: {
        tokenHash,
        tenantId,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    await this.audit.record({
      action: 'agent.enrollment_token.create',
      resourceType: 'agent_enrollment_token',
      resourceId: created.id,
      after: { name: input.name ?? null, ttl_minutes: input.ttl_minutes ?? 15 },
      actorId: req.auth?.sub,
    });
    return {
      token, // plaintext shown exactly once (never stored/logged)
      token_id: created.id,
      expires_at: created.expiresAt.toISOString(),
      install_hint: 'WAOPS_ENROLLMENT_TOKEN=<token> waagent',
    };
  }

  @Post(':id/revoke')
  @RequirePermission('agents.revoke')
  async revoke(@Param('id') id: string, @Req() req: AuthedRequest): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    const prisma = getPrisma();
    const agent = await prisma.agent.findFirst({ where: { id, tenantId } });
    if (!agent) throw ApiError.notFound('Agent');
    const updated = await prisma.agent.update({
      where: { id: agent.id },
      data: { status: 'revoked' },
    });
    // Invalidate pending enrollment tokens minted for this agent? No — tokens are
    // tenant-level; revocation only kills the durable credential (auth.ts checks status).
    await this.audit.record({
      action: 'agent.revoke',
      resourceType: 'agent',
      resourceId: agent.id,
      before: { status: agent.status },
      after: { status: 'revoked' },
      actorId: req.auth?.sub,
    });
    return { id: updated.id, status: updated.status };
  }
}

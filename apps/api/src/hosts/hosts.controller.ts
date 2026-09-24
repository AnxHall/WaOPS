import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { getPrisma } from '@waops/db';
import { requireTenantContext } from '@waops/tenancy';
import { RequirePermission } from '../auth/permissions.guard.js';
import { ApiError } from '../errors.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthedRequest } from '../auth/tenant-context.middleware.js';

const CreateHostSchema = z.object({
  name: z.string().min(1).max(120),
  osType: z.string().max(40).optional(),
  osVersion: z.string().max(80).optional(),
  arch: z.string().max(40).optional(),
  environment: z.string().max(40).optional(),
});

/**
 * All queries tenant-scoped from TenantContext. Client never provides tenant_id.
 */
@Controller('api/v1/hosts')
export class HostsController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('hosts.read')
  async list(): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    return getPrisma().host.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get(':id')
  @RequirePermission('hosts.read')
  async get(@Param('id') id: string): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    const host = await getPrisma().host.findFirst({ where: { id, tenantId } });
    if (!host) throw ApiError.notFound('Host');
    return host;
  }

  @Post()
  @RequirePermission('hosts.manage')
  async create(@Body() body: unknown, @Req() req: AuthedRequest): Promise<unknown> {
    const input = CreateHostSchema.parse(body);
    const ctx = requireTenantContext();
    const created = await getPrisma().host.create({
      data: { tenantId: ctx.tenantId, ...input },
    });
    await this.audit.record({
      action: 'host.create',
      resourceType: 'host',
      resourceId: created.id,
      after: created,
      actorId: req.auth?.sub,
    });
    return created;
  }
}

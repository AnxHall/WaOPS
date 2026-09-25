import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { getPrisma } from '@waops/db';
import { requireTenantContext } from '@waops/tenancy';
import { RequirePermission } from '../auth/permissions.guard.js';
import { ApiError } from '../errors.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthedRequest } from '../auth/tenant-context.middleware.js';

const AckSchema = z.object({ note: z.string().max(1000).optional() });
const ResolveSchema = z.object({ note: z.string().max(1000).optional() });

/**
 * Incident endpoints per monitoring-endpoints.md. Every read/write is scoped
 * by tenant from TenantContext; IDs known from another tenant resolve to 404.
 */
@Controller('api/v1/incidents')
export class IncidentsController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('incidents.read')
  async list(): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    return getPrisma().incident.findMany({
      where: { tenantId },
      orderBy: { detectedAt: 'desc' },
      take: 100,
    });
  }

  @Get(':id')
  @RequirePermission('incidents.read')
  async get(@Param('id') id: string): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    const incident = await getPrisma().incident.findFirst({ where: { id, tenantId } });
    if (!incident) throw ApiError.notFound('Incident');
    return incident;
  }

  @Get(':id/timeline')
  @RequirePermission('incidents.read')
  async timeline(@Param('id') id: string): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    const incident = await getPrisma().incident.findFirst({ where: { id, tenantId } });
    if (!incident) throw ApiError.notFound('Incident');
    return getPrisma().incidentTimelineEntry.findMany({
      where: { incidentId: incident.id, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post(':id/acknowledge')
  @RequirePermission('incidents.ack')
  async acknowledge(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ): Promise<unknown> {
    const { note } = AckSchema.parse(body ?? {});
    const tenantId = requireTenantContext().tenantId;
    const userId = requireTenantContext().userId;
    const prisma = getPrisma();

    const incident = await prisma.incident.findFirst({ where: { id, tenantId } });
    if (!incident) throw ApiError.notFound('Incident');
    if (incident.status !== 'detected') {
      throw ApiError.conflict(`incident not in detected state (current: ${incident.status})`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const u = await tx.incident.update({
        where: { id: incident.id },
        data: { status: 'acknowledged', acknowledgedAt: now },
      });
      await tx.incidentTimelineEntry.create({
        data: {
          tenantId,
          incidentId: incident.id,
          entryType: 'acknowledged',
          actorType: 'user',
          actorId: userId,
          payloadJson: note ? { note } : undefined,
        },
      });
      return u;
    });

    await this.audit.record({
      action: 'incident.acknowledge',
      resourceType: 'incident',
      resourceId: incident.id,
      before: { status: incident.status },
      after: { status: 'acknowledged' },
      actorId: req.auth?.sub,
    });
    return updated;
  }

  @Post(':id/resolve')
  @RequirePermission('incidents.resolve')
  async resolve(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ): Promise<unknown> {
    const { note } = ResolveSchema.parse(body ?? {});
    const tenantId = requireTenantContext().tenantId;
    const userId = requireTenantContext().userId;
    const prisma = getPrisma();

    const incident = await prisma.incident.findFirst({ where: { id, tenantId } });
    if (!incident) throw ApiError.notFound('Incident');
    if (incident.status === 'resolved' || incident.status === 'closed') {
      throw ApiError.conflict(`incident already ${incident.status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const u = await tx.incident.update({
        where: { id: incident.id },
        data: { status: 'resolved', resolvedAt: now },
      });
      await tx.incidentTimelineEntry.create({
        data: {
          tenantId,
          incidentId: incident.id,
          entryType: 'resolved',
          actorType: 'user',
          actorId: userId,
          payloadJson: note ? { note } : undefined,
        },
      });
      return u;
    });

    await this.audit.record({
      action: 'incident.resolve',
      resourceType: 'incident',
      resourceId: incident.id,
      before: { status: incident.status },
      after: { status: 'resolved' },
      actorId: req.auth?.sub,
    });
    return updated;
  }

  @Post(':id/reopen')
  @RequirePermission('incidents.resolve')
  async reopen(@Param('id') id: string, @Req() req: AuthedRequest): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    const userId = requireTenantContext().userId;
    const prisma = getPrisma();

    const incident = await prisma.incident.findFirst({ where: { id, tenantId } });
    if (!incident) throw ApiError.notFound('Incident');

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.incident.update({
        where: { id: incident.id },
        data: { status: 'acknowledged', resolvedAt: null },
      });
      await tx.incidentTimelineEntry.create({
        data: {
          tenantId,
          incidentId: incident.id,
          entryType: 'reopened',
          actorType: 'user',
          actorId: userId,
        },
      });
      return u;
    });

    await this.audit.record({
      action: 'incident.reopen',
      resourceType: 'incident',
      resourceId: incident.id,
      actorId: req.auth?.sub,
    });
    return updated;
  }
}

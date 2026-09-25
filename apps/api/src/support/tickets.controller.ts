import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { getPrisma } from '@waops/db';
import { requireTenantContext } from '@waops/tenancy';
import { RequirePermission } from '../auth/permissions.guard.js';
import { ApiError } from '../errors.js';
import { AuditService } from '../audit/audit.service.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';
import type { AuthedRequest } from '../auth/tenant-context.middleware.js';

/**
 * WaSupport — tickets/requests (support-endpoints.md foundation subset).
 *
 * Tenant scope ALWAYS from TenantContext; cross-tenant ids resolve 404 (never
 * 403 — no existence oracle). Ticket numbers are per-tenant sequential
 * (support_sequences row; atomic via conditional increment — no gaps under
 * single-writer API; duplicates impossible via unique (tenant_id, number)).
 *
 * State machine (foundation): open → in_progress → resolved → closed, with
 * reopen allowed from resolved/closed. Terminal = closed. Assignment requires
 * tickets.assign; transitions require tickets.resolve (foundation collapses
 * triage/resolve permissions by design; see permissions.v1.yaml).
 */

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const CreateTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10_000),
  priority: z.enum(PRIORITIES).optional(),
  labels: z.array(z.string().min(1).max(40)).max(10).optional(),
  incident_id: z.string().uuid().optional(),
});

const PatchTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(10_000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  labels: z.array(z.string().min(1).max(40)).max(10).optional(),
});

const CommentSchema = z.object({ body: z.string().min(1).max(5000) });

const AssignSchema = z.object({
  assignee_id: z.string().uuid().nullable(),
});

const TransitionSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().max(1000).optional(),
});

/** Allowed transitions (state machine; anything else → 409 conflict). */
const TRANSITIONS: Record<(typeof STATUSES)[number], readonly string[]> = {
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['resolved', 'closed', 'open'],
  resolved: ['closed', 'open'],
  closed: ['open'],
};

@Controller('api/v1/tickets')
export class TicketsController {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RealtimePublisher) private readonly realtime: RealtimePublisher,
  ) {}

  @Get()
  @RequirePermission('tickets.read')
  async list(): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    return getPrisma().supportTicket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { comments: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
  }

  @Post()
  @RequirePermission('tickets.create')
  async create(@Body() body: unknown, @Req() req: AuthedRequest): Promise<unknown> {
    const input = CreateTicketSchema.parse(body ?? {});
    const ctx = requireTenantContext();
    const prisma = getPrisma();

    const created = await prisma.$transaction(async (tx) => {
      // Per-tenant sequence; row is created on demand (upsert-free path).
      const bumped = await tx.$queryRaw<{ value: number }[]>`
        INSERT INTO support_sequences (tenant_id, value) VALUES (${ctx.tenantId}::uuid, 1)
        ON CONFLICT (tenant_id) DO UPDATE SET value = support_sequences.value + 1
        RETURNING value`;
      if (!bumped[0]) throw new Error('support_sequences increment returned no row');
      return tx.supportTicket.create({
        data: {
          tenantId: ctx.tenantId,
          organizationId: ctx.organizationScope,
          number: bumped[0]!.value,
          title: input.title,
          description: input.description,
          priority: input.priority ?? 'normal',
          labels: input.labels ?? [],
          incidentId: input.incident_id ?? null,
          requesterId: ctx.userId,
        },
      });
    });

    await this.audit.record({
      action: 'ticket.create',
      resourceType: 'support_ticket',
      resourceId: created.id,
      after: { number: created.number, title: created.title, priority: created.priority },
      actorId: req.auth?.sub,
    });
    await this.realtime
      .publish(created.tenantId, {
        channel: 'incidents',
        type: 'ticket.created',
        occurred_at: created.createdAt.toISOString(),
        payload: { ticket_id: created.id, number: created.number, title: created.title, priority: created.priority },
      })
      .catch(() => undefined);
    return created;
  }

  @Get(':id')
  @RequirePermission('tickets.read')
  async get(@Param('id') id: string): Promise<unknown> {
    const tenantId = requireTenantContext().tenantId;
    const prisma = getPrisma();
    const ticket = await prisma.supportTicket.findFirst({ where: { id, tenantId } });
    if (!ticket) throw ApiError.notFound('Ticket');
    const comments = await prisma.supportTicketComment.findMany({
      where: { ticketId: ticket.id, tenantId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return { ...ticket, comments };
  }

  @Patch(':id')
  @RequirePermission('tickets.create')
  async patch(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest): Promise<unknown> {
    const input = PatchTicketSchema.parse(body ?? {});
    const tenantId = requireTenantContext().tenantId;
    const prisma = getPrisma();
    const ticket = await prisma.supportTicket.findFirst({ where: { id, tenantId } });
    if (!ticket) throw ApiError.notFound('Ticket');
    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.labels !== undefined ? { labels: input.labels } : {}),
      },
    });
    await this.audit.record({
      action: 'ticket.update',
      resourceType: 'support_ticket',
      resourceId: ticket.id,
      before: { title: ticket.title, priority: ticket.priority },
      after: { title: updated.title, priority: updated.priority },
      actorId: req.auth?.sub,
    });
    return updated;
  }

  @Post(':id/comments')
  @RequirePermission('tickets.create')
  async comment(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest): Promise<unknown> {
    const input = CommentSchema.parse(body ?? {});
    const ctx = requireTenantContext();
    const prisma = getPrisma();
    const ticket = await prisma.supportTicket.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!ticket) throw ApiError.notFound('Ticket');
    const created = await prisma.supportTicketComment.create({
      data: { tenantId: ctx.tenantId, ticketId: ticket.id, authorId: ctx.userId, body: input.body },
    });
    await this.audit.record({
      action: 'ticket.comment',
      resourceType: 'support_ticket',
      resourceId: ticket.id,
      after: { comment_id: created.id },
      actorId: req.auth?.sub,
    });
    return created;
  }

  @Post(':id/assign')
  @RequirePermission('tickets.assign')
  async assign(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest): Promise<unknown> {
    const input = AssignSchema.parse(body ?? {});
    const tenantId = requireTenantContext().tenantId;
    const prisma = getPrisma();
    const ticket = await prisma.supportTicket.findFirst({ where: { id, tenantId } });
    if (!ticket) throw ApiError.notFound('Ticket');

    if (input.assignee_id) {
      // Assignee must be an active member of the SAME tenant.
      const member = await prisma.membership.findFirst({
        where: { userId: input.assignee_id, tenantId, status: 'active' },
      });
      if (!member) throw ApiError.validation('assignee is not an active member of this tenant');
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { assigneeId: input.assignee_id },
    });
    await this.audit.record({
      action: 'ticket.assign',
      resourceType: 'support_ticket',
      resourceId: ticket.id,
      before: { assignee_id: ticket.assigneeId },
      after: { assignee_id: input.assignee_id },
      actorId: req.auth?.sub,
    });
    return updated;
  }

  @Post(':id/transition')
  @RequirePermission('tickets.resolve')
  async transition(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest): Promise<unknown> {
    const input = TransitionSchema.parse(body ?? {});
    const ctx = requireTenantContext();
    const prisma = getPrisma();
    const ticket = await prisma.supportTicket.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!ticket) throw ApiError.notFound('Ticket');

    const current = ticket.status as (typeof STATUSES)[number];
    if (!TRANSITIONS[current].includes(input.status)) {
      throw ApiError.conflict(`illegal transition ${current} → ${input.status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: input.status,
          ...(input.status === 'resolved' ? { resolvedAt: new Date() } : {}),
          ...(input.status === 'open' ? { resolvedAt: null } : {}),
        },
      });
      await tx.supportTicketComment.create({
        data: {
          tenantId: ctx.tenantId,
          ticketId: ticket.id,
          authorId: ctx.userId,
          body: `status → ${input.status}${input.note ? `: ${input.note}` : ''}`,
        },
      });
      return u;
    });

    await this.audit.record({
      action: 'ticket.transition',
      resourceType: 'support_ticket',
      resourceId: ticket.id,
      before: { status: ticket.status },
      after: { status: input.status },
      actorId: req.auth?.sub,
    });
    await this.realtime
      .publish(ctx.tenantId, {
        channel: 'incidents',
        type: 'ticket.transitioned',
        occurred_at: new Date().toISOString(),
        payload: { ticket_id: ticket.id, number: ticket.number, from: ticket.status, to: input.status },
      })
      .catch(() => undefined);
    return updated;
  }
}

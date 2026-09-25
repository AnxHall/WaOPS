import { Injectable } from '@nestjs/common';
import { getPrisma } from '@waops/db';
import { currentCorrelation } from '@waops/observability';
import { getTenantContext } from '@waops/tenancy';

export interface AuditInput {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  tenantId?: string; // required for system/agent contexts without user ctx
  actorType?: 'user' | 'agent' | 'system';
  actorId?: string | null;
}

/** Append-only audit trail (AGENTS.md DoD: audit). */
@Injectable()
export class AuditService {
  async record(input: AuditInput): Promise<void> {
    const prisma = getPrisma();
    const tenantCtx = getTenantContext();
    const corr = currentCorrelation();
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? tenantCtx?.tenantId ?? null,
        actorType: input.actorType ?? tenantCtx?.actorType ?? 'system',
        actorId: input.actorId ?? tenantCtx?.userId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        beforeData: input.before === undefined ? undefined : (input.before as object),
        afterData: input.after === undefined ? undefined : (input.after as object),
        requestId: corr?.requestId ?? null,
      },
    });
  }
}

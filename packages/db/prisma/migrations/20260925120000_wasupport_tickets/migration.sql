-- HARD MISSION 05 — WaSupport (tickets/requests) foundation.
-- Human-readable ticket numbers are per-tenant (support_sequences counter);
-- uniqueness enforced by support_tickets_tenant_id_number_key.
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "requester_id" UUID NOT NULL,
    "assignee_id" UUID,
    "incident_id" UUID,
    "labels" TEXT[],
    "open_since" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_ticket_comments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_sequences" (
    "tenant_id" UUID NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "support_sequences_pkey" PRIMARY KEY ("tenant_id")
);

CREATE INDEX "support_tickets_tenant_id_status_updated_at_idx" ON "support_tickets"("tenant_id", "status", "updated_at" DESC);

CREATE INDEX "support_tickets_tenant_id_assignee_id_idx" ON "support_tickets"("tenant_id", "assignee_id");

CREATE UNIQUE INDEX "support_tickets_tenant_id_number_key" ON "support_tickets"("tenant_id", "number");

CREATE INDEX "support_ticket_comments_tenant_id_ticket_id_created_at_idx" ON "support_ticket_comments"("tenant_id", "ticket_id", "created_at");

ALTER TABLE "support_ticket_comments" ADD CONSTRAINT "support_ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

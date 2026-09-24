-- CreateTable
CREATE TABLE "agent_enrollment_tokens" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" UUID,
    "agent_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_enrollment_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_enrollment_tokens_token_key" ON "agent_enrollment_tokens"("token");

-- CreateIndex
CREATE INDEX "agent_enrollment_tokens_tenant_id_status_idx" ON "agent_enrollment_tokens"("tenant_id", "status");

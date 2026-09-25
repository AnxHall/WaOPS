-- Enrollment tokens stored hashed (sha256) at rest (ADR-006/AGENT_ENROLLMENT).
-- Plaintext token is shown once to the operator; lookup happens by hash.

-- DropIndex
DROP INDEX "agent_enrollment_tokens_token_key";

-- AlterTable
ALTER TABLE "agent_enrollment_tokens" DROP COLUMN "token",
ADD COLUMN     "token_hash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "agent_enrollment_tokens_token_hash_key" ON "agent_enrollment_tokens"("token_hash");

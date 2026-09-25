-- HARD MISSION 03: deterministic host identity bridge (GAP-RM-003/005).
-- machineId = agent machine fingerprint (host_<machineID> resource ids map to
-- these rows). Unique per tenant. Linked agent rows carry it too.
ALTER TABLE "hosts" ADD COLUMN "machine_id" TEXT;
ALTER TABLE "agents" ADD COLUMN "machine_id" TEXT;
CREATE UNIQUE INDEX "hosts_tenant_machine_id_key" ON "hosts"("tenant_id", "machine_id");
CREATE INDEX "agents_machine_id_idx" ON "agents"("machine_id");
-- Telemetry lookup: by tenant + resource + metric over time (covers /metrics read-model).
CREATE INDEX IF NOT EXISTS "metric_samples_tenant_metric_time_idx"
  ON "metric_samples"("tenant_id", "metric", "observed_at" DESC);

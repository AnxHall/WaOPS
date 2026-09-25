-- HARD MISSION 04 (ADR-009): continuous aggregate for long-window reads.
-- metric_samples_5m: 5-minute rollup of metric_samples (per tenant/resource/
-- metric, preserving mount/interface dimension grouping). Raw samples keep a
-- 30d retention; the rollup extends effective history to 365d for charts.
CREATE MATERIALIZED VIEW IF NOT EXISTS metric_samples_5m
WITH (timescaledb.continuous) AS
SELECT
  tenant_id,
  resource_id,
  metric,
  "dimensions_json"->>'mount' AS mount,
  "dimensions_json"->>'interface' AS interface,
  time_bucket(INTERVAL '5 minutes', "observed_at") AS bucket,
  avg(value)::float8 AS avg,
  max(value)::float8 AS max,
  min(value)::float8 AS min,
  count(*)::int AS sample_count
FROM metric_samples
GROUP BY tenant_id, resource_id, metric, mount, interface, bucket
WITH NO DATA;

-- Refresh continuously every 10 minutes, starting at 14d of history.
SELECT add_continuous_aggregate_policy('metric_samples_5m',
  start_offset      => INTERVAL '14 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '10 minutes',
  if_not_exists     => TRUE);

-- Rollup retention: 365d (long windows beyond raw retention read from here).
SELECT add_retention_policy('metric_samples_5m',
  INTERVAL '365 days', if_not_exists => TRUE);

-- Lookup index for series reads from the rollup.
CREATE INDEX IF NOT EXISTS metric_samples_5m_lookup_idx
  ON metric_samples_5m (tenant_id, metric, bucket DESC);

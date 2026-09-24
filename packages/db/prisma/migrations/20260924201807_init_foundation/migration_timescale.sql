-- TimescaleDB hypertable for metric_samples (ADR-009).
-- Control-plane tables stay relational; telemetry uses chunked time partitions.
SELECT create_hypertable('metric_samples', 'observed_at', if_not_exists => TRUE, migrate_data => TRUE);

-- Baseline retention: raw samples kept 30 days locally (per-plan retention arrives with billing).
SELECT add_retention_policy('metric_samples', INTERVAL '30 days', if_not_exists => TRUE);

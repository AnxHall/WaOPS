# Database Topology

## Initial

PostgreSQL handles control plane.

Timescale extension/instance handles metrics when architecture chooses combined deployment.

## Separation criteria

Consider dedicated telemetry DB when:
- write volume impacts control plane;
- retention jobs affect transactional workload;
- metric query latency competes with API workload.

## Redis

Used for:
- cache;
- queues;
- coordination.

Not source of truth for durable business state.

# WaOPS Engineering Lab

Purpose: intentionally create controlled failures to test monitoring/incident behavior.

Suggested lab targets:

- failing HTTP API
- slow API
- WebSocket service
- PostgreSQL
- MySQL/MariaDB
- Redis
- MinIO
- nginx
- Docker containers
- network fault proxy

Scenarios:
- CPU saturation
- memory pressure
- disk growth
- HTTP 500
- timeout
- flapping
- DNS failure
- TLS expiration simulation
- container crash/restart
- DB connection saturation
- locks/deadlocks
- slow query
- Redis latency

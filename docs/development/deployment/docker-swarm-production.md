# Docker / Swarm Production

## Services
- web
- api
- worker
- collector-gateway
- redis
- postgres/timescale
- object storage integration
- optional dedicated probe workers

## Rules
- no builds in production
- immutable images
- healthchecks
- rolling updates
- resource limits
- structured logs
- secrets externalized

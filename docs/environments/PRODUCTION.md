# Production Environment

## Base

- Docker / Swarm
- Portainer for operational management
- Traefik
- PostgreSQL/Timescale
- Redis
- S3-compatible object storage
- immutable application images

## Rules

- never build images on production hosts;
- deploy tagged immutable images;
- healthchecks;
- rolling update;
- resource limits;
- externalized secrets;
- backup/restore plan;
- migration workflow;
- rollback image retained.

## Agent

Customer WaAgent initiates outbound HTTPS toward WaOPS.
No inbound public agent port required in phase 1.

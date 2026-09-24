# Local Development

## Goal

Paridade suficiente com produção sem tornar o ciclo de desenvolvimento lento.

## Suggested services

```text
waops-web
waops-api
waops-worker
collector-gateway
postgres-timescale
redis
minio
mailpit
ntfy optional
traefik optional profile
```

## Direct ports

Development may expose:
- web: 3000
- api: 3001
- collector: 3002
- mailpit UI
- minio console

## Traefik profile

Optional for routing parity:
- `app.waops.localhost`
- `api.waops.localhost`
- `ingest.waops.localhost`

## Rule

Developers should not be forced through Traefik for every local task.

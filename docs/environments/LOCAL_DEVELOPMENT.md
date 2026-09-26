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

## Test port convention (4000/5000)

Testes e suítes de carga NÃO devem usar as portas de desenvolvimento (3000/3001/3002):
outros projetos rodam na mesma máquina e colidem com essas portas.

- **4000** — apps/api e apps/web sob teste;
- **5000** — apps/collector-gateway sob teste.
<arg_value><b88a6f17>Serviços e testes já aceitam override por env:

```bash
# serviços sob teste em portas altas
PORT=4000 pnpm --filter @waops/api run start
COLLECTOR_PORT=5000 pnpm --filter @waops/collector-gateway run start

# apontando a suíte para elas
E2E_API_URL=http://localhost:4000 E2E_GATEWAY_URL=http://localhost:5000 \
  pnpm --filter @waops/api run test:e2e

# suíte de carga do rate limiter (sempre em porta de teste)
API=http://localhost:4000 node apps/api/scripts/load-rate-limit.mjs
```

CI usa a mesma convenção (E2E_API_URL 4000 / E2E_GATEWAY_URL 5000).
Nunca suba serviços de teste em 3000/3001/3002.

## Traefik profile

Optional for routing parity:
- `app.waops.localhost`
- `api.waops.localhost`
- `ingest.waops.localhost`

## Rule

Developers should not be forced through Traefik for every local task.

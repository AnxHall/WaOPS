# Environment Variables

No real values belong in this document.

## Core

- `DATABASE_URL` — secret
- `REDIS_URL` — secret
- `APP_BASE_URL`
- `API_BASE_URL`
- `COLLECTOR_BASE_URL`
- `NODE_ENV`

## Runtime ports

- `PORT` — porta do api (default 3001; usar **4000** sob teste)
- `COLLECTOR_PORT` — porta do collector-gateway (default 3002; usar **5000** sob teste)

## Test suite targets

- `E2E_API_URL` / `E2E_GATEWAY_URL` — alvo dos E2E (default 3001/3002; convenção de teste: 4000/5000)
- `E2E_MAILPIT_URL` — Mailpit para asserção de email
- `API` — alvo da suíte de carga do rate limiter (`apps/api/scripts/load-rate-limit.mjs`) e da sonda de failure-mode (`scripts/probe-rate-limit-closed.mjs`, job `rate-limit-failure-mode` no CI)

## Object Storage

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID` — secret
- `S3_SECRET_ACCESS_KEY` — secret

## Rate limiting

- `RATE_LIMIT_FAILURE_MODE` — `closed` endurece o limiter para negar (503 `dependency_unavailable`) quando o Redis está indisponível; default é fail-open. Validado no CI pelo job `rate-limit-failure-mode` (sonda `scripts/probe-rate-limit-closed.mjs`)

## Encryption

- `ENCRYPTION_MASTER_KEY` — critical secret

## Mail

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD` — secret
- `SMTP_FROM`

## Billing

- `MERCADOPAGO_*` — secret as applicable
- `ASAAS_*` — secret as applicable

## WAHA

- endpoint/config
- credentials as secret references

## AI

Provider keys should normally be stored via tenant secret storage, not static process env, except platform-managed provider keys.

## Rule

`.env.example` contains names/placeholders only.

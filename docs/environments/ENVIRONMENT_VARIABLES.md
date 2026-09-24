# Environment Variables

No real values belong in this document.

## Core

- `DATABASE_URL` — secret
- `REDIS_URL` — secret
- `APP_BASE_URL`
- `API_BASE_URL`
- `COLLECTOR_BASE_URL`
- `NODE_ENV`

## Object Storage

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID` — secret
- `S3_SECRET_ACCESS_KEY` — secret

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

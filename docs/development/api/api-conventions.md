# API Conventions

## Versioning
`/api/v1/...`

## Auth
Bearer/session conforme surface.

## Idempotency
Obrigatória em:
- billing operations
- ticket creation via automation
- webhook processing
- critical creates

Header:
`Idempotency-Key`

## Pagination
Cursor-based:

```json
{
  "items": [],
  "next_cursor": "..."
}
```

## Filtering
Filtros permitidos devem ser explicitamente definidos por endpoint.

## Errors
Usar envelope documentado em `backend/error-model.md`.

## Permissions
Cada endpoint deve declarar:
- permission
- entitlement
- quota impact
- audit requirement

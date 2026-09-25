# API Conventions

## Versioning
`/api/v1/...`

## Documentation drift rule (obrigatória desde HARD MISSION 02.5)
Qualquer mudança que **adiciona/remove endpoint, altera auth/permission/entitlement, altera
response relevante ou adiciona read-model** DEVE atualizar na MESMA PR/task:
- `docs/development/api/API_ENDPOINT_MATRIX.md`
- `docs/development/api/API_BASELINE_ALPHA.md` (quando afetar baseline)
- `docs/development/api/API_READ_MODELS.md` / `READ_MODEL_GAPS.md` (quando afetar read-models)

Documentação as-built (`API_*.md`) = fotografia do código. Especificação prospectiva
(`core-endpoints.md`, `monitoring-endpoints.md`, ...) = alvo futuro. Divergência nova é
registrada no as-built, nunca resolvida alterando o código para "parecer" a spec sem decisão
pela ordem de autoridade (AGENTS.md §2).

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

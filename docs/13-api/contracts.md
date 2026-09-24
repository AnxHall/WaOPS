# API Contracts

## Regras
- versionar `/api/v1`
- idempotency key em creates críticos
- error envelope consistente
- pagination cursor-based para listas grandes

## Error envelope
```json
{
  "error": {
    "code": "INCIDENT_NOT_FOUND",
    "message": "Incident not found",
    "request_id": "req_123"
  }
}
```

## Tenant
Tenant nunca é confiado a partir de parâmetro livre sem auth context.

# Error Model

## Envelope HTTP

```json
{
  "error": {
    "code": "INCIDENT_NOT_FOUND",
    "message": "Incident not found",
    "request_id": "req_01...",
    "details": {}
  }
}
```

## Classes

- validation_error
- authentication_required
- permission_denied
- entitlement_required
- quota_exceeded
- not_found
- conflict
- rate_limited
- dependency_unavailable
- internal_error

## Regras

- `code` estável e machine-readable.
- mensagens não devem vazar segredo, SQL ou stacktrace.
- erro interno deve registrar correlation ID.
- providers externos devem ser traduzidos para erro de domínio.

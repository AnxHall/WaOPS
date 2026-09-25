# Secret Storage

## Interface

```text
putSecret(scope, plaintext) -> secret_ref
getSecret(secret_ref, authorized_context) -> plaintext
rotateSecret(secret_ref)
revokeSecret(secret_ref)
```

## Requirements
- application-level encryption
- key rotation strategy
- audit access to highly sensitive secrets
- no plaintext in DTO responses
- masked UI representation

# AI Architecture

## Componentes
- provider adapter
- retrieval layer
- permission filter
- context builder
- redaction layer
- conversation store
- audit

## BYOK
- criptografar keys
- nunca logar
- nunca enviar a provider diferente do escolhido
- uso metered por tenant

## Context retrieval
Sempre filtrar por:
- tenant
- organization/subtenant
- user permissions
- module entitlements

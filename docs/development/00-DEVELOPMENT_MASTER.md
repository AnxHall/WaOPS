# WaOPS Development Master

Este diretório complementa a documentação de produto/arquitetura já existente.

Objetivo: responder **como construir o WaOPS** sem duplicar a documentação conceitual.

## Ordem de leitura

1. `backend/project-structure.md`
2. `database/physical-schema.md`
3. `api/api-conventions.md`
4. `events/event-contracts.md`
5. `agent/agent-code-structure.md`
6. `security/tenant-enforcement.md`
7. `testing/test-matrix.md`
8. `plans/implementation-sequence.md`

## Regras

- Não alterar decisões de arquitetura existentes sem ADR.
- Toda implementação tenant-scoped deve exigir `TenantContext`.
- Todo módulo comercial deve validar entitlement no backend.
- Todo consumidor assíncrono deve ser idempotente.
- Todo collector deve ter timeout, health e limites.
- Todo contrato externo deve ser versionado.
- Nenhum segredo pode ser persistido em plaintext.
- Nenhum worker deve assumir que frontend já filtrou permissões.

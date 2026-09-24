# ADR-007 — Contratos: JSON Schema como fonte, espelho zod/TS com teste de paridade

## Status
Accepted.

## Contexto
`contracts/` define JSON Schemas (event envelope, heartbeat, metrics batch) e YAMLs (permissions, modules). O runtime TypeScript precisa validar essas estruturas sem depender de ajv em cada hot path, e sem duplicar definições divergentes.

## Decisão
1. **JSON Schema/YAML em `contracts/` permanece a fonte da verdade.**
2. `packages/contracts` mantém espelhos em **zod** (envelope, heartbeat, metrics batch) e **const arrays** (permission keys, módulos).
3. **Teste de paridade** obrigatório em `packages/contracts/test/parity.test.ts`: valida os mesmos payloads válidos/inválidos contra o JSON Schema (ajv draft 2020-12) e contra o zod; compara permission keys do YAML com o espelho TS. CI falha se divergirem.
4. Evolução backward-compatible: campo novo em ambos; breaking change exige `schema_version` novo (doc `event-contracts.md`).

## Divergências de documentação registradas (encontradas durante a implementação)
- `PACKAGE_MANIFEST.md`/`TREE.txt` não listam `docs/03-multitenancy/isolation.md`, `docs/10-security/security.md` e `docs/development/workflows/pr-checklist.md` (arquivos existem e são válidos; manifest desatualizado).
- Nomes de fila divergem: `queue-topology.md` usa `rules.evaluate`/`incidents.correlate`; `jobs-workers.md` usa `incidents.evaluate`. **Adotado: nomenclatura da queue-topology** (ver ADR-008).
- `docs/development/api/core-endpoints.md` lista `GET /entitlements` e `GET /usage`; `monitoring-endpoints.md` não inclui agents enrollment na lista de agents (o arquivo de enrollment.md descreve o fluxo). Sem conflito real — resolução: endpoint `POST /api/v1/agents/enrollment` implementado no gateway conforme WAAGENT_PROTOCOL_V1.

## Consequências
- Uma única alteração de contrato exige tocar em: `contracts/*.schema.json` + espelho zod + teste de paridade (o teste força a sincronia).

# WaAI Development

## Pipeline

1. authenticate user
2. resolve tenant/org
3. resolve permissions
4. resolve enabled modules
5. retrieve allowed context
6. redact
7. build prompt
8. call selected provider/BYOK
9. persist conversation metadata
10. audit sensitive retrievals

## Retrieval filters
Every source query includes tenant scope and permission filter.

## No actions
Phase 1 tools are read-only.

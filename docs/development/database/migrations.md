# Database Migrations

## Regras

- migrations são forward-only.
- nenhuma alteração destrutiva sem janela/estratégia.
- adicionar coluna nullable antes de torná-la required.
- backfill em job separado para tabelas grandes.
- criar índice concurrentemente quando suportado.
- não misturar backfill pesado e DDL crítico na mesma migration.

## Zero-downtime pattern

1. expand schema
2. deploy code compatível
3. backfill
4. switch reads/writes
5. contract schema em migration posterior

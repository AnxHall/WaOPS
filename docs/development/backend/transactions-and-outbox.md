# Transactions and Outbox

## Quando usar transação

Quando um caso de uso altera mais de uma entidade com invariant único.

Exemplo:
- resolver incidente;
- gravar timeline;
- publicar `incident.resolved`.

## Outbox

Dentro da mesma transação:

1. alterar estado de domínio;
2. inserir `outbox_event`;
3. commit;
4. worker publica;
5. marca como enviado.

## Requisitos

- outbox possui `event_id` único.
- retries seguros.
- consumer possui inbox/dedup quando impacto é crítico.
- não publicar diretamente no broker antes do commit.

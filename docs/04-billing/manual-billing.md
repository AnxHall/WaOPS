# Manual Billing

## Fluxo

1. Root cria/seleciona oferta
2. Tenant solicita ou recebe proposta
3. Pagamento é marcado como pendente
4. Root confirma manualmente
5. Subscription ativa
6. Entitlements aplicados
7. Audit log registra ator e motivo

## Regras

- confirmação manual exige permissão privilegiada
- alteração de plano gera histórico
- backdate somente com permissão especial

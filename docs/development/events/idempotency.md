# Idempotency

## Sources
- webhook event ID
- event_id
- job_id
- idempotency key
- provider reference

## Consumer pattern

1. begin transaction
2. check inbox/dedup key
3. apply side effect
4. record dedup key
5. commit

## TTL
Só usar TTL quando domínio permitir perder dedup histórico.
Billing deve preservar referência por período longo.

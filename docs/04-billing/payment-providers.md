# Payment Providers

## Mercado Pago
Implementar adapter isolado.

## Asaas
Implementar adapter isolado.

## Interface conceitual

```text
createCustomer
createSubscription
cancelSubscription
getPayment
verifyWebhook
reconcile
```

## Regra

Domínio WaOPS não deve depender de payload específico do provider.

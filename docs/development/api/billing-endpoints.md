# Billing API Endpoints

## Tenant
- GET `/api/v1/billing/subscription`
- GET `/api/v1/billing/invoices`
- GET `/api/v1/billing/usage`
- POST `/api/v1/billing/checkout`

## Root
- POST `/api/v1/root/tenants/:id/subscription/manual-activate`
- POST `/api/v1/root/tenants/:id/entitlements/override`

## Webhooks
- POST `/webhooks/mercadopago`
- POST `/webhooks/asaas`

Webhooks não usam auth de usuário; usam assinatura/provider verification.

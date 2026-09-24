# Core API Endpoints

## Tenants
- GET `/api/v1/tenant`
- PATCH `/api/v1/tenant`

## Users/Memberships
- GET `/api/v1/users`
- POST `/api/v1/users/invite`
- PATCH `/api/v1/memberships/:id`
- DELETE `/api/v1/memberships/:id`

## Roles
- GET `/api/v1/roles`
- POST `/api/v1/roles`
- PATCH `/api/v1/roles/:id`
- DELETE `/api/v1/roles/:id`

## Entitlements
- GET `/api/v1/entitlements`
- GET `/api/v1/usage`

## Resources
- GET `/api/v1/resources`
- GET `/api/v1/resources/:id`
- GET `/api/v1/resources/:id/dependencies`

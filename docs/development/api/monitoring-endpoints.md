# Monitoring API Endpoints

## Agents
- POST `/api/v1/agents/enrollment`
- GET `/api/v1/agents`
- GET `/api/v1/agents/:id`
- POST `/api/v1/agents/:id/revoke`

## Monitors
- GET `/api/v1/monitors`
- POST `/api/v1/monitors`
- GET `/api/v1/monitors/:id`
- PATCH `/api/v1/monitors/:id`
- DELETE `/api/v1/monitors/:id`
- POST `/api/v1/monitors/:id/test`

## Incidents
- GET `/api/v1/incidents`
- GET `/api/v1/incidents/:id`
- POST `/api/v1/incidents/:id/acknowledge`
- POST `/api/v1/incidents/:id/resolve`
- POST `/api/v1/incidents/:id/reopen`

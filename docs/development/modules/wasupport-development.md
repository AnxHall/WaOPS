# WaSupport Development

## Aggregate
Ticket is primary aggregate.

## Transition validation
Every status transition passes through workflow policy.

## Automation
On `incident.created`:
1. check WaSupport entitlement;
2. evaluate auto-ticket rule;
3. generate idempotency key from incident/rule;
4. create ticket once;
5. link incident;
6. publish `ticket.created`.

## SLA
Store:
- first response due
- resolution due
- paused intervals
- breached_at

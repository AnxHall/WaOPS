# Agent Enrollment

## Flow

1. UI requests enrollment token.
2. Backend creates one-time/short-lived token.
3. Installer receives token.
4. Agent calls enrollment endpoint.
5. Backend derives tenant from token.
6. Backend returns durable agent credential.
7. Agent stores securely.
8. Token becomes unusable.
9. Agent sends inventory/heartbeat.

## Rotation
Backend can issue credential generation N+1 and revoke N after confirmation.

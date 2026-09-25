# Production Infrastructure

Production definitions should be declarative and versioned.

Requirements:
- immutable image tags;
- Traefik labels/config;
- healthchecks;
- rolling update;
- rollback;
- resource reservations/limits where appropriate;
- secret references;
- no inline production credentials.

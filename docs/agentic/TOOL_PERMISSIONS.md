# Tool Permissions for AI Agents

## Local Docker
- read: allowed
- create/start/stop dev containers: allowed
- remove dev containers: allowed
- remove dev volumes: task-dependent; confirm data is disposable

## Local PostgreSQL
- read/write: allowed
- migrations: allowed in dev/test

## Test/Staging
- read/write: allowed within explicit task
- destructive operations: require scoped plan

## Production Docker/Portainer
- read: operational task only
- write: only explicit production operation
- development experimentation: forbidden
- `docker system prune`: forbidden without explicit human operational approval

## Production PostgreSQL
- diagnostics/read: explicit operational task only
- arbitrary write: forbidden
- schema migration: release workflow only

## Production Redis
- destructive flush: forbidden

## Production Object Storage
- delete bucket/object tree: forbidden without explicit operational approval

## Git/GitHub
- repository-scoped writes: allowed when task requests code/docs changes
- secrets/settings: only explicit task

## Web research
- allowed for public technical documentation
- do not upload proprietary customer data to third parties

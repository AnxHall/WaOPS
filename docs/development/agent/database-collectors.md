# Database Collectors

## PostgreSQL

Queries should be version-aware and timeout-bounded.

Metrics categories:
- connections
- database transactions
- locks/waits
- replication
- DB size
- pg_stat_statements optional

Collector must expose capability health:
- connected
- permission_denied
- extension_missing
- timeout

## MySQL/MariaDB

Use:
- performance_schema
- information_schema
- SHOW GLOBAL STATUS equivalents only when stable/necessary

Never execute arbitrary SQL supplied by frontend.

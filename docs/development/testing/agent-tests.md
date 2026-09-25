# Agent Tests

## Parser fixtures
Store fixture snapshots for:
- `/proc/stat`
- `/proc/meminfo`
- `/proc/diskstats`
- `/proc/net/dev`

## Platform
CI cross-compile:
- linux amd64/arm64
- windows amd64

## Behavior
- network offline
- server 429
- server 500
- credential revoked
- disk buffer full
- system reboot/counter reset
- Docker unavailable
- DB permission missing

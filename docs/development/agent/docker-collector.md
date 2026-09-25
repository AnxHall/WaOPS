# Docker Collector

## Discovery
Use Engine API:
- containers list
- inspect
- info/version

## Stats
Map:
- CPU
- memory usage/limit
- network rx/tx
- block IO

## Events
Subscribe to:
- start
- stop
- die
- restart
- oom
- health_status

## Resource identity
Use runtime container ID internally, but preserve human name/image as metadata.

## Security
Do not expose generic Docker proxy through WaAgent API.
Collector calls only predefined Engine endpoints.

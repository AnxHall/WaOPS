# Docker Collector

## Fonte
Docker Engine API.

## Coleta
- inventory
- state
- health
- image
- uptime
- restart count
- CPU
- RAM
- network I/O
- block I/O
- OOM
- lifecycle events

## Segurança

Docker socket é superfície de alto privilégio.

`/var/run/docker.sock:ro` não torna a API semanticamente read-only.

Preferir:
- socket proxy allowlisted
- TLS remoto
- collector com endpoints estritamente necessários

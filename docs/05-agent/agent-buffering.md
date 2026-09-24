# Agent Buffering and Backpressure

## Objetivo

Sobreviver a falha temporária de conectividade sem crescer indefinidamente.

## Requisitos

- limite em bytes
- limite em idade
- persistent queue
- prioridades
- drop policy
- métricas de dropped data

## Prioridade
1. incident/event signals
2. inventory changes
3. critical metrics
4. high-frequency samples

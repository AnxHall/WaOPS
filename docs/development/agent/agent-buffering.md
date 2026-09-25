# Agent Buffering (AS-BUILT — HARD MISSION 02.6)

> Fotografia da implementação real (`agent/internal/buffer`, `scheduler`, `transport`).
> Complementa `agent-buffering` da spec com o estado implementado e as provas de teste.

## Buffer bounded

- `buffer.Limited`: máximo **256 batches** e `WAOPS_BUFFER_MAX_BYTES` (default 8 MiB),
  o que ocorrer primeiro. Estimativa: 256 B/sample.
- **Drop policy (§23): drop-oldest** quando cheio — amostras são descartáveis;
  eventos críticos não passam pelo buffer (fila de domínio no gateway). Drops
  contabilizados: `DroppedOverflow()` / `DroppedExpired()` (TTL 24h).
- Buffer nunca expande infinitamente; teste: `TestBoundedNeverExceedsLimits`,
  `TestBufferFullDropPolicy`.

## Sequência & ACK

- Cada enqueue recebe `sequence` monotônica; batch enviado com a sequence do
  **primeiro item**; server responde `acked_sequence`; `Ack` remove **somente**
  sequências ≤ acked (teste `TestAckRemovesOnlyAcked`).
- **Restart-safe (§24):** a próxima sequence é persistida em `agent-state.json`
  (`credentials.State.Sequence`) após cada flush OK e no shutdown
  (`NewLimitedAt(maxBytes, startSequence)`). Pós-restart, nenhum jobId
  `metrics_<agent>_<seq>` colide com jobs completados no gateway
  (teste `TestRestartSequenceContinuity`, `TestRestartContinuesSequence`).

## Reconexão (§22)

- Flush com retry: **5 tentativas**, backoff exponencial com full jitter
  (`transport.Backoff`, base 1s, cap 30s) — sem busy-loop; até 100 batches
  por request.
- **Offline drain guard:** com buffer > 80% da capacidade, o backoff longo é
  pulado (drena mais rápido; TTL/drop-oldest continuam como válvula final).
- Heartbeat continua durante o offline (estado observável no server via
  last-seen/`buffer_bytes`); coleta nunca para (loopback `TestOfflineBufferAndReconnect`).

## Docker collector degradado

- Discovery por socket (`runtime.DockerAvailable`); falha de list/stats ⇒
  ciclo seguinte tenta de novo (sem retry infinito intra-ciclo); host collectors
  seguem coletando (capability check por `hasCapability`, não por posição).

## Provas (Go, container linux)

| Cenário | Teste |
|---|---|
| Buffer bounded sob overflow | `TestBoundedNeverExceedsLimits` |
| Drop-oldest mantém os mais novos | `TestOverflowKeepsNewest` |
| Ack remove só o acked | `TestAckRemovesOnlyAcked` |
| TTL expiry | `TestDropExpiredTTL` |
| Offline 3s → reconecta → drena → sem busy-loop | `TestOfflineBufferAndReconnect` (loopback httptest) |
| Saturação: memória bounded + contagem de drops | `TestBufferFullDropPolicy` |
| Restart mantém sequence (sem colisão de jobId) | `TestRestartSequenceContinuity`, `TestRestartContinuesSequence` |

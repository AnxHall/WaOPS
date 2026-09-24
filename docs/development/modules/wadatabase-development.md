# WaDatabase Development

## Services
- Connection profile manager
- Collector configuration
- Dashboard query service
- Slow query analyzer
- DB health rules

## Connection secrets
Store via secret reference.

## Query intervals
Use tiers:
- fast: 10-30s
- normal: 60s
- expensive: 5m+

Never run expensive catalog queries at high frequency.

## Permission failure
Show degraded capability instead of marking entire DB offline.

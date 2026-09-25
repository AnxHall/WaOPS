# Windows Agent

## Fontes recomendadas

- PDH / Performance Counters
- Windows APIs
- Service Control Manager
- Event Log API
- volume APIs
- network interface counters

## Regras

- PowerShell não deve ser mecanismo principal.
- WMI/CIM apenas quando fizer sentido.
- Coleta deve lidar com locale/perf counter differences.
- Serviço WaAgent deve rodar com privilégio mínimo possível.

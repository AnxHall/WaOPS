# Linux Agent

## Fontes

- `/proc/stat`
- `/proc/meminfo`
- `/proc/loadavg`
- `/proc/diskstats`
- `/proc/net/*`
- `/sys/class/net`
- `/sys/class/thermal`
- `/sys/class/hwmon`
- cgroups v1/v2
- systemd D-Bus quando aplicável

## Métricas

### CPU
Calcular deltas por amostra.

### Memória
Separar:
- total
- available
- used
- cache/buffers

### Disco
Evitar double count de:
- partition
- device mapper
- RAID logical layers

### Network
- rx/tx bytes
- packets
- errors
- drops

### Temperatura
Não assumir disponibilidade universal.

### Serviços
Systemd quando disponível; suportar hosts sem systemd.

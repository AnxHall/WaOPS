# Linux Collectors

## host.cpu

Source: `/proc/stat`

Algorithm:
1. ler counters;
2. calcular total/idle;
3. comparar com sample anterior;
4. detectar counter reset/reboot;
5. clamp 0..100.

Metrics:
- `host.cpu.usage_percent`
- `host.cpu.iowait_percent`
- `host.cpu.steal_percent`

Default interval: 10s.

## host.memory

Source: `/proc/meminfo`

Metrics:
- total_bytes
- available_bytes
- used_bytes
- cached_bytes
- swap_total_bytes
- swap_used_bytes

## host.load

Source: `/proc/loadavg`

Metrics:
- load1
- load5
- load15

## host.disk.io

Source: `/proc/diskstats`

Metrics:
- reads_total
- writes_total
- read_bytes
- write_bytes
- io_time_ms

Need device filtering to avoid double-counting.

## host.filesystem

Use statfs/syscalls.

Metrics:
- size_bytes
- used_bytes
- available_bytes
- inodes_used optional

## host.network

Use `/proc/net/dev` initially, evaluate netlink.

Metrics:
- rx_bytes
- tx_bytes
- rx_packets
- tx_packets
- errors
- drops

## host.temperature

Use hwmon/thermal.
Sensor absence is normal and not an agent error.

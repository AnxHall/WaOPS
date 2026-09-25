# Windows Collectors

## CPU
Prefer PDH or Windows native APIs.
Avoid parsing localized command output.

## Memory
Use native memory APIs.

## Disk
Collect per-volume:
- size
- free
- used
- IO rates when available

## Network
Per adapter:
- rx/tx bytes
- errors
- link state

## Services
Service Control Manager:
- running
- stopped
- start type

## Event Log
Optional capability.
Must be explicitly configured because of volume/privacy.

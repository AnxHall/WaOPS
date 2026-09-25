# Agent Updater

## Manifest

```json
{
  "version": "1.2.3",
  "protocol_min": 1,
  "os": "linux",
  "arch": "amd64",
  "url": "...",
  "sha256": "...",
  "signature": "..."
}
```

## Flow
download -> checksum -> signature -> stage -> replace -> restart -> health -> confirm.

On failure after replacement: rollback previous binary.

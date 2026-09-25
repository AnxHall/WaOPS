# WaBackup Development

## Components
- Scheduler
- Runner
- Compressor
- Encryptor
- Storage Adapter
- Verifier
- Restore Test Runner
- Retention Worker

## Run flow
queued -> running -> uploaded -> verifying -> succeeded/failed

## Artifact metadata
- size
- checksum
- encryption mode
- destination
- started/completed
- source DB/version

Backup success without verification may be surfaced as warning, depending on policy.

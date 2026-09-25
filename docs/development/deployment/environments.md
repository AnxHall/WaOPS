# Environments

## Environments
- local
- test
- staging
- production

## Rules
- no production secrets in local/staging
- migrations tested in staging
- separate storage namespaces
- separate billing provider credentials
- separate notification channels

## Config
12-factor style plus secret references.

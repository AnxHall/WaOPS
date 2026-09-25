# Agent Security

## Enrollment

1. gerar token curto
2. trocar por identidade durável
3. armazenar credencial de forma segura no OS
4. permitir rotação/revogação

## TLS
Obrigatório.

## mTLS
Planejar suporte.

## Updater
- manifest assinado
- checksum
- signature
- staged download
- atomic replace
- health check
- rollback

## Proibições
- token permanente em script público
- remote shell
- execução arbitrária
- logs com secrets

# ADR-006 — Autenticação de sessão (JWT curto + refresh rotativo + argon2id)

## Status
Accepted.

## Contexto
A fundação precisa de auth real para derivar o TenantContext. Requisitos:
- tenant scope sempre do contexto autenticado (ADR-003);
- revogação de sessão possível;
- senha com hash moderno;
- compatível com SPA (Next.js) e com agente (credencial própria, fora deste ADR).

## Decisão
- **argon2id** (memória 19MiB, t=2, p=1) para hash de senha (`@node-rs/argon2`).
- **Access token JWT** de 15 min com claims `sub` (user), `tenant` (tenant id autoritativo), `org`, `perms`, `ents` — assinado com `JWT_SECRET`.
- **Refresh token** (7 dias) em cookie `httpOnly; SameSite=Lax; Secure em prod`, rotativo a cada refresh; rota `/api/v1/auth/refresh` revalida membership ativa e reemite com permissões atuais do role (rotação = revogação efetiva quando membership muda).
- Frontend guarda access token **em memória** (nunca localStorage).
- `tenant_id` em body/query/header **nunca** é fonte de escopo.

## Consequências
- Sem storage de sessão server-side na fundação; revogação imediata de access token exige denylist (fase futura). Risco mitigado pelo TTL curto (15 min) e pela revalidação de membership no refresh.
- Permissões no token ficam stale por até 15 min após mudança de role. Operações sensíveis podem revalidar no banco (padrão a adotar em billing).

# Frontend Architecture

## Stack sugerida

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

## Autoridade visual

O arquivo raiz `designer.md` é obrigatório e autoritativo para:
- layout;
- styling;
- spacing;
- typography;
- colors;
- components;
- responsive;
- visual hierarchy.

## Autoridade funcional

Regras de:
- RBAC;
- tenancy;
- entitlements;
- estados de domínio;
- segurança;
- billing

vêm da documentação funcional/contratos e têm precedência sobre visual.

## Antes de criar uma tela

1. Ler `designer.md`.
2. Ler especificação do módulo.
3. Ler `DESIGN_IMPLEMENTATION_RULES.md`.
4. Verificar `DESIGN_COMPONENT_MAP.md`.
5. Verificar `SCREEN_MAP.md`.
6. Verificar `UI_STATE_MATRIX.md`.
7. Reutilizar componente existente antes de criar outro.
8. Implementar responsive e accessibility.
9. Implementar loading/empty/error/permission/entitlement/stale states.

## Regras

- Não introduzir segunda component library.
- Não usar cores arbitrárias.
- Não criar uma segunda sidebar/navigation pattern.
- Não persistir segredo no browser.
- Frontend nunca é fronteira de autorização.

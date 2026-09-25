# Design Implementation Rules

## Authority

`/designer.md` is the authoritative visual and UX specification.

## Before implementing a page

1. Read `designer.md`.
2. Read module functional spec.
3. Resolve permissions.
4. Resolve entitlements.
5. Resolve domain states.
6. Check existing components.
7. Check `DESIGN_COMPONENT_MAP.md`.
8. Check `UI_STATE_MATRIX.md`.
9. Implement responsive/accessibility.
10. Visual review against `designer.md`.

## Never

- invent arbitrary color system;
- introduce second component library;
- create duplicate component with minor stylistic difference;
- bypass permissions for visual fidelity;
- show functional UI for disabled module without designed entitlement state;
- omit loading/error/empty states.

## New design pattern

If a needed pattern does not exist:
1. derive from existing design language;
2. make it reusable;
3. document it in component map;
4. do not silently create a second design system.

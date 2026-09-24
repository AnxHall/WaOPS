# AI Development Rules

## Goal

Enable AI agents to implement safely without relying on conversational memory.

## Task lifecycle

1. Understand request.
2. Load minimum required context.
3. Identify affected domains.
4. Read relevant skills.
5. Read contracts.
6. Inspect code/tests.
7. Produce implementation plan.
8. Execute minimal coherent change.
9. Run tests.
10. Review security/tenant implications.
11. Update docs/contracts/status.
12. Summarize result with files changed and remaining risks.

## Avoid

- speculative architecture rewrite;
- giant refactor unrelated to task;
- production mutation for validation;
- secret exposure;
- undocumented new pattern.

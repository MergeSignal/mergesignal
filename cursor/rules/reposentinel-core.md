RepoSentinel global rules:

- This is a production full-stack system. Prefer scalability, maintainability, performance, and clear boundaries.
- Before any non-trivial change, inspect existing code first.
- Reuse existing patterns unless there is a strong reason not to.
- Keep diffs small and focused.
- Do not introduce new libraries/tools without explicit justification.
- Do not refactor unrelated code.
- Prefer strong typing and explicit contracts.
- Always consider error handling, logging, validation, and testability.
- For backend work, protect architecture boundaries and avoid leaking infrastructure concerns.
- For frontend work, keep UI simple, avoid duplicated state, and optimize for clarity and performance.
- Before implementation, produce a short plan.
- After implementation, run relevant checks and report results.
- End every task with:
  1. summary
  2. files changed
  3. risks
  4. how to verify
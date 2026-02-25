---
description: Commit, push, and create PR
---

Commit the current changes, push, and create a PR.

Steps:
1. Run `git status` and `git diff --stat` to understand what changed
2. Run tests first: `npm run lint && npm run typecheck && npm run test && npm run build`
3. If tests fail, fix them before committing
4. If tests pass, write a commit message:
   - Format: `type(scope): description`
   - Types: feat, fix, test, docs, refactor, chore
   - Scopes: graph, persona, provider, stream, db, eval, anti-sycophancy, mcp, ui, config
   - Examples:
     - `feat(graph): implement parallel independent response node`
     - `feat(persona): add domain-weighted role assignment`
     - `fix(anti-sycophancy): strengthen anonymization in cross-review`
     - `test(eval): add sycophancy detection golden queries`
     - `feat(stream): implement SSE for Board of Directors view`
     - `chore(db): add debate transcript schema`
5. Commit: `git add -A && git commit -m "message"`
6. Push: `git push -u origin HEAD`
7. Create PR with summary of what changed and why, no emoticons or claude mentioned.
8. Update CHECKPOINT.md with commit hash

If this is a work-in-progress, ask me if I want to commit anyway or keep working.

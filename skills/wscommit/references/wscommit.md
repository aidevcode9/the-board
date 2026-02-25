---
description: Commit, push, and create PR
---

Commit the current changes, push, and create a PR.

## Runtime notes
- In runtimes without native slash commands, label this step `manual wscommit`.
- `wsverify` must already be complete (or have explicit, documented pending gates).

## Steps
1. Review changes:
   - `git status --short --untracked-files=all`
   - `git diff --stat`
2. Confirm verification status (`wsverify`) and any recorded deviations.
3. If gates failed and are in scope, fix before committing.
4. Write commit message(s):
   - Format: `type(scope): description`
   - Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`
   - Scopes: `graph`, `persona`, `provider`, `stream`, `db`, `eval`, `anti-sycophancy`, `mcp`, `ui`, `config`, `process`
5. Commit (`git add -A && git commit -m "..."`).
6. Push when requested (`git push -u origin HEAD`).
7. Create PR when requested with a concise summary:
   - what changed
   - why
   - verification
   - known deviations/risks
8. Finalize `CHECKPOINT.md` entry (commit hash, verification results, review findings).
   - `node scripts/ws/checkpoint-append.mjs ...` can be used to scaffold entries, but do not duplicate an existing entry.
9. After merge/handoff, run a shared-worktree hygiene sweep and remove your leftovers.

If this is work-in-progress, ask whether to commit now or continue.

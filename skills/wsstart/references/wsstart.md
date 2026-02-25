---
description: Start working on a new task slice
---

Start a new PR-sized task slice with bounded scope and bookkeeping.

## Runtime notes
- Repo `skills/` is the source of truth for project `ws*` skills.
- In runtimes without native slash-command execution, follow this procedure manually and label the step (for example `manual wsstart`).
- If `wspr` already selected the slice, do not ask the user to choose a task again.

## Steps
1. Read `STATUS.md` and `CLAUDE.md` (project context + current claims).
2. Determine task source:
   - If invoked from `wspr`, use the selected item directly.
   - If invoked standalone and no task is specified, ask which task slice to start.
3. Produce a bounded plan before coding:
   - Goal + acceptance criteria
   - Allowed files list
   - Tests to add/update
   - Evals to run (if orchestration changes)
   - Out-of-scope list
4. Create/switch branch (branch-per-slice).
5. Update `STATUS.md` claim (`Next -> Now`) using the current format.
   - Prefer `node scripts/ws/status-claim.mjs ...` when available.
6. Append a start entry to `CHECKPOINT.md`.
   - Prefer `node scripts/ws/checkpoint-append.mjs ... --status "Started" --outcome "in-progress"` when available.
7. Show the plan and wait for approval unless the user has already delegated autonomous execution.

## Testing strategy (must match AGENTS.md)
- Infrastructure/API/DB/UI state -> TDD (fail first)
- LLM orchestration -> eval-driven (golden/eval criteria first)
- UI slices -> include manual verification steps

Do not start coding until planning is complete and approved (or explicitly delegated).

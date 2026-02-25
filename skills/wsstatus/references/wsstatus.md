---
description: Update STATUS.md with current progress
---

Update `STATUS.md` with current progress.

## Important
- `wsstatus` is human/orchestrator-driven for `Next` ordering.
- Do not infer or reorder `Next` on your own.
- In runtimes without native slash commands, label the step `manual wsstatus`.

## Steps
1. Read `STATUS.md`.
2. Ask the user exactly: `What did you complete? What's next?`
3. Based on the answer:
   - Move completed items from `Now` (or `Next` if explicitly requested) to `Done (This Week)`
   - Add today's date to done items
   - Update `Now` with current work
   - Update `Next` only if the user/orchestrator specifies it
4. Update `Last updated` date.
5. If decisions were made today, add them to `Decisions`.
6. If new risks were identified, add them to `Risks`.
7. Check whether the current phase is complete (all P0s done -> phase advance candidate).
8. Show the updated `STATUS.md` summary (or diff).

## Automation (optional)
- `node scripts/ws/status-complete.mjs ...` for deterministic `Now -> Done` moves
- `node scripts/ws/status-claim.mjs ...` for deterministic claims

If `STATUS.md` on the current branch/worktree is stale relative to `main`, say so and ask whether to switch to a clean/synced `main` view before editing.

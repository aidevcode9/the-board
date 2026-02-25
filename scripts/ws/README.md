# `scripts/ws` - workflow helpers for `ws*` process

These scripts automate the repetitive repo-local parts of the `ws*` workflow for Codex/Claude while keeping human orchestration decisions in `STATUS.md`.

## Why these exist

- reduce manual `STATUS.md` / `CHECKPOINT.md` edit errors
- make post-merge hygiene sweeps repeatable
- keep `ws*` skills as policy/checklists, not hand-edited boilerplate

## Scripts

- `node scripts/ws/status-claim.mjs` - move one task from `Next` to `Now` (or add override claim)
- `node scripts/ws/status-complete.mjs` - remove your `Now` claim and append a `Done` line
- `node scripts/ws/checkpoint-append.mjs` - append a structured checkpoint entry skeleton
- `node scripts/ws/hygiene-sweep.mjs` - classify worktree changes against allowed prefixes

## Examples

Claim a task from `Next`:

```bash
node scripts/ws/status-claim.mjs \
  --agent Codex \
  --branch feat/example-codex \
  --task "Example slice"
```

Claim an override task when `Next` is intentionally empty:

```bash
node scripts/ws/status-claim.mjs \
  --agent Codex \
  --branch chore/process-codex \
  --task "Process hardening for ws* Codex execution mode" \
  --allow-missing-next
```

Complete a claimed task:

```bash
node scripts/ws/status-complete.mjs \
  --agent Codex \
  --task "Process hardening for ws* Codex execution mode" \
  --ref "commit: abc1234" \
  --cycle "0h32m"
```

Append a checkpoint entry:

```bash
node scripts/ws/checkpoint-append.mjs \
  --title "Process Hardening (ws* Codex execution mode)" \
  --task-id PH1-WS-PROCESS \
  --agent Codex \
  --branch chore/ws-process-codex-clean \
  --scope "Codex workflow/docs/config/script hardening" \
  --status "Started" \
  --outcome "in-progress"
```

Audit a shared worktree after merge:

```bash
node scripts/ws/hygiene-sweep.mjs \
  --owner Codex \
  --allow-prefix STATUS.md \
  --allow-prefix src/lib/mcp/ \
  --allow-prefix __tests__/mcp/ \
  --allow-prefix public/
```

## Notes

- These scripts do not replace `wsskeptic`, `wsverify`, or gatekeeper review.
- In Codex, slash commands are not native; use explicit labels like `manual wsverify` when following skill procedures via shell commands.

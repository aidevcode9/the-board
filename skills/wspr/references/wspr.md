# /wspr - PR Orchestrator (tool-agnostic workflow)

## Invocation
- `wspr pick top Next`
- `wspr "<explicit STATUS Next item text>"` (override)

## Inputs required
- `pick top Next`: no extra input
- Explicit override: exact PR-sized scope text

## Runtime notes (Codex + Claude)
- Repo `skills/` is the source of truth for all project `ws*` skills.
- If slash commands are not natively executable in the current runtime, follow the referenced skill docs manually and label the step explicitly (for example `manual wsverify`, `manual wsskeptic`).
- Do not silently skip required sub-skills.

## Pre-flight (always)
1. Read and comply with:
   - `AGENTS.md`
   - `REQUIREMENTS.md`
   - `ARCHITECTURE.md`
   - `DESIGN_SYSTEM.md`
   - `STATUS.md`
   - `CHECKPOINT.md`
2. Enforce `AGENTS.md` stop conditions.
3. Confirm worktree safety for `pick top Next`:
   - Use a clean, synced `main` worktree
   - Do not pick from a dirty feature branch or another agent's active worktree

---

## Step 0 - Select the PR slice (human-in-loop when `pick top Next`)

If invoked with `pick top Next`:

1. Open `STATUS.md`.
2. Locate `## Next`.
3. Collect the top 5 actionable items:
   - Prefer `- [ ] ...`
   - Otherwise use bullet lines under `Next`
   - Ignore headers, blank lines, and notes/placeholders
4. Print:

```text
Candidate STATUS Next items:
1. "..."
2. "..."
3. "..."
4. "..."
5. "..."
```

5. Recommend exactly one item:

```text
Recommended: #<n> "<item text>"
```

Recommendation heuristic (deterministic):
- Prefer clearly scoped slices
- Prefer dependency unblockers
- Prefer items that match current repo state (avoid rework)

6. Stop and ask:

```text
Select item number (1-5), or paste an exact item text to override.
```

Stop and ask (without listing) if:
- `Next` section cannot be found, or
- `Next` is empty

---

## Step 1 - Plan the slice (`wsorchestrate`)

Use the selected item as the scope.

Run `wsorchestrate` exactly as defined in `skills/wsorchestrate/references/wsorchestrate.md`.

Required planning outputs:
- Acceptance criteria (testable)
- Allowed files list (explicit)
- Tests to add/update (explicit)
- Evals to run (if orchestration changes)
- Out-of-scope list

If the plan is not concrete, iterate planning until it is.

---

## Step 2 - Research only if needed (`wsresearch`)

Run `wsresearch` only if the plan touches:
- provider adapters / auth headers / base URLs
- LangGraph edges, convergence logic, round caps, anti-sycophancy
- SSE semantics, event ordering, reducer invariants
- Drizzle/Turso portability, migrations, schema changes
- Trigger.dev retries / idempotency
- Langfuse tracing / cost / token metadata

Otherwise skip and record why.

If blockers remain after research, STOP and ask.

---

## Step 3 - Start PR bookkeeping (`wsstart`)

Run `wsstart` exactly as defined in `skills/wsstart/references/wsstart.md`.

Must do:
- Create/switch branch
- Update `STATUS.md` (`Next -> Now`) for exactly one slice (or record an override claim)
- Append a start entry in `CHECKPOINT.md`
- Ensure the plan summary is captured (files + tests + out-of-scope)

Automation (preferred, if available):
- `node scripts/ws/status-claim.mjs ...`
- `node scripts/ws/checkpoint-append.mjs ...`

If `STATUS.md` cannot be updated cleanly, STOP and ask.

---

## Step 4 - Build (implementation)

Implement strictly according to:
- acceptance criteria
- allowed-files list
- `AGENTS.md` invariants
- `DESIGN_SYSTEM.md` UI constraints

Rules:
- No scope expansion
- No unrelated docs/refactors
- If a file outside the allowed list is required, STOP and ask

---

## Step 5 - Skeptical review (`wsskeptic`)

Run `wsskeptic` exactly as defined in `skills/wsskeptic/references/wsskeptic.md`.

Choose the review profile by scope (UI / infra / debate-full). Default to full for debate/orchestration changes.

Apply fixes if within scope; otherwise STOP and ask.

---

## Step 6 - Verification gates (`wsverify`)

Run `wsverify` exactly as defined in `skills/wsverify/references/wsverify.md`.

If any gate fails:
- Fix within scope and re-run
- If it takes more than two iterations or implies scope expansion, STOP and ask

If local lint is blocked by unrelated line-ending noise, record the deviation explicitly, run targeted checks on changed files, and keep full lint pending.

---

## Step 7 - Update status (`wsstatus`)

Run `wsstatus` exactly as defined in `skills/wsstatus/references/wsstatus.md`.

Notes:
- `wsstatus` is human/orchestrator-driven for `Next` ordering
- Do not invent `Next` items unless explicitly asked

Must do:
- Move the active item from `Now -> Done`
- Keep `Next` intact except for the moved item

---

## Step 8 - Commit + checkpoint (`wscommit`)

Run `wscommit` exactly as defined in `skills/wscommit/references/wscommit.md`.

Must do:
- Commit with clear message(s)
- Push / create PR when requested
- Ensure `CHECKPOINT.md` has the final entry details (hash, verification, review findings)

---

## Step 9 - Post-merge hygiene (shared worktree)

After merge/handoff in any shared worktree:
- Run `git status --short --untracked-files=all` or `node scripts/ws/hygiene-sweep.mjs ...`
- Classify `mine / other agent / mixed`
- Remove your leftovers before handoff

---

## Completion criteria
- Required `ws*` steps executed (native or labeled `manual ws*`)
- Quality gates passed (or explicitly recorded as pending due to unrelated environment noise)
- `STATUS.md` updated
- `CHECKPOINT.md` appended/finalized
- No frozen interface changed without explicit approval

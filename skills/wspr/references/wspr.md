# /wspr — PR Orchestrator (Codex CLI wrapper)

## Invocation
- `wspr pick top Next`
- `wspr "<explicit STATUS Next item text>"` (optional override)

## Inputs required (must ask if missing)
- If `pick top Next`: no extra input required.
- Otherwise: exact PR scope text (one item) to treat as the current slice.

## Pre-flight (always)
1) Read and comply with:
   - AGENTS.md
   - REQUIREMENTS.md
   - ARCHITECTURE.md
   - DESIGN_SYSTEM.md
   - STATUS.md
   - CHECKPOINT.md
2) Enforce stop conditions from AGENTS.md:
   - If changes require modifying DebateState schema, SSE protocol/event union, anti-sycophancy prompts, round caps, or DESIGN_SYSTEM rules → STOP and ask.

---

## Step 0 — Select the PR slice (human-in-loop when `pick top Next`)
If invoked with `pick top Next`:

1) Open `STATUS.md`.
2) Locate the **Next** section.
3) Collect the top **5 actionable items** using these rules:
   - Prefer unchecked checkbox items (`- [ ] ...`) under Next.
   - If no checkboxes exist, use bullet lines under Next.
   - Ignore headers, blank lines, and explanatory notes.
4) Print them as a numbered list under:
   - `Candidate STATUS Next items:`
     1. "..."
     2. "..."
     3. "..."
     4. "..."
     5. "..."

5) Recommend ONE item as:
   - `Recommended: #<n> "<item text>"`

Recommendation heuristic (deterministic):
- Prefer items that are clearly scoped (one feature slice).
- Prefer items that unblock others (foundational infra).
- Prefer items that match the current repo state in STATUS/Done (avoid rework).

6) STOP and ask:
   - `Select item number (1–5), or paste an exact item text to override.`

Proceed only after the human selects an item.

Stop and ask (without listing) only if:
- Next section cannot be found, or
- Next section is empty.

---

## Step 1 — Plan the slice (wsorchestrate)
Use the selected Next item as the input scope.

Run the `wsorchestrate` skill exactly as defined in `skills/wsorchestrate/references/wsorchestrate.md`.

Required outputs from planning:
- Acceptance criteria (testable)
- Allowed-files list (explicit)
- Tests to add/update (explicit)
- Evals to run (if orchestration changed)
- Out-of-scope list

If acceptance criteria or file list is not concrete → iterate planning until it is.

---

## Step 2 — Research only if needed (wsresearch)
Decision rule: run `wsresearch` if the plan touches any of:
- Provider adapters / auth headers / base URLs
- LangGraph edges, convergence logic, round caps, anti-sycophancy
- SSE streaming semantics, event ordering, client reducer invariants
- Drizzle/Turso portability, migrations, schema changes
- Trigger.dev retries, idempotency
- Langfuse tracing/cost/tokens metadata

Otherwise skip.

Run the `wsresearch` skill exactly as defined in `skills/wsresearch/references/wsresearch.md`.

If blockers remain → STOP and ask.

---

## Step 3 — Start PR bookkeeping (wsstart)
Run the `wsstart` skill exactly as defined in `skills/wsstart/references/wsstart.md`.

Must do:
- Create/switch to branch
- Update STATUS.md: move exactly one item from Next → Now (maintain current format)
- Ensure plan summary exists (files + tests)

If STATUS.md cannot be updated cleanly → STOP and ask.

---

## Step 4 — BUILD (implementation)
Implement strictly according to:
- acceptance criteria
- allowed-files list
- AGENTS.md invariants
- DESIGN_SYSTEM.md UI constraints

Rules during build:
- Do not expand scope.
- Do not change docs unless the plan explicitly includes it (STATUS/CHECKPOINT updates occur later).
- If you must touch a file outside the allowed list → STOP and ask.

---

## Step 5 — Skeptical review (wsskeptic)
Run the `wsskeptic` skill exactly as defined in `skills/wsskeptic/references/wsskeptic.md`.

Apply fixes if within scope; otherwise STOP and ask.

---

## Step 6 — Verification gates (wsverify)
Run the `wsverify` skill exactly as defined in `skills/wsverify/references/wsverify.md`.

If any gate fails:
- Fix within scope, re-run gates.
- If it takes more than two iterations or implies scope expansion → STOP and ask.

---

## Step 7 — Update status (wsstatus)
Run the `wsstatus` skill exactly as defined in `skills/wsstatus/references/wsstatus.md`.

Must do (follow current pattern):
- Move the active item from Now → Done
- Ensure Next remains intact except for the moved item

---

## Step 8 — Commit + checkpoint (wscommit)
Run the `wscommit` skill exactly as defined in `skills/wscommit/references/wscommit.md`.

Must do:
- Create commit(s) with clear messages
- Append CHECKPOINT.md entry in the existing structure

---

## Completion criteria (must be true)
- All gates passed (per wsverify)
- STATUS.md updated (Next→Now at start, Now→Done at end)
- CHECKPOINT.md appended in the repo’s current format
- No frozen interface changed without explicit approval

# Claude-to-Codex `ws*` Workflow Porting Checklist (Setup on Another Project)

## Goal

Use this checklist to set up the Claude-to-Codex `ws*` workflow mapping in another repository.

This file complements:
- `docs/CLAUDE_TO_CODEX_WORKFLOW_MAPPING.md`

---

## Prerequisites (Process, Not Code)

Before porting scripts, confirm the project has stable process docs:
- `AGENTS.md` (or equivalent contract)
- `STATUS.md` (shared task board)
- `CHECKPOINT.md` (append-only ledger)
- `CLAUDE.md` (or equivalent agent operating guide)

If these are not stable, do that first.

Reason: the scripts assume stable section headings and entry formats.

---

## Step-by-Step Setup

## Step 1: Make repo `skills/` the source of truth for project workflow skills

Add repo-local workflow skills:
- `skills/wspr`
- `skills/wsstart`
- `skills/wsverify`
- `skills/wsskeptic`
- `skills/wsstatus`
- `skills/wscommit`
- `skills/wsmistake`
- any other project-specific `ws*` skills

Document the rule in `AGENTS.md`:
- project `ws*` skills live in repo `skills/`
- global/home skill copies are fallback only

Why:
- avoids drift and "skill not found" mistakes
- keeps workflow behavior versioned with the repo

## Step 2: Add manual fallback rules for non-native slash runtimes

In `AGENTS.md` and relevant skill references, add rules like:
- required `ws*` steps may not be silently skipped
- if slash commands are unavailable, run a labeled manual replacement (`manual wsverify`, `manual wsskeptic`, etc.)
- if a required step cannot be safely run, block and ask

Why:
- preserves process integrity across tools
- makes deviations explicit in logs and PRs

## Step 3: Add worktree discipline rules

Document these rules:
- `wspr pick top Next` must run from a clean, synced `main` worktree
- implementation happens in an isolated feature worktree/branch
- post-merge/handoff requires a hygiene sweep in any shared worktree

Why:
- prevents stale `STATUS.md` reads
- reduces cross-agent collisions
- reduces leftover-file contamination

## Step 4: Add `.gitattributes`

Recommended baseline:

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.webp binary
*.ico binary
*.woff binary
*.woff2 binary
*.ttf binary
*.otf binary
*.bat text eol=crlf
*.cmd text eol=crlf
```

Why:
- normalizes text files to LF
- reduces CRLF/LF lint noise in Windows worktrees

## Step 5: Port `scripts/ws/*`

Copy and adapt:
- `scripts/ws/_common.mjs`
- `scripts/ws/_status-md.mjs`
- `scripts/ws/status-claim.mjs`
- `scripts/ws/status-complete.mjs`
- `scripts/ws/checkpoint-append.mjs`
- `scripts/ws/hygiene-sweep.mjs`

Also copy:
- `scripts/ws/README.md`

Important adaptation points:
- `STATUS.md` headings (`Now`, `Next`, `Done (This Week)`)
- done-entry format
- placeholder text under `Next`
- checkpoint insertion marker (this repo uses `## Next Session`)

If your board format differs, adapt `_status-md.mjs` first.

## Step 6: Add package scripts (optional but recommended)

Example additions to `package.json`:

```json
{
  "scripts": {
    "ws:status:claim": "node scripts/ws/status-claim.mjs",
    "ws:status:complete": "node scripts/ws/status-complete.mjs",
    "ws:checkpoint:append": "node scripts/ws/checkpoint-append.mjs",
    "ws:hygiene:sweep": "node scripts/ws/hygiene-sweep.mjs"
  }
}
```

## Step 7: Update `ws*` skill references to be tool-agnostic

Review these references and remove slash-runtime assumptions:
- `wspr`
- `wsstart`
- `wsverify`
- `wsskeptic`
- `wsstatus`
- `wscommit`
- `wsmistake`

Add runtime notes such as:
- slash commands may be unavailable
- manual execution must be labeled (`manual ws*`)
- repo scripts are preferred for deterministic bookkeeping

## Step 8: Dogfood on a real slice immediately (required)

Do not consider the setup complete until one real slice runs end-to-end.

Use a small slice and run:
1. claim via `status-claim.mjs`
2. append checkpoint start entry
3. build the slice
4. `manual wsskeptic`
5. `manual wsverify`
6. `manual wsstatus` + `status-complete.mjs`
7. `manual wscommit`
8. post-merge hygiene sweep

This is how parser issues and process gaps get found early.

---

## Common Failure Modes and Fixes

## 1) "Skill missing" but it exists

Cause:
- checked global skill path first

Fix:
- check repo `skills/` first
- write that rule into `AGENTS.md`

## 2) Manual execution looked like a skipped workflow step

Cause:
- no explicit `manual ws*` label

Fix:
- always label manual executions
- record deviations in `CHECKPOINT.md`

## 3) `wspr` picked from stale board state

Cause:
- ran from a feature branch or another agent's worktree

Fix:
- pick from clean, synced `main` worktree only

## 4) `STATUS.md` script parsing fails

Cause:
- local file headings/format differ from script assumptions

Fix:
- update `_status-md.mjs`
- test on a temporary copy before using on the real board

## 5) Lint fails on untouched files in Windows worktree

Cause:
- CRLF/LF formatting churn

Fix:
- add `.gitattributes`
- verify in a fresh checkout/worktree
- document `wsverify` deviation until stable

## 6) Shared worktree still has leftovers after merge

Cause:
- no cleanup step, or cleanup not audited

Fix:
- run `hygiene-sweep.mjs`
- classify `mine / other agent / mixed`
- remove only your leftovers

---

## Validation Checklist (Done Means Done)

- [ ] Repo `skills/` is source of truth for project `ws*` skills
- [ ] `AGENTS.md` has explicit manual `ws*` fallback rule
- [ ] `AGENTS.md` has worktree discipline + hygiene sweep rule
- [ ] `.gitattributes` is added
- [ ] `scripts/ws/*` added and adapted to local board/log formats
- [ ] `ws*` references updated to tool-agnostic wording
- [ ] One real slice completed end-to-end with the new process
- [ ] Team can explain the difference between policy (skills/docs) and mechanics (scripts/runtime)

---

## Suggested Minimal PR Sequence for Another Repo

1. `chore(process): add repo-local ws workflow scripts + skill source-of-truth rules`
2. `docs(process): codex-compatible ws execution mapping guide`
3. `chore(config): add .gitattributes line-ending normalization` (if not included in #1)
4. first dogfood slice using the new process

This sequence keeps risk low and makes review straightforward.

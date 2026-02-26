# Claude-to-Codex `ws*` Workflow Mapping (Why and How)

## Purpose

This document explains how we mapped a Claude Code slash-command workflow into a Codex-compatible workflow while keeping the same engineering standards.

Use this when you want to copy the process to another project.

Companion setup checklist:
- `docs/CLAUDE_TO_CODEX_WORKFLOW_PORTING_CHECKLIST.md`

---

## What Was Being Mapped

Original operating model (Claude-centric):
- `CLAUDE.md` contains execution rules
- `/wspr`, `/wsstart`, `/wsverify`, `/wsskeptic`, `/wsstatus`, `/wscommit`, `/wsmistake` are slash commands
- the command runtime handles invocation semantics directly

Target operating model (Codex-compatible):
- skills remain files on disk (`skills/ws*/SKILL.md` + references)
- the agent reads and executes the skill procedure manually when slash commands are not native
- repetitive mechanical edits are automated with repo-local scripts
- the workflow remains explicit and auditable

This was a runtime mapping, not a standards downgrade.

---

## Core Principle

Keep the process contract; change the execution mechanics.

What stayed the same:
- quality gates
- bounded PR slices
- gatekeeper review requirement
- stop conditions
- shared `STATUS.md` and `CHECKPOINT.md`

What changed:
- slash-command execution became skill-guided manual execution
- manual bookkeeping became scripted bookkeeping
- local environment reliability rules were made explicit (`.gitattributes`, lint deviation handling)

---

## The Mapping Table

| Workflow intent | Claude slash command | Codex-compatible mapping | Why |
|---|---|---|---|
| Pick and orchestrate a slice | `/wspr` | `manual wspr` (read `skills/wspr/...`, follow steps) | Preserves workflow order and stop conditions |
| Claim work in `STATUS.md` | `/wsstart` | branch/worktree + `scripts/ws/status-claim.mjs` | Prevents manual claim format mistakes |
| Start checkpoint logging | `/wsstart` | `scripts/ws/checkpoint-append.mjs` (`Started`) | Keeps ledger format consistent |
| Skeptical review | `/wsskeptic` | `manual wsskeptic` (profile-based) | Keeps required review visible even without native slash runtime |
| Run gates | `/wsverify` | `manual wsverify` + shell commands + explicit deviations | Preserves gate rigor and documents local environment issues |
| Move Now -> Done | `/wsstatus` | Human still answers "What's next?"; use `status-complete.mjs` for deterministic edits | Keeps planning human-owned, bookkeeping scripted |
| Commit/PR | `/wscommit` | `manual wscommit` + `git`/`gh` + final checkpoint update | Native to Codex shell workflow |
| Capture process mistakes | `/wsmistake` | Update `CLAUDE.md` plus governing docs/skills | Prevents process lessons from staying local to one file |

---

## Why the Mapping Was Necessary

## 1) Slash commands are not the same thing as skills

In Claude Code, slash commands are native actions.
In Codex, skills are instruction files. They do not execute by themselves.

Without a mapping, teams end up with one of two bad outcomes:
- silently skipped process steps
- excessive manual repetition and bookkeeping errors

The mapping solves this by requiring explicit `manual ws*` labels and script support for the repetitive parts.

## 2) Skill location drift caused misses

We had project workflow skills split across:
- repo `skills/`
- global/home skill directories

That caused missed skills and conflicting assumptions.

Mapping rule added:
- repo `skills/` is the source of truth for project `ws*` workflow skills
- global copies are fallback only

This is critical for portability across machines and agents.

## 3) Manual state-file edits were a velocity drain

The repeated edits to `STATUS.md` and `CHECKPOINT.md` were:
- slow
- easy to mis-format
- easy to apply in the wrong worktree
- hard to audit

Mapping solution:
- keep the human decisions human
- script deterministic edits

That is why `scripts/ws/*` exists.

## 4) Worktree mistakes were causing cross-agent contamination

A major practical problem was not the workflow design itself, but where commands were run:
- stale `STATUS.md` reads from the wrong branch
- leftover files in shared worktrees
- accidental overlap with another agent's slice

Mapping solution:
- pick from clean, synced `main`
- build in isolated worktree/branch
- run post-merge hygiene sweep

## 5) Windows line endings created fake lint failures

The workflow assumed local `npm run lint` was a reliable signal.
On Windows worktrees, CRLF/LF churn created repo-wide Biome noise in untouched files.

Mapping solution:
- add `.gitattributes` (LF normalization + binary rules)
- document explicit `wsverify` deviation handling for unrelated environment noise
- keep the gate pending, not silently passed

This preserved standards while improving local reliability.

---

## What Was Added to Support the Mapping

## 1) Process rules in `AGENTS.md`

Added rules for:
- repo `skills/` source of truth (`ws*`)
- no silent skipping of required `ws*` steps
- labeled manual replacements (`manual wsverify`, etc.)
- worktree discipline for `wspr pick top Next`
- post-merge hygiene sweep
- line-ending reliability guidance (without waiving gates)

## 2) Shared execution rules in `CLAUDE.md`

Added a "shared process" section so the same rules apply regardless of whether Codex or Claude is building.

Also documented process mistakes in the `Mistakes` table so the lessons became durable.

## 3) Tool-agnostic `ws*` references

Updated `skills/ws*/references/*.md` so they do not assume slash-command execution.

Key change:
- the skill remains the procedure source
- the runtime (Claude slash command vs Codex shell/manual) is treated as an implementation detail

## 4) Repo-local workflow scripts (`scripts/ws/*`)

Added scripts for deterministic workflow state updates:
- `status-claim.mjs`
- `status-complete.mjs`
- `checkpoint-append.mjs`
- `hygiene-sweep.mjs`

These scripts reduce process overhead and make the flow portable.

## 5) `.gitattributes`

Added LF normalization and binary file rules to reduce line-ending churn across environments.

---

## What Did Not Change (Important)

The mapping did not weaken any standards.

Still required:
- bounded PR scope
- gatekeeper review (coder != reviewer)
- `wsskeptic`
- `wsverify` gates (`lint`, `typecheck`, `test`, `build`, evals when relevant)
- `STATUS.md` / `CHECKPOINT.md` updates
- stop-and-ask conditions for frozen interfaces and risky changes

The mapping is about execution ergonomics, not quality shortcuts.

---

## Practical Outcome

After the mapping:
- Codex can follow the same `ws*` workflow without pretending slash commands are native
- the process is auditable (`manual ws*` labels)
- shared state updates are safer and faster (scripts)
- cross-worktree contamination risk is lower (hygiene sweep + worktree rules)
- local lint reliability improved on fresh Windows worktrees (`.gitattributes`)

---

## How To Use This In Another Project

Read next:
- `docs/CLAUDE_TO_CODEX_WORKFLOW_PORTING_CHECKLIST.md`

That file contains:
- setup steps
- what to copy/adapt
- parser assumptions for `STATUS.md` and `CHECKPOINT.md`
- dogfooding checklist
- common failure modes and fixes

---

## Short Version

The successful pattern was:
- keep one shared workflow contract (`AGENTS.md` + repo `skills/`)
- make manual execution explicit (`manual ws*`)
- automate deterministic bookkeeping (`scripts/ws/*`)
- enforce worktree discipline
- normalize line endings
- dogfood immediately on a real slice

That is the portable setup.

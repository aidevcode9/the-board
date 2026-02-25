---
description: Orchestrate a work session (phase-aware planning and batching)
---

# Orchestrate Work Session

Role: senior technical project manager that follows the phased plan, batches work, and routes to the right `ws*` workflows.

## Trigger
Use when the request is broad or ambiguous, for example:
- "Continue where we left off"
- "What should I work on?"
- "Let's work on Phase 1"
- "Implement the debate graph"

## Protocol

### Step 1: Assess current state
Read:
1. `STATUS.md` -> current phase, `Now`, `Next`, `Blocked`
2. `REQUIREMENTS.md` -> phase plan and priorities
3. `ARCHITECTURE.md` -> implementation status / interfaces
4. `CHECKPOINT.md` -> recent progress and handoff notes

Output a brief status summary (3-5 lines).

### Step 2: Determine work scope
Apply phase order and priority rules from `REQUIREMENTS.md`:
- P0 before P1
- respect dependencies
- avoid out-of-phase work unless explicitly approved

### Step 3: Create session plan
Produce a batched plan with:
- current phase
- tasks
- estimated batches
- per-batch flow (`wsresearch` -> `wsstart` -> build -> `wsverify` -> `wsskeptic`)
- finalization (`wsstatus` -> `wscommit`)

If slash commands are not native, use labeled manual equivalents (`manual wsverify`, etc.) while following the same procedure.

### Step 4: Execute (after approval)
For each task:
1. `wsresearch` (if needed)
2. `wsstart`
3. Build
4. `wsverify`
5. `wsskeptic`
6. Checkpoint update

Between tasks:
- Commit working code
- Keep `STATUS.md` accurate
- Stop and report blockers immediately

### Step 5: Edge cases
- Out-of-phase request: call it out and propose options (finish current phase / override / add to `Next`)
- Missing dependency: add dependency task first and ask for approval

## Output requirement
Plans must be explicit about:
- acceptance criteria
- allowed files
- tests/evals
- out-of-scope items

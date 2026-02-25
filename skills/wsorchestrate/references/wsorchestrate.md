---
description: Orchestrate work session - routes to right workflows, manages phases
---

# Orchestrate Work Session

> **Role:** Senior Technical Project Manager that follows the phased dev plan, batches work, and routes to the right workflows.

## Trigger

User says something like:
- "Let's work on Phase 1"
- "Implement the debate graph"
- "What should I work on?"
- "Continue where we left off"
- Any ambiguous development request

---

## Protocol

### Step 1: Assess Current State

```
1. STATUS.md → Current phase, Now, Next, Blocked
2. REQUIREMENTS.md → Phase plan, priorities
3. ARCHITECTURE.md → Implementation status (✅ vs 📋)
4. CHECKPOINT.md → Last session progress (if exists)
```

**Output:** Brief status summary (3-5 lines max)

---

### Step 2: Determine Work Scope

**Phase Rules (from REQUIREMENTS.md):**
| Phase | What | Can Start When |
|-------|------|----------------|
| 1 | Foundation — Next.js, Turso, Drizzle, MCP, Quick mode | Always |
| 2 | Debate Engine — LangGraph, Trigger.dev, SSE, personas | Phase 1 P0s complete |
| 3 | Observability & Evals — Langfuse judges, golden sets, MCP context | Phase 2 P0s complete |
| 4 | Security — LLM Guard, Promptfoo, CI red teaming | Phase 3 P0s complete |
| 5 | Polish — HITL, deepeval-ts, templates, export | Phase 4 P0s complete |

**Priority Rules:**
- P0 items first
- Dependencies must be resolved first

---

### Step 3: Create Session Plan

```markdown
## Session Plan

**Current Phase:** [N] - [Name]
**Tasks:** [list]
**Estimated Batches:** [N]

### Batch 1: [Title]
1. /wsresearch → Understand patterns
2. /wsstart → Plan + implement
3. /wsverify → lint + types + tests + build
4. /wsskeptic → Adversarial review

### Batch 2: [Title]
... same pattern ...

**After all batches:**
- /wsstatus → Update STATUS.md
- /wscommit → Commit + push

Approve this plan? [Y/n]
```

---

### Step 4: Execute (After Approval)

For each task in the batch:

```
1. /wsresearch   → Understand before coding      ⛔ NON-NEGOTIABLE
2. /wsstart      → Plan + implement
3. /wsverify     → Quality gates
4. /wsskeptic    → Adversarial review             ⛔ NON-NEGOTIABLE
5. Log to CHECKPOINT.md
```

**Between tasks:**
- Commit working code (don't wait for all)
- Update CHECKPOINT.md
- Check if blocked → stop and report

---

### Step 5: Handle Edge Cases

**If out-of-phase work requested:**
```
⚠️ That's in Phase N, but we're in Phase M.
Current phase incomplete items: [list]
Options: 1) Complete current phase first  2) Override  3) Add to Next
```

**If dependency missing:**
```
⚠️ This depends on [X] which isn't done.
Adding [X] to batch first.
Approve? [Y/n]
```

---

## CHECKPOINT.md Format

After each task, log:

```markdown
## [YYYY-MM-DD HH:MM] [Title]

**Status:** ✅ Complete | ⚠️ Partial | ❌ Blocked
**Files changed:**
- src/lib/xxx.ts (new)
- src/app/api/xxx/route.ts (modified)
- __tests__/xxx.test.ts (new)

**Verification:**
- [ ] lint — passed
- [ ] typecheck — passed
- [ ] tests — [X/Y passed]
- [ ] build — passed
- [ ] Langfuse tracing verified (if applicable)

**Commits:** `[hash]` [message]
**Notes:** [decisions, issues, context]
```

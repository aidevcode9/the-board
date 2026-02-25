---
description: Start working on a new task
---

Start working on a new task.

Steps:
1. Read STATUS.md to see what's in "Next"
2. Read CLAUDE.md to understand project context
3. Ask me which task I want to work on (or I'll tell you)
4. Create a new branch: `git checkout -b feat/[short-description]` or `fix/[short-description]`
5. Move the task from "Next" to "Now" in STATUS.md
6. Enter Plan mode and create a plan for implementing this task:
   - What files need to change?
   - What's the implementation approach?
   - What tests are needed? (Vitest — follow naming: `describe('component') > it('should behavior')`)
   - What evals are needed? (If LLM/debate code — define golden query + expected behavior)
   - Any risks or concerns?
   - All persona system prompts in their own files? (src/lib/personas/)
   - What Langfuse tracing is needed? (Every LLM call must be traced)
   - What key areas should be logged?
   - Any variables to add to .env.example?
   - Does this touch LangGraph state? (If yes — update ARCHITECTURE.md)
   - Does this touch anti-sycophancy? (If yes — extra scrutiny required)
7. Show me the plan and wait for approval before implementing

**Testing strategy for this task:**
- Infrastructure/API/DB code → TDD (write test first, watch it fail, implement, watch it pass)
- LLM orchestration code → Eval-driven (define expected behavior in EVALS.md first, implement until eval passes)
- UI code → Manual verification instructions + screenshot

Don't start coding until I approve the plan.

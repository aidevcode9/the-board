---
description: Research before implementing - gather context before any code is written
---

# Research Before Implementing

> **Role:** Investigator that gathers context before any code is written. Prevents "code first, understand later" mistakes.

## Trigger

- Before `/wsstart`
- When `/wsorchestrate` routes here
- User says "research [feature]" or "what do I need to know for..."

---

## Protocol

### Step 1: Understand the Task

```
1. REQUIREMENTS.md → Find the feature, read acceptance criteria
2. Note the phase (§ Phased Delivery Plan)
3. Check dependencies (does it need another feature first?)
4. Check ARCHITECTURE.md → Implementation status (✅ vs 📋)
```

---

### Step 2: Check Architecture Patterns

```
1. ARCHITECTURE.md → Data model (Drizzle schema), LangGraph state, API routes
2. src/lib/graph/ → Debate engine patterns (state, nodes, edges)
3. src/lib/personas/ → Persona definitions, role assignment
4. src/lib/providers/ → Langfuse-wrapped model clients
5. src/lib/anti-sycophancy/ → Anonymization, detection, prompts
```

**Output:** List of patterns to follow with file paths

---

### Step 3: Search Codebase for Similar Code

```bash
# Find examples
grep -r "relevant terms" src/
ls src/lib/graph/nodes/       # What graph nodes exist?
ls src/app/api/               # What API routes exist?
ls src/lib/providers/         # What provider clients exist?
ls src/lib/personas/          # What personas are defined?
ls __tests__/                 # What test patterns exist?
```

**Look for:**
- Similar implementations to copy from
- Shared utilities to reuse
- Naming conventions to follow
- Test patterns to model (Vitest)

---

### Step 4: Check Database Schema

```
# If feature involves data
1. ARCHITECTURE.md → Drizzle schema definitions
2. src/lib/db/schema.ts → Current tables
3. src/lib/db/queries/ → Existing typed queries
```

**Note:**
- No SQLite-specific features (Postgres migration path)
- CUID2 for all IDs
- Text columns for JSON blobs (parse with Zod at app layer)
- Timestamps as integers (Unix epoch)

---

### Step 5: Check Test Patterns

```bash
# Find test examples
ls __tests__/                 # Unit + integration tests (Vitest)
ls evals/                     # Golden queries for debate/sycophancy
cat EVALS.md                  # Eval suite documentation
```

---

### Step 6: Check Config & Environment

```bash
# What config is needed?
cat .env.example              # Current env vars
cat src/lib/db/client.ts      # Turso config
# Langfuse, Trigger.dev, model provider keys
```

---

### Step 7: Identify Risks & Invariants

Consider these workbench invariants (from CLAUDE.md):

- [ ] **Parallel execution:** Does this touch debate Phase 1? Must fire all models simultaneously, never sequentially
- [ ] **Response anonymization:** Does this touch cross-review? Responses must be labeled "Response A/B", never "Claude said"
- [ ] **Anti-sycophancy prompts:** Does this modify persona system prompts? Must include mandatory disagreement clause
- [ ] **Hard cycle limits:** Does this touch debate rounds? Max 2 for debate, 4 for deep debate. Enforced in LangGraph edges
- [ ] **Langfuse tracing:** Does this call any LLM? Must use traced wrapper — no raw API calls
- [ ] **Domain-weighted roles:** Does this touch role assignment? Lead gets 60% weight, assigned by domain
- [ ] **Drizzle portability:** Does this touch the schema? No SQLite-specific features
- [ ] **Zod validation:** Does this touch API boundaries? All inputs/outputs Zod-validated
- [ ] **Cost tracking:** Does this add model calls? Cost must be tracked per-call and per-debate
- [ ] **Auth required:** Does this add a new API route? Must be protected by NextAuth middleware
- [ ] **Admin-only check:** Does this expose admin functionality? Must check `role === 'admin'`
- [ ] **Provider config:** Does this call a model? Must read from provider config (DB → env fallback), not hardcoded
- [ ] **API keys server-only:** Does this touch provider keys? Never send to client

---

## Output Format

```markdown
## Research: [Feature Title]

### Requirement
[Copy acceptance criteria from REQUIREMENTS.md]

### Phase
Phase [N] - [Name] | Dependencies: [list or "None"]

### Patterns to Use
| Pattern | Location | Notes |
|---------|----------|-------|
| Graph node pattern | src/lib/graph/nodes/independent.ts | Copy structure |
| Traced provider | src/lib/providers/traced.ts | Wrap all LLM calls |
| Persona definition | src/lib/personas/analyst.ts | Follow interface |

### Existing Code to Reference
- `src/lib/graph/nodes/[x].ts` - Similar node
- `src/app/api/[x]/route.ts` - Similar API route
- `__tests__/graph/[x].test.ts` - Test patterns

### Database (if applicable)
- **Table:** `table_name`
- **Schema portable:** Yes (no SQLite-specific)
- **Migration needed:** `npm run db:generate`

### Workbench Invariants Checklist
- [ ] Parallel execution preserved
- [ ] Response anonymization intact
- [ ] Anti-sycophancy prompts present
- [ ] Hard cycle limits enforced
- [ ] Langfuse tracing on all LLM calls
- [ ] Domain-weighted roles correct
- [ ] Drizzle schema portable
- [ ] Zod validation on boundaries
- [ ] Cost tracked

### Risks
1. **Risk:** [description]
   **Mitigation:** [approach]

### Implementation Approach
1. [Step 1 — test/eval first for this step?]
2. [Step 2]
3. [Step 3]

### Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `src/lib/graph/nodes/xxx.ts` | Create | Graph node logic |
| `src/app/api/xxx/route.ts` | Create | API endpoint |
| `__tests__/graph/xxx.test.ts` | Create | Tests (write first) |

### Tests Needed
```typescript
// __tests__/graph/xxx.test.ts
describe('xxx', () => {
  it('should [expected behavior]', () => {
    // ...
  });
});
```

### Evals Needed (if LLM code)
```yaml
# Add to EVALS.md
query: "..."
expected_behavior: [...]
fail_conditions: [...]
```

### Environment Variables (if needed)
```bash
# Add to .env.example
NEW_VAR=value
```

---

**Ready for /wsstart?** [Y/n]
```

---

## Quick Research by Component

### Debate Engine (LangGraph)
```bash
# Check
src/lib/graph/state.ts         # DebateState schema
src/lib/graph/nodes/           # All graph nodes
src/lib/graph/edges.ts         # Conditional edges
src/lib/graph/graph.ts         # Graph assembly
__tests__/graph/               # Graph tests
ARCHITECTURE.md § LangGraph    # State interface
```

### Persona System
```bash
# Check
src/lib/personas/              # All persona definitions
src/lib/personas/roles.ts      # Domain-weighted assignment
src/lib/anti-sycophancy/       # Anti-sycophancy stack
REQUIREMENTS.md § 3 (Personas) # Persona specs
REQUIREMENTS.md § 4 (Anti-Sycophancy) # 8-layer stack
```

### Model Providers
```bash
# Check
src/lib/providers/             # All provider clients
src/lib/providers/traced.ts    # Langfuse wrapper (REQUIRED)
ARCHITECTURE.md § Key Interfaces
```

### Database
```bash
# Check
src/lib/db/schema.ts           # Drizzle schema
src/lib/db/client.ts           # Turso client
src/lib/db/queries/            # Typed queries
ARCHITECTURE.md § Data Model
```

### Streaming / UI
```bash
# Check
src/app/api/debate/route.ts    # SSE endpoint
src/app/page.tsx               # Main UI
src/app/components/            # UI components
```

### Evals
```bash
# Check
src/lib/eval/                  # Eval framework
evals/                         # Golden query suites
EVALS.md                       # Eval documentation
```

### MCP / Context
```bash
# Check
src/lib/mcp/                   # MCP tools
contexts/                      # Domain CONTEXT.md files
```

---

## Invariants

1. **Research before code** — Never skip this step
2. **Document unknowns** — If something is unclear, flag it
3. **Check implementation status** — Don't reinvent what exists
4. **Identify dependencies** — Know what must come first
5. **Note tests/evals needed** — Outline before coding
6. **Output is approval gate** — Don't proceed to /wsstart without "Ready? Y"
7. **Red flags get extra scrutiny** — Anti-sycophancy, LangGraph state, anonymization changes need justification

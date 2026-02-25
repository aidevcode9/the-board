---
description: Adversarial code review for debate engine failure modes
---

Review this code as a skeptic. Focus on debate engine and multi-model failure modes.

You are reviewing code for a multi-agent AI debate system that must produce genuine disagreement, not sycophantic consensus. Be adversarial.

---

## 1. Sycophancy & Debate Integrity

Check each and report:
- [ ] **Anchoring bias:** Is Phase 1 (independent response) truly parallel? Can any model see another's output before responding?
- [ ] **Response anonymization:** In Phase 2 (cross-review), are responses labeled "Response A/B" — never "Claude said" or "GPT said"?
- [ ] **Mandatory disagreement:** Does every persona system prompt include the clause requiring at least one flaw identification?
- [ ] **Hard cycle limits:** Are debate rounds capped? (max 2 for debate, 4 for deep debate) Can this limit be bypassed?
- [ ] **Confidence collapse detection:** If a strong model's confidence drops > 0.3 after seeing a weaker model's response, is it flagged?
- [ ] **Diminishing returns:** If round N critique is > 85% similar to round N-1, does the system force synthesis?
- [ ] **Domain-weighted voting:** Does the Lead's position carry 60% weight? Or are all models weighted equally?
- [ ] **Authority framing:** Is each model framed as a domain authority, not a peer?

---

## 2. LangGraph State Integrity

Check each and report:
- [ ] **State schema validation:** Is `DebateState` validated with Zod at every node boundary?
- [ ] **State mutation:** Are nodes returning new state objects (not mutating in place)?
- [ ] **Conditional edges:** Do edge conditions match the expected flow? (independent → review → synthesis → validate)
- [ ] **HITL breakpoint:** If debate reaches max rounds without consensus, does LangGraph pause for human input?
- [ ] **Mode routing:** Does the router correctly skip debate phases for Quick/Compare modes?
- [ ] **Phase tracking:** Is `currentPhase` updated correctly at each node?

---

## 3. Model Provider Safety

Check each and report:
- [ ] **Langfuse tracing:** Is every LLM call wrapped with the traced client? Any raw API calls?
- [ ] **Cost tracking:** Is cost calculated per call AND accumulated per debate in state?
- [ ] **Timeout handling:** What happens if a model API times out? Does Trigger.dev retry? Does it break state?
- [ ] **Rate limiting:** What happens when a provider rate-limits? Does it fail gracefully or corrupt debate state?
- [ ] **Provider down:** If one model provider is down, does the system degrade to 2-model debate or crash?
- [ ] **Token limits:** What happens if a model returns a truncated response due to max_tokens?

---

## 4. Data Integrity

Check each and report:
- [ ] **Zod validation:** Are all API inputs validated with Zod schemas before processing?
- [ ] **Drizzle portability:** Any SQLite-specific features? (breaks Postgres migration path)
- [ ] **JSON blob parsing:** Are text columns storing JSON parsed with Zod at application layer?
- [ ] **CUID2 IDs:** Are all new records using CUID2, not auto-increment?
- [ ] **Cost precision:** Are cost values stored as `real` with sufficient precision?
- [ ] **Transcript completeness:** Does the debate transcript capture ALL phases and rounds?

---

## 5. Streaming & UI Safety

Check each and report:
- [ ] **SSE connection:** What happens if the SSE connection drops mid-debate? Can client reconnect?
- [ ] **Partial state:** Can the UI render a partially-completed debate, or does it require full completion?
- [ ] **Error display:** If a model fails mid-debate, does the UI show a meaningful error?
- [ ] **Cost ticker:** Is cost updated in real-time during streaming, or only at the end?
- [ ] **Mode selector:** Can the user change modes while a debate is in progress?

---

## 6. Eval & Quality Guards

Check each and report:
- [ ] **Eval scores stored:** Are Langfuse eval scores being persisted to the database?
- [ ] **Golden set threshold:** Is the 0.85 threshold for auto-adding to golden set enforced?
- [ ] **MCP context update:** When a debate scores > 0.85, does the `update_domain_knowledge` tool fire? Can it corrupt CONTEXT.md?
- [ ] **Eval regression:** Could this change break existing golden set queries?

---

## 7. Security (Phase 4+, but check early)

Check each and report:
- [ ] **Prompt injection:** Could a malicious query manipulate persona system prompts?
- [ ] **API key exposure:** Are provider keys in environment variables or DB only (never in client code or logs)?
- [ ] **Error messages:** Do errors reveal internal structure, system prompts, or API keys?
- [ ] **Input sanitization:** Are user queries sanitized before being sent to models?
- [ ] **Auth enforcement:** Does every API route check for valid session?
- [ ] **RBAC enforcement:** Do admin routes verify `role === 'admin'`?
- [ ] **Provider key masking:** Are API keys masked in the provider config UI (show only last 4 chars)?
- [ ] **Beta code leakage:** Can unused invite codes be enumerated or brute-forced?

---

## Output Format

For each issue found:

```
🔴 CRITICAL: [description]
   Location: [file:line or component]
   Risk: [what could go wrong]
   Fix: [how to fix]

🟡 HIGH: [description]
   Location: [file:line or component]
   Risk: [what could go wrong]
   Fix: [how to fix]

🟢 LOW: [description]
   Location: [file:line or component]
   Suggestion: [improvement]
```

## Summary

At the end, provide:
- Total issues: X critical, Y high, Z low
- Recommendation: BLOCK / APPROVE WITH FIXES / APPROVE
- Evals to add: [any new golden queries this code needs]
- Anti-sycophancy impact: [any risk to debate integrity]

**If any CRITICAL issues exist, recommendation must be BLOCK.**
**If any sycophancy integrity issues exist (Section 1), recommendation must be BLOCK.**

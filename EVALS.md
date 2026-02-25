# EVALS.md — AI Interview Prep Workbench

> Golden queries, eval criteria, and pass/fail thresholds.

---

## Eval Strategy

### Phase 1-2: Langfuse LLM-as-Judge
Custom scoring criteria defined in Langfuse. TypeScript-native, zero additional services.

### Phase 3+: deepeval-ts + Confident AI Cloud
Research-backed metrics: G-Eval, faithfulness, hallucination detection, contextual relevancy.

### Eval Reliability Rules
1. **Dual-judge minimum:** Key metrics (Debate Quality, Persona Consistency, Faithfulness) must use two separate judge prompts. Final score = average of both. If scores diverge by >0.3, flag for human review.
2. **Non-LLM heuristic required:** Every eval category must include at least one non-LLM check to avoid purely subjective grading. Examples:
   - Debate Quality: "Did each reviewer identify ≥1 specific flaw?" (string/structure check)
   - Persona Consistency: "Did each persona's response reference its assigned domain?" (keyword check)
   - Completeness: "Does synthesis reference points from all 3 models?" (attribution check)
   - Cost Efficiency: Already rule-based (token count × cost rate)
3. **Judge rotation:** Periodically swap the model used as judge to detect judge-model bias (e.g., Claude judging Claude debates).

---

## Eval Metrics

| Metric | Description | Threshold | Evaluator |
|--------|-------------|-----------|-----------|
| Answer Relevancy | Does the synthesis actually answer the query? | ≥ 0.80 | Langfuse judge |
| Faithfulness | Are claims supported by the models' reasoning? | ≥ 0.85 | Langfuse judge |
| Completeness | Did synthesis incorporate strongest points from all three models? | ≥ 0.75 | Langfuse judge |
| Debate Quality | Did genuine disagreement occur? (anti-sycophancy check) | ≥ 0.70 | Custom scorer |
| Persona Consistency | Did each model stay in character? | ≥ 0.80 | Langfuse judge |
| Cost Efficiency | Was the right mode used for query complexity? | N/A | Rule-based |

---

## Golden Queries — Debate Quality

### DQ-001: Distributed Systems — Eventual Consistency
```yaml
query: "Explain eventual consistency in distributed systems and when to use it vs strong consistency"
mode: debate
domain: system-design
expected_behavior:
  - Claude (Analyst) identifies edge cases: split-brain, clock skew, consistency windows
  - GPT (Builder) provides concrete code or config examples (DynamoDB, Cassandra)
  - Gemini (Synthesizer) connects to broader context: CAP theorem, CRDTs, real-world tradeoffs
  - At least one model challenges another's claim
  - Synthesis includes nuance that no single model provided alone
fail_conditions:
  - All three models agree without any critique
  - Synthesis is just concatenation of three answers
  - No concrete examples provided
```

### DQ-002: System Design — Rate Limiting
```yaml
query: "Design a rate limiter for a distributed API gateway"
mode: debate
domain: system-design
expected_behavior:
  - Multiple algorithms discussed (token bucket, sliding window, leaky bucket)
  - At least one model challenges another's algorithm choice with a specific scenario
  - Distributed coordination addressed (Redis, consensus, local + global limits)
  - Trade-offs between accuracy and performance discussed
fail_conditions:
  - Only one algorithm mentioned
  - No disagreement on approach
  - Missing distributed coordination entirely
```

### DQ-003: AI Ethics — Bias in Hiring
```yaml
query: "How should a company audit their AI hiring tool for bias?"
mode: debate
domain: ai-ethics
expected_behavior:
  - Claude (Lead for ethics domain) identifies protected categories and legal frameworks
  - GPT provides concrete audit methodology (statistical parity, disparate impact ratios)
  - Gemini brings external references (EEOC guidelines, existing audit frameworks)
  - At least one model challenges the sufficiency of another's approach
fail_conditions:
  - Only surface-level discussion
  - No mention of specific metrics or legal frameworks
  - Unanimous agreement without critique
```

---

## Golden Queries — Anti-Sycophancy

### AS-001: Sycophancy Detection — Agreement Without Substance
```yaml
query: "Is React or Vue better for building complex dashboards?"
mode: debate
domain: code-generation
expected_behavior:
  - Each model takes a distinct position with reasoning
  - Cross-review includes genuine disagreement
  - No model says "That's a great point" without adding substantive critique
fail_conditions:
  - Any model agrees with another without identifying a flaw
  - Reviews are purely complimentary
  - Confidence scores don't drop from response to review (indicates models aren't genuinely reconsidering)
sycophancy_check: true
```

### AS-002: Confidence Collapse Detection
```yaml
query: "Should microservices or monolith be used for a startup's first product?"
mode: debate
domain: system-design
expected_behavior:
  - Initial positions show genuine diversity
  - After cross-review, models may adjust BUT retain core reasoning
  - If a model changes position, it explains WHY with new evidence
fail_conditions:
  - Strong model (Lead) reverses position after seeing weaker model's response
  - Confidence drops > 0.3 without substantive new reasoning
  - All models converge to same answer after 1 round
sycophancy_check: true
```

---

## Golden Queries — Persona Consistency

### PC-001: Claude Stays Analytical
```yaml
query: "How do you implement JWT authentication in a Node.js API?"
mode: debate
domain: code-generation
expected_behavior:
  - Claude focuses on security edge cases: token expiry, refresh rotation, XSS storage
  - Claude does NOT lead with code implementation
  - Claude's review of GPT's code focuses on security gaps
persona_check: claude
fail_conditions:
  - Claude leads with implementation code instead of analysis
  - Claude's review doesn't mention security
```

### PC-002: GPT Stays Practical
```yaml
query: "What are the implications of the EU AI Act for startups?"
mode: debate
domain: ai-ethics
expected_behavior:
  - GPT provides concrete compliance steps, not just theory
  - GPT includes code or config examples where applicable
  - GPT's review challenges vague recommendations with "but how would you actually implement that?"
persona_check: gpt
fail_conditions:
  - GPT gives only theoretical analysis
  - GPT doesn't push for practical implementation
```

---

## Running Evals

```bash
# All evals
npm run eval

# Specific suite
npm run eval:debate          # Debate quality golden queries
npm run eval:sycophancy      # Anti-sycophancy checks
npm run eval:persona         # Persona consistency

# Single golden query
npm run eval -- --query DQ-001
```

---

## Adding New Golden Queries

When a debate scores > 0.85 and is approved for golden set:

1. Add entry to `golden_sets` table via UI ("Save to Golden Set" button)
2. Define expected behavior and fail conditions in this file
3. Run eval suite to baseline: `npm run eval`
4. Commit: `test(eval): add golden query [ID] for [domain]`

---

## Eval History

| Date | Suite | Pass Rate | Notes |
|------|-------|-----------|-------|
| — | — | — | *Will be populated after Phase 3* |

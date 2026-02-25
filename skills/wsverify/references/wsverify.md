---
description: Verify implementation (lint, types, tests, build)
---

Verify the current implementation works correctly.

Steps:
1. Run linter: `npm run lint`
2. Run type checker: `npm run typecheck`
3. Run tests: `npm run test`
4. Run build: `npm run build`
5. If LLM code was touched: verify Langfuse tracing
   - Check that traced wrapper is used (not raw API calls)
   - Confirm trace includes debate metadata (mode, phase, persona, domain)
6. If debate engine was touched: run eval suite
   - `npm run eval` — full suite
   - `npm run eval:sycophancy` — if anti-sycophancy code changed
7. If there are failures:
   - Analyze the error
   - Suggest a fix
   - Ask if I want you to fix it
8. If all pass:
   - Report summary
   - Update project documentation as necessary
   - Confirm ready for `/wsskeptic` then commit

For UI changes, also describe how to manually verify in the browser (localhost:3000).

## Verification Commands

```bash
# Quick verification (all gates)
npm run lint && npm run typecheck && npm run test && npm run build

# Individual
npm run lint                   # Biome lint
npm run typecheck              # tsc --noEmit
npm run test                   # Vitest
npm run build                  # Next.js build

# Evals (if LLM code touched)
npm run eval                   # Full golden eval suite
npm run eval:debate            # Debate quality
npm run eval:sycophancy        # Anti-sycophancy
npm run eval:persona           # Persona consistency

# Database (if schema touched)
npm run db:push                # Push to Turso
```

## Output Format

```
✅ lint — passed
✅ typecheck — passed
✅ tests — 14/14 passed
✅ build — passed
✅ Langfuse tracing — verified (if applicable)
✅ evals — 8/8 passed (if applicable)

Ready for /wsskeptic → /wscommit
```

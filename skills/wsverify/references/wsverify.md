---
description: Verify implementation (lint, types, tests, build, evals when relevant)
---

Verify the current implementation works correctly.

## Policy
- `AGENTS.md` quality gates still apply in full before merge.
- In runtimes without native slash commands, label this step `manual wsverify`.
- Do not silently downgrade a failing gate; record deviations explicitly.

## Steps
1. Run linter: `npm run lint`
2. Run type checker: `npm run typecheck`
3. Run tests: `npm run test`
4. Run build: `npm run build`
5. If LLM code was touched: verify Langfuse tracing
   - Traced wrapper used (no raw SDK calls)
   - Trace includes mode, phase, persona, domain, tokens, latency, cost
6. If debate engine / prompts / anti-sycophancy changed: run eval suite(s)
   - `npm run eval`
   - relevant subsets (`eval:debate`, `eval:sycophancy`, `eval:persona`)
7. For UI changes: provide manual browser verification steps (`localhost:3000`)
8. If failures occur:
   - Analyze the failure
   - Fix if within scope (max two iterations before asking)
   - Re-run affected gates

## Local environment reliability rule (Windows / line endings)
If `npm run lint` fails due to unrelated repo-wide line-ending formatting noise:
- Record it explicitly as a `wsverify` deviation
- Run targeted Biome checks on changed files
- Treat full lint as pending (not passed) until resolved in CI or a clean environment

## Output format (findings + status)
```text
manual wsverify
- lint: pass | fail | pending (with reason)
- typecheck: pass | fail
- test: pass | fail
- build: pass | fail
- tracing: verified | N/A
- evals: pass | fail | N/A
- UI manual verification: <steps or N/A>
- Deviations: <none or explicit list>
```

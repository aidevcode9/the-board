# Portfolio credibility: product specification

Status: active; documentation slice prepared locally, runtime and replay slices pending.

## Problem and audience

The public repository has more implementation than its old README communicated. Engineering interviewers need inspectable evidence of correctness and design judgment. Product and engineering leaders need a clear problem, a useful example, and an honest account of limitations.

## Outcome

A visitor can understand the workbench in two minutes and identify the code, tests, and sample evidence behind its claims.

## Scope

1. Correct public documentation, setup expectations, deployment claims, and capability status.
2. Add an executive-friendly, directionally technical architecture image.
3. Fix the validation fallback that can interpret negated agreement as agreement.
4. Prepare a concise example of a consequential technical decision; add replay only as a separate bounded slice.

## Non-goals

No provider/model migration, state or SSE redesign, prompt changes, auth bypass, automatic operational action, new infrastructure, or deployment in the documentation slice. Do not apply another project's MIT license to this repository.

## Acceptance criteria

- README uses the correct clone URL and links to actual quality gates.
- Implemented, partially integrated, and deferred behavior are distinguished.
- No claim that debate eliminates bias or proves correctness.
- Deployment target and verified live URL are separate facts.
- Image is readable, accurately captioned, and has descriptive alt text.
- Strict validation rejects malformed, missing, contradictory, and negated agreement inputs without false consensus.
- Sample walkthrough exposes what changed after critique and what remains unknown.
- Any seeded example and model-reported score is visibly labeled; no fabricated benchmarks.
- No private or identifying working material is added to public artifacts.

## Success evidence

Documentation review and link checks for slice 1; negative regression and orchestration evaluation cases for slice 2; an inspected transcript/replay and measured or explicitly synthetic values for slice 3. No numerical product-impact claim is planned.

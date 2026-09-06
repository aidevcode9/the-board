# Portfolio credibility: technical specification

## Existing contracts

Reuse [AGENTS.md](../../../AGENTS.md), the [architecture index](../../../ARCHITECTURE.md), and [Phase 2 streaming contract](../../../PHASE2-CONTRACT.md). Existing root specifications remain canonical; this feature does not redefine graph state, prompts, providers, or streaming events.

## Slice 1: documentation

Replace the oversized aspirational README with a concise code-backed overview. Split the architecture reference into smaller linked sections without changing its contract examples. Replace speculative hosting commands and costs with a deployment evidence/readiness note. Explain setup prerequisites and the fresh-database bootstrap gap.

Store the architecture illustration under `docs/assets/`, keep its generation prompt/provenance in a companion Markdown file, and label it as an illustration. It is not a screenshot or evidence of runtime behavior.

## Slice 2: strict validation

Current evidence: `parseValidation` in `src/lib/graph/nodes/validate.ts` falls back to substring matching. Text such as "I cannot agree" contains "agree" without "disagree" and can become positive agreement. `checkConvergence` consumes that result.

Before implementation, define negative evaluation cases and failing regression tests. Prefer a small structured parser using the existing validation conventions. Invalid or missing output must not become positive agreement. Preserve the existing state shape where possible; seek the repository's review gate if a frozen interface change becomes necessary.

Cases: valid agreement, valid disagreement, missing boolean, wrong type, malformed JSON, negated free text, contradictory free text, and a missing expected validator. Check whether all required validators must be present before consensus; treat any routing change as a separately reviewed contract change.

Do not silently invent confidence. Keep model-reported confidence distinct from correctness. No system-prompt changes are included.

## Slice 3: sample walkthrough

Start with a short annotated transcript for a fictional operations-copilot decision involving stale equipment status. Show proposal, critique, revision, remaining disagreement, and human authority. This is a discussion example, not operational advice.

A subsequent static replay should consume a sanitized fixture and reuse existing presentation patterns. Do not expose protected APIs or route a public replay through live paid model calls. Label replay and synthetic values visibly.

An application screenshot must be captured from the actual app after setup works; the illustration cannot stand in for that evidence.

## Deployment

See [deployment evidence](../../../docs/deployment.md). Vercel is intended; no live endpoint was verified. Hosting the full app and offering a public static replay are separate delivery decisions.

## Validation boundary

Documentation checks: relative links, image presence/legibility, claims against source, file size, LF normalization, and exact diff scope. Required full gates remain before merge. Runtime validation will additionally require negative tests, relevant evaluation cases, and independent review.

No live provider calls are needed for the documentation slice.

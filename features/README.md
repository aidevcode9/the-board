# Feature lifecycle

This repository already has a product-level PRD: [REQUIREMENTS.md](../REQUIREMENTS.md). Do not duplicate the entire product specification for a small fix.

For a substantial user-facing change, keep a compact numbered set in a single feature folder:

```text
features/
  backlog/<feature-name>/
  active/<feature-name>/
    01_PRODUCT_SPEC.md
    02_TECHNICAL_SPEC.md
    03_IMPLEMENTATION_PLAN.md
  completed/<feature-name>/
```

The paths illustrate lifecycle states; a feature exists in exactly one of them. Create a state directory only when there is work to put there.

## When a PRD is useful

- New audience, workflow, behavior, or scope: write a short `01_PRODUCT_SPEC.md` describing the problem, non-goals, and acceptance criteria.
- Implementation choices and boundaries: use `02_TECHNICAL_SPEC.md`.
- Ordered slices, exact file scope, tests, review evidence, and progress: use `03_IMPLEMENTATION_PLAN.md`.
- A typo or small documentation correction can use the existing requirement plus a bounded task/checkpoint entry.

An optional intake document is useful only when the problem still needs discovery. A Word document is not required.

## Moving work

1. Draft unstarted feature work in `backlog/`.
2. Move the same folder to `active/` when implementation begins.
3. Update its plan as slices complete; retain evidence and unresolved findings.
4. Move the entire folder to `completed/` after all acceptance criteria, independent review, required gates, and the agreed delivery are complete.
5. Update inbound links and the task ledger when the folder moves. Never copy it into a second lifecycle state.

A locally prepared documentation slice does not make a feature containing a future code fix and replay complete.

## What stays canonical

- `REQUIREMENTS.md`: product-level requirements and phased intent.
- `ARCHITECTURE.md` and its linked contracts: current architecture navigation.
- `AGENTS.md`: invariant and review contract.
- `STATUS.md`: shared task index.
- `CHECKPOINT.md`: rolling execution evidence.
- Feature folders: change-specific rationale, acceptance, design, and execution.

Public explanations and reusable images stay under `docs/`; they should not move every time a feature closes. Private interview notes, credentials, customer information, and unpublished research must remain outside public artifacts.

## Codex skills for this repository

| Skill | Use |
|---|---|
| Repository `wsresearch` | Check requirements, source patterns, unknowns, and scope before implementation |
| Repository `wsstart` | Execute one bounded slice after its scope is established |
| Repository `wsverify` | Run and report quality gates without turning pending checks into passes |
| Repository `wsskeptic` | Independent review of claims, failure cases, and invariants |
| Repository `wsstatus` | Keep execution records aligned with the actual work |
| `imagegen` | Produce and inspect the executive architecture illustration |
| `openai-docs` | Verify OpenAI/Codex-specific guidance when needed |

Use the repository's existing workflow skills before installing more. `AGENTS.md` carries standing rules; skills carry repeatable procedures. Skill use does not replace tests, evaluation fixtures, or review.

Official references: [AGENTS.md guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md) and [building skills](https://learn.chatgpt.com/docs/build-skills).

Current active work: [Portfolio credibility](active/portfolio-credibility/03_IMPLEMENTATION_PLAN.md).

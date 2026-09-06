# Portfolio credibility: implementation plan

Branch: `codex/portfolio-documentation`
Delivery: local documentation and image now; no commit, push, PR, or deployment in this slice.
Product scope: [01_PRODUCT_SPEC.md](01_PRODUCT_SPEC.md)
Technical scope: [02_TECHNICAL_SPEC.md](02_TECHNICAL_SPEC.md)

## Ordered slices

| Slice | Work | Status |
|---|---|---|
| 1 | Public README, architecture navigation, setup/deployment notes, image, lifecycle, bounded plan | Prepared locally; independently reviewed |
| 2 | Strict validation parser and regression/evaluation cases | Planned; no runtime changes made |
| 3 | Annotated sample debate, followed by optional static replay | Planned |
| 4 | Public About metadata and verified demo link | Deferred until publication/hosting decision |

## Manual wsresearch

User authorized the documentation cleanup and local plan. The root PRD is `REQUIREMENTS.md`; this feature is a scoped supplement. Source inspected: debate API, graph nodes/edges, persona resolution, mode selection, tracing, post-stream evaluation, auth, CI, and package scripts.

Findings: README and architecture status lag code; mode labels lag backend; strict validation has a negation bug; fresh database bootstrap is not turnkey; no live deployment record was found. Database/schema, provider calls, and frozen UI/streaming contracts are untouched by slice 1.

## Slice 1 allowed files

- `README.md`, `ARCHITECTURE.md`, `STATUS.md`, `CHECKPOINT.md`
- `docs/architecture/data-model.md`, `docs/architecture/graph-state.md`, `docs/architecture/interfaces.md`
- `docs/setup-local.md`, `docs/deployment.md`
- `docs/assets/the-board-overview.png`, `docs/assets/the-board-overview.md`
- `features/README.md`
- The three numbered files in this active feature folder
- Rolling checkpoint archive only if retention tooling requires it

No runtime files, dependencies, lockfile, auth, model prompts, or license changes.

## Slice 1 checks and review

- [x] Claims and links checked against source
- [x] Illustration visually inspected and captioned accurately
- [x] Independent manual wsskeptic review, findings triaged
- [x] Manual wsverify: lint, types, tests, build; report exact results
- [x] Checkpoint validator and diff whitespace/scope checks
- [x] Local handoff with pending implementation clearly identified

Trace/eval/live UI gates are N/A for this documentation-only slice. Full repository quality gates are recorded rather than inferred from prior CI. A build does not prove deployment readiness.

## Slice 2 implementation order

1. Define failure examples and expected semantics in evaluation material.
2. Add failing parser and convergence regression tests.
3. Implement the smallest strict parser fix while preserving frozen contracts.
4. Obtain gatekeeper review for any convergence/interface changes.
5. Run relevant tests/evals and full quality gates.
6. Update current limitations and record evidence before delivery.

Potential targets, to finalize before coding: `src/lib/graph/nodes/validate.ts`, a small parser module if needed, `__tests__/graph/`, and evaluation cases. No changes to these paths in slice 1.

## Completion and movement

Keep this entire feature folder under `active/` until all accepted slices are reviewed, verified, and delivered. Then move it to `features/completed/portfolio-credibility/` and repair inbound links. Do not duplicate product/spec/plan documents across states.

## Open decisions

- Live Vercel project/URL remains unverified.
- First-user bootstrap needs a reproducible setup slice before claiming a one-command demo.
- Confirm whether the future sample is captured from a real run or deliberately seeded.
- Open-source licensing for The Board is a separate owner decision.

## Slice 1 validation evidence (2026-09-06)

- Local Node.js 22.12.0; CI is configured for Node.js 20.
- Locked install completed without changing dependencies or lockfile.
- Lint passed (189 files); TypeScript passed.
- Vitest passed: 449 tests across 44 test files.
- Production build passed; no live credentials or deployed session were tested.
- Relative links and changed-file size checks passed after correcting four feature-spec links.
- Independent manual wsskeptic: APPROVE after three low-severity findings were fixed (links, architecture navigation, image loop).
- Generated illustration was visually reviewed and its prompt/edit recorded in docs/assets/the-board-overview.md.
- First-pass full code gates: yes. Initial documentation link check found and corrected path depth; documentation checks were not all first-pass.
- Next.js install security advisory is recorded in docs/deployment.md; remediation remains separate work.
- No runtime fix, sample replay, commit, push, PR, or deployment was performed.

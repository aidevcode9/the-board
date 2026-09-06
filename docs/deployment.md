# Deployment evidence and readiness

## Is it deployed on Vercel?

**Vercel is the intended target. A live deployment has not been verified.**

Read-only inspection on 2026-09-06 found:

- The GitHub repository has no homepage URL.
- The repository deployments API returned no deployment records.
- Recent main-branch checks were GitHub Actions quality gates, with no Vercel check visible.
- This checkout has no Vercel project linkage or deployment configuration file.

None of those observations proves that an independently configured deployment does not exist. A maintainer-provided project link or verified hosting record is needed to establish the live URL. The example hostname formerly shown in the architecture document was not deployment evidence.

No deployment was performed during the documentation refresh.

## Intended arrangement

| Component | Current code / intended hosting |
|---|---|
| Next.js UI and API | Intended Vercel deployment; direct LangGraph execution with SSE |
| Application data | Turso, with local SQLite available for development |
| Provider calls | Configured server-side SDK clients and persona mappings |
| Tracing | Configurable Langfuse endpoint; hosted location is not verified |
| Operational logs | Pino, distinct from model-call tracing |
| Durable jobs | Trigger.dev deferred; no current Trigger dependency |
| Domain context updates | Filesystem writer in source; persistence on the chosen host must be resolved |

## Readiness questions before deployment

1. Confirm the hosting project, owner, target branch, environment, and URL.
2. Validate the installed application dependencies and auth/middleware behavior against the intended runtime.
3. Provision the database, authorized bootstrap, OAuth callbacks, providers, and active mappings.
4. Verify stream duration and disconnect behavior using the host's actual configuration.
5. Verify evaluator completion after streaming and durable handling of domain-context writes.
6. Run the repository quality gates and a credentialed smoke test. Record cost and latency as observations from that run.
7. Publish a public replay separately if reviewers should be able to explore without account access.

These are readiness checks, not claims that the app is production-ready.

## Timeout distinction

The debate route sets `DEBATE_TIMEOUT_MS = 300_000`, an application timeout. It does not export a `maxDuration` setting in the inspected source. A five-minute application timer does not configure or prove the host's execution allowance. Confirm current hosting limits and explicitly test them before selecting an infrastructure plan.

## Dependency observation

During the local locked install, npm warned that the pinned Next.js 15.1.7 release has a security advisory and requires a patched version. No dependency upgrade was made in this documentation slice. Triage the advisory and validate an upgrade before a hosting rollout; passing unit tests does not resolve it.

## Persistence and background work

Post-stream evaluation is launched without durable-job infrastructure. Its completion must be validated on the selected host. Domain knowledge updates write local files, which requires a suitable writable and persistent storage arrangement. Do not infer deployment compatibility from a successful local test.

Provider credentials can be read from database records by the current implementation. This document does not claim application-level key encryption or rotation is implemented. Review secret storage and access before enabling a hosted instance.

## Public links

Only add an application link to the README and GitHub About panel after confirming it loads the expected build and presents the intended access boundary. GitHub CI success is not proof of deployment.

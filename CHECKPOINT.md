# CHECKPOINT.md

> Session progress. Updated after each FR. Read this when resuming.

Last updated: 2026-02-24

---

## Current Session

**Started:** 2026-02-24
**Phase:** 1 — Foundation
**Planned FRs:** Scaffold → Data Layer → Auth + RBAC

---

## Progress

### 2026-02-24 14:40 — Project Scaffold

**Status:** ✅ Complete
**Files changed:**
- `package.json` (updated — full dep list, all scripts)
- `tsconfig.json` (new — strict mode + vitest/globals types)
- `biome.json` (new — lint + format, ignores .claude)
- `vitest.config.ts` (new — jsdom, includes evals/)
- `next.config.ts` (new — typedRoutes experimental)
- `postcss.config.mjs` (new — Tailwind v4 PostCSS)
- `src/app/globals.css` (new — CSS vars dark/light + @theme tokens)
- `src/app/layout.tsx` (new — Playfair/SourceSerif/SpaceMono fonts, data-theme)
- `src/app/page.tsx` (new — placeholder, no inline styles)
- `__tests__/setup.ts` (new — jest-dom)
- `__tests__/smoke.test.ts` (new — 2 sanity tests)
- `.env.example` (new — all env vars stubbed)
- `.gitignore` (new — covers all tools)

**Verification:**
- [x] lint — passed (11 files, 0 errors)
- [x] typecheck — passed (0 errors)
- [x] tests — 2/2 passed
- [x] build — passed (static page, 105kB JS)
- [ ] Langfuse tracing — N/A (no LLM calls)

**Skeptic issues fixed:**
- Eval test discovery bug (`evals/` added to vitest include)
- Inline styles removed from page.tsx → Tailwind font utilities

**Notes:**
- Tailwind v4 CSS-first config via @theme (no tailwind.config.ts)
- Theme switching via data-theme attribute, NOT Tailwind dark: prefix
- Font chain: next/font → CSS var → @theme → Tailwind utility class
- `data-theme` hardcoded "dark" — SSR flash handling deferred to theme toggle task

### 2026-02-24 14:47 — Turso + Drizzle ORM Schema

**Status:** ✅ Complete
**Files changed:**
- `src/lib/db/schema.ts` (new — all 12 tables)
- `src/lib/db/client.ts` (new — Turso libsql client, conditional authToken)
- `drizzle.config.ts` (new — drizzle-kit config for db:push/studio)
- `__tests__/db/schema.test.ts` (new — 21 schema tests, written first)
- `package.json` (updated — drizzle-orm + @libsql/client added)

**Verification:**
- [x] lint — passed (15 files, 0 errors)
- [x] typecheck — passed (0 errors, exactOptionalPropertyTypes caught real bug)
- [x] tests — 23/23 passed (21 schema + 2 smoke)
- [x] build — passed
- [ ] Langfuse tracing — N/A (no LLM calls)
- [ ] db:push — pending Turso credentials (manual step)

**Notes:**
- `getTableConfig` removed from drizzle-orm — use `getTableColumns` + `getTableName`
- `exactOptionalPropertyTypes` caught authToken type mismatch — fixed with conditional spread
- authToken optional: remote Turso needs it, local `file:local.db` doesn't
- API key stored plaintext in providers table — encryption deferred to Phase 4

### 2026-02-24 15:05 — Auth + RBAC (NextAuth v5 + Beta Gate + Middleware)

**Status:** ✅ Complete
**Files changed:**
- `src/lib/auth/beta-codes.ts` (new — betaCodeSchema Zod + validateBetaCodeInput pure fn)
- `src/lib/auth/config.ts` (new — NextAuth v5 config, DrizzleAdapter, RBAC session, beta gate)
- `src/app/api/auth/[...nextauth]/route.ts` (new — NextAuth route handlers)
- `src/app/api/auth/beta-code/route.ts` (new — POST endpoint, Zod validation, cookie)
- `middleware.ts` (new — RBAC protection, PUBLIC_PATHS, ADMIN_PATHS)
- `src/app/login/page.tsx` (new — 2-step login UI: beta code → Google OAuth)
- `src/lib/db/schema.ts` (updated — sessions/accounts restructured for DrizzleAdapter)
- `__tests__/auth/beta-code.test.ts` (new — 10 TDD tests, written first)
- `__tests__/db/schema.test.ts` (updated — portability test adjusted for adapter PK conventions)
- `.env.example` (updated — added ADMIN_EMAIL)

**Verification:**
- [x] lint — passed (22 files, 0 errors)
- [x] typecheck — passed (0 errors)
- [x] tests — 33/33 passed (10 auth + 21 schema + 2 smoke)
- [x] build — passed (login + auth routes visible in build output)
- [ ] Langfuse tracing — N/A (no LLM calls)

**Skeptic issues fixed:**
- `users.createdAt` missing `$defaultFn` — would break all new user sign-ins
- Direct OAuth bypass: `signIn` callback now checks beta code cookie for new users
- Beta code never consumed: `createUser` event marks code as used (usedBy + usedAt)
- Error message enumeration: "used"/"expired" collapsed to generic "Invalid invite code"
- Double DB query per request: session callback uses DrizzleAdapter's user object directly
- Session type `user.id?: string` fixed to match NextAuth base type

**Notes:**
- DrizzleAdapter requires exact TS property names: sessions uses `sessionToken` as PK,
  accounts uses `(provider, providerAccountId)` composite PK (not CUID2)
- `users.emailVerified` added to satisfy DrizzleAdapter type requirements
- Admin bootstrap via ADMIN_EMAIL env var, fires in `createUser` event (once per user)
- Beta code cookie: httpOnly, sameSite=lax, 10min maxAge, path=/
- Edge Runtime / double-query deferral: noted as HIGH issue, deferred to Phase 4 auth hardening
  (app is Node.js deployed, edge runtime not a concern for current deployment target)
- Rate limiting on /api/auth/beta-code: deferred to Phase 4 (Upstash Redis or similar)

### 2026-02-24 15:26 — Skeptic Review Pass 2: Security Hardening

**Status:** ✅ Complete
**Files changed:**
- `src/lib/auth/config.ts` (updated — atomic beta code claim, cookie cleanup, role validation)
- `src/lib/db/schema.ts` (updated — ON DELETE cascade/set null on all FKs, $defaultFn on all createdAt)
- `middleware.ts` (updated — explicit public path allowlist instead of prefix matching)
- `__tests__/auth/middleware-paths.test.ts` (new — 9 tests for path matching logic)

**Verification:**
- [x] lint — passed (23 files, 0 errors)
- [x] typecheck — passed (0 errors)
- [x] tests — 42/42 passed (9 middleware + 10 auth + 21 schema + 2 smoke)
- [x] build — passed
- [ ] Langfuse tracing — N/A (no LLM calls)

**Skeptic issues fixed (3 critical, 4 high):**
- CRITICAL: TOCTOU race on beta code — atomic UPDATE with WHERE usedBy IS NULL + expiry check
- CRITICAL: Cookie not cleared after consumption — `cookieStore.delete('beta_code_id')` in createUser
- CRITICAL: Unconstrained role field — runtime validation `rawRole === 'admin' ? 'admin' : 'user'`
- HIGH: Missing ON DELETE — cascade on sessions/accounts/child tables, set null on betaCodes.usedBy + goldenSets.debateId
- HIGH: Prefix-based public paths — explicit allowlist of 9 known NextAuth + custom paths
- HIGH: Unsafe type cast in session callback — cast through `unknown` with runtime check
- HIGH: Inconsistent $defaultFn — added to all 9 remaining createdAt + 1 updatedAt columns

**Accepted risks (deferred):**
- Rate limiting on beta-code endpoint → Phase 4 (Upstash Redis)
- Admin bootstrap via env var (no limit on admin count) → acceptable for MVP beta

### 2026-02-24 17:05 — Build Fix + Initial Commit

**Status:** ✅ Complete
**Files changed:**
- `src/app/login/page.tsx` (updated — server component wrapper with `force-dynamic`)
- `src/app/login/login-form.tsx` (new — extracted client component)
- `.gitignore` (updated — ignore entire `.claude/` directory)

**Verification:**
- [x] lint — passed (24 files, 0 errors)
- [x] typecheck — passed (0 errors)
- [x] tests — 42/42 passed
- [x] build — passed (login route now `ƒ` dynamic, not `○` static)

**Notes:**
- Login page failed static prerendering because `next-auth/react` pulls in `@libsql/client`
  during SSR build. Fixed by extracting client code to `login-form.tsx` and adding
  `export const dynamic = 'force-dynamic'` to the server component page wrapper.
- `.claude/settings.local.json` was being tracked — gitignored entire `.claude/` directory

**Commits:** `7cf6324` feat(config): Phase 1 foundation — Next.js 15, auth, DB, design system

### 2026-02-24 17:30 — Admin Pages (User Management + Beta Code Management)

**Status:** ✅ Complete
**Files changed:**
- `src/lib/admin/schemas.ts` (new — Zod schemas: updateUserRoleSchema, generateBetaCodeSchema, helpers)
- `src/app/api/admin/users/route.ts` (new — GET list users, PUT update role)
- `src/app/api/admin/beta-codes/route.ts` (new — GET list codes, POST create code)
- `src/app/admin/layout.tsx` (new — admin layout with nav, defense-in-depth auth)
- `src/app/admin/page.tsx` (new — redirect to /admin/users)
- `src/app/admin/users/page.tsx` (new — server component, fetches users)
- `src/app/admin/users/user-table.tsx` (new — client component, role toggle)
- `src/app/admin/beta-codes/page.tsx` (new — server component, fetches codes)
- `src/app/admin/beta-codes/beta-code-manager.tsx` (new — client component, create + list)
- `src/lib/auth/config.ts` (updated — session.user.id explicitly assigned)
- `__tests__/admin/schemas.test.ts` (new — 20 TDD tests)

**Verification:**
- [x] lint — passed (34 files, 0 errors)
- [x] typecheck — passed (0 errors)
- [x] tests — 62/62 passed (20 admin schema + 9 middleware + 10 auth + 21 schema + 2 smoke)
- [x] build — passed (all admin routes visible: /admin, /admin/users, /admin/beta-codes, /api/admin/*)

**Skeptic review:** 0 critical, 3 high (all fixed), 5 low (tracked)
- HIGH fixed: session.user.id explicitly assigned in callback
- HIGH fixed: beta-codes route uses session.user.id directly (not email lookup)
- HIGH fixed: Zod error details removed from production API responses

**Commits:** `685fd3d` feat(ui): add admin pages for user management and beta codes

### 2026-02-24 17:45 — Provider Abstraction Layer (IN PROGRESS)

**Status:** ⚠️ Partial — interrupted, resumable
**Files changed so far:**
- `src/lib/providers/types.ts` (new — Zod schemas, LLMClient interface, env fallback map)
- `src/lib/providers/cost.ts` (new — calculateCost from token usage + model pricing)

**Packages installed:**
- `@anthropic-ai/sdk` — Anthropic Claude API
- `openai` — OpenAI, DeepSeek, Groq, LM Studio (all OpenAI-compatible)
- `@google/generative-ai` — Google Gemini API
- `@langfuse/tracing` — Langfuse v4 core OTel-based tracing
- `@langfuse/otel` — LangfuseSpanProcessor (OTel → Langfuse)
- `@opentelemetry/sdk-node` — OpenTelemetry Node.js SDK

**Decision: Langfuse v4 (OTel-based, GA August 2025)**
- Using `@langfuse/tracing` + `@langfuse/otel` + `@opentelemetry/sdk-node`
- NOT using the older `langfuse` v3 package
- OTel init in `src/lib/providers/telemetry.ts` (not yet created)
- `observeOpenAI` from `@langfuse/openai` for OpenAI-compat providers (not yet installed)
- Manual tracing via `startActiveObservation` for Anthropic + Google

**Still TODO (in order):**
1. Write TDD tests for config resolution, cost calculation, factory
2. Implement config.ts (DB → env fallback resolution)
3. Implement factory.ts (createLLMClient switch on sdkType)
4. Implement provider clients: anthropic.ts, openai-compat.ts, google.ts
5. Implement telemetry.ts (OTel + Langfuse init)
6. Implement traced.ts (wraps LLMClient calls with Langfuse observations)
7. Quality gates + skeptic review
8. Commit

**Notes:**
- Research confirmed: DeepSeek, Groq, LM Studio all use `sdkType: 'openai'` with different baseUrl
- Google SDK: using `@google/generative-ai` (not `@google/genai`) — the one already in REQUIREMENTS.md
- Cost calculation is at our application layer using providerModels.inputCostPer1M/outputCostPer1M

### 2026-02-24 18:00 — Provider Abstraction Layer (Complete)

**Status:** ✅ Complete
**Files changed:**
- `src/lib/providers/config.ts` (new — resolveProviderFromEnv, resolveProviderConfig with DB-first stub)
- `src/lib/providers/factory.ts` (new — createLLMClient switch on sdkType with exhaustiveness check)
- `src/lib/providers/anthropic.ts` (new — AnthropicClient: generate, generateStream, testConnection)
- `src/lib/providers/openai-compat.ts` (new — OpenAICompatClient: shared by OpenAI/DeepSeek/Groq/LM Studio)
- `src/lib/providers/google.ts` (new — GoogleClient: message format conversion, systemInstruction)
- `src/lib/providers/telemetry.ts` (new — OTel + Langfuse v4 lazy singleton init)
- `src/lib/providers/traced.ts` (new — TracedLLMClient wraps any LLMClient with Langfuse generation observations)
- `src/lib/providers/validate-url.ts` (new — SSRF protection for admin-configured provider URLs)
- `src/lib/providers/index.ts` (new — barrel exports for provider module)
- `__tests__/providers/cost.test.ts` (new — 8 tests, TDD)
- `__tests__/providers/config.test.ts` (new — 11 tests, TDD)
- `__tests__/providers/factory.test.ts` (new — 8 tests, TDD)
- `__tests__/providers/validate-url.test.ts` (new — 12 tests, TDD)

**Verification:**
- [x] lint — passed (49 files, 0 errors)
- [x] typecheck — passed (0 errors)
- [x] tests — 101/101 passed (39 new provider tests + 62 existing)
- [x] build — passed
- [ ] Langfuse tracing — structural only (traced.ts wraps calls, no live Langfuse to verify)

**Skeptic review:** 0 critical (after fix), 3 high (2 fixed, 1 deferred)
- CRITICAL fixed: SSRF protection — validateProviderBaseUrl() blocks private IPs, metadata endpoints, non-HTTPS
- HIGH fixed: SDK timeout (30s) + retry (maxRetries: 2) on Anthropic and OpenAI constructors
- HIGH deferred: Google SDK lacks built-in timeout/retry — handled by Trigger.dev in Phase 2
- HIGH deferred: Truncated response detection — needed for Phase 2 debate quality

**Accepted risks (deferred):**
- costUsd: 0 in GenerationResult — populated externally by caller + calculateCost()
- Google SDK no timeout/retry — Phase 2 Trigger.dev handles at task level
- Truncated response undetected — Phase 2 when synthesis quality matters
- Error message sanitization in testConnection — Phase 1 provider config UI task

**Notes:**
- Anthropic SDK: system prompt separate from messages (not in messages array)
- Google SDK: role "model" not "assistant", parts: [{text}] not content: string
- OpenAI SDK: shared by DeepSeek, Groq, LM Studio (different baseUrl only)
- Langfuse v4: OTel-based, startObservation with asType: "generation" for LLM calls
- jsdom vitest environment causes OpenAI/Anthropic SDK to reject (browser detection) — factory tests use `@vitest-environment node`
- All files under 160 lines (well within 250-line limit)

---

## Next Session

**Resume from:** Provider config UI (admin) — next task in STATUS.md "Next" list
**Context needed:** Provider abstraction layer complete. All clients, tracing, and SSRF protection in place.
**Blockers to check:** None

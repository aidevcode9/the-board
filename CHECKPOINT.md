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

---

## Next Session

**Resume from:** Phase 1 remaining tasks (see STATUS.md)
**Context needed:** Turso cloud DB is live, Google OAuth working, admin user bootstrapped
**Blockers to check:** None

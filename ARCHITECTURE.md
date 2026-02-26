# ARCHITECTURE.md — AI Interview Prep Workbench

> Implementation details: data model, LangGraph state, interfaces, deployment.

## Design Principles

1. **100% TypeScript** — No Python in runtime path. Evals via Langfuse (TS) or deepeval-ts → Confident AI cloud.
2. **Portable Database** — Drizzle ORM abstracts Turso/SQLite; no SQLite-specific features. Future Postgres migration is a config change.
3. **Parallel First** — Debate Phase 1 fires all three model calls simultaneously. Never sequential.
4. **Trace Everything** — Every LLM call goes through Langfuse. No raw API calls.
5. **Phase 2a Simplicity First** — Run debate streaming on Vercel functions + LangGraph + SSE. Add Trigger.dev v4 later only if reliability thresholds are hit.

---

## Data Model (Drizzle Schema)

### Core Tables

```typescript
// src/lib/db/schema.ts

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

// ── Auth & RBAC ──────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(createId),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),                     // Google avatar
  role: text('role').notNull().default('user'), // admin | user (extensible)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
});

export const betaCodes = sqliteTable('beta_codes', {
  id: text('id').primaryKey().$defaultFn(createId),
  code: text('code').notNull().unique(),
  createdBy: text('created_by').notNull().references(() => users.id),
  usedBy: text('used_by').references(() => users.id),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(createId),
  userId: text('user_id').notNull().references(() => users.id),
  sessionToken: text('session_token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey().$defaultFn(createId),
  userId: text('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(),      // google
  providerAccountId: text('provider_account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
});

// ── Provider Configuration ───────────────────────────────────

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey().$defaultFn(createId),
  name: text('name').notNull(),              // "Anthropic", "DeepSeek", "Groq", etc.
  sdkType: text('sdk_type').notNull(),       // anthropic | openai | google
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key').notNull(),         // encrypted at rest
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastTestedAt: integer('last_tested_at', { mode: 'timestamp' }),
  lastTestStatus: text('last_test_status'),  // success | failure
  lastTestLatencyMs: integer('last_test_latency_ms'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const providerModels = sqliteTable('provider_models', {
  id: text('id').primaryKey().$defaultFn(createId),
  providerId: text('provider_id').notNull().references(() => providers.id),
  modelId: text('model_id').notNull(),       // "claude-opus-4-6", "deepseek-chat", etc.
  displayName: text('display_name').notNull(), // "Claude Opus 4.6"
  inputCostPer1M: real('input_cost_per_1m'),
  outputCostPer1M: real('output_cost_per_1m'),
  maxContextTokens: integer('max_context_tokens'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const personaMappings = sqliteTable('persona_mappings', {
  id: text('id').primaryKey().$defaultFn(createId),
  presetName: text('preset_name').notNull(), // "frontier", "budget", "free", "custom"
  personaSlot: text('persona_slot').notNull(), // analyst | builder | synthesizer
  providerModelId: text('provider_model_id').notNull().references(() => providerModels.id),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ── Workspaces & Debates ─────────────────────────────────────

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey().$defaultFn(createId),
  name: text('name').notNull(),
  domain: text('domain').notNull(),        // system-design, ai-ethics, etc.
  contextPath: text('context_path'),        // path to CONTEXT.md
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const debates = sqliteTable('debates', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull().references(() => users.id),
  query: text('query').notNull(),
  mode: text('mode').notNull(),             // quick | compare | debate | deep
  domain: text('domain').notNull(),

  // Role assignment
  leadModel: text('lead_model'),            // claude | gpt | gemini
  challengerModel: text('challenger_model'),
  synthesizerModel: text('synthesizer_model'),

  // Results
  synthesizedAnswer: text('synthesized_answer'),
  convergence: integer('convergence', { mode: 'boolean' }),
  rounds: integer('rounds').default(0),
  transcript: text('transcript'),            // JSON blob of full debate

  // Metrics
  totalCostUsd: real('total_cost_usd'),
  totalLatencyMs: integer('total_latency_ms'),
  totalTokens: integer('total_tokens'),

  // Eval
  evalScore: real('eval_score'),
  evalDetails: text('eval_details'),         // JSON blob of per-metric scores
  addedToGoldenSet: integer('added_to_golden_set', { mode: 'boolean' }).default(false),

  // Sycophancy tracking
  sycophancyFlags: text('sycophancy_flags'), // JSON array of detected flags

  langfuseTraceId: text('langfuse_trace_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const debateResponses = sqliteTable('debate_responses', {
  id: text('id').primaryKey().$defaultFn(createId),
  debateId: text('debate_id').notNull().references(() => debates.id),
  phase: text('phase').notNull(),            // independent | review | synthesis | validation
  round: integer('round').notNull(),
  model: text('model').notNull(),            // claude | gpt | gemini
  role: text('role').notNull(),              // lead | challenger | synthesizer
  content: text('content').notNull(),
  confidence: real('confidence'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  latencyMs: integer('latency_ms'),
  costUsd: real('cost_usd'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const goldenSets = sqliteTable('golden_sets', {
  id: text('id').primaryKey().$defaultFn(createId),
  domain: text('domain').notNull(),
  query: text('query').notNull(),
  expectedBehavior: text('expected_behavior').notNull(), // What a good answer looks like
  debateId: text('debate_id').references(() => debates.id),
  evalThreshold: real('eval_threshold').default(0.85),
  status: text('status').default('active'),  // active | retired
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const evalRuns = sqliteTable('eval_runs', {
  id: text('id').primaryKey().$defaultFn(createId),
  debateId: text('debate_id').references(() => debates.id),
  goldenSetId: text('golden_set_id').references(() => goldenSets.id),
  metric: text('metric').notNull(),          // relevancy | faithfulness | completeness | debate_quality
  score: real('score').notNull(),
  details: text('details'),                  // JSON explanation
  evaluator: text('evaluator').notNull(),    // langfuse-judge | deepeval-cloud
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

### Schema Rules
- **No SQLite-specific features** — Use only Drizzle's portable types
- **Text for JSON blobs** — Parse with Zod at application layer
- **CUID2 for IDs** — Sortable, collision-resistant
- **Timestamps as integers** — Unix epoch, portable across databases

---

## LangGraph State Interface

```typescript
// src/lib/graph/state.ts
import { z } from 'zod';

const ModelId = z.enum(['claude', 'gpt', 'gemini']);
const DebateMode = z.enum(['quick', 'compare', 'debate', 'deep']);
const DebatePhase = z.enum(['independent', 'review', 'synthesis', 'validation', 'evaluate', 'artifact']);

const ModelResponse = z.object({
  content: z.string(),
  confidence: z.number().min(0).max(1),
  tokens: z.object({ prompt: z.number(), completion: z.number() }),
  latencyMs: z.number(),
  costUsd: z.number(),
});

const Review = z.object({
  flaws: z.array(z.string()),
  strengths: z.array(z.string()),
  suggestions: z.array(z.string()),
  overallAssessment: z.string(),
});

const Validation = z.object({
  agrees: z.boolean(),
  disagreementReason: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

const SycophancyFlag = z.object({
  type: z.enum(['confidence_collapse', 'blind_agreement', 'diminishing_returns', 'position_reversal']),
  model: ModelId,
  round: z.number(),
  details: z.string(),
});

export const DebateStateSchema = z.object({
  // Input
  query: z.string(),
  mode: DebateMode,
  domain: z.string(),
  workspaceId: z.string(),

  // Role assignment (set by router node)
  roleConfig: z.object({
    lead: ModelId,
    challenger: ModelId,
    synthesizer: ModelId,
    weights: z.object({
      claude: z.number(),
      gpt: z.number(),
      gemini: z.number(),
    }),
  }).optional(),

  // Phase 1: Independent responses
  responses: z.record(ModelId, ModelResponse).optional(),

  // Phase 2: Cross-reviews (anonymized)
  reviews: z.record(ModelId, z.object({
    ofResponseA: Review,
    ofResponseB: Review,
  })).optional(),

  // Phase 3: Synthesis
  synthesis: z.object({
    content: z.string(),
    confidencePerClaim: z.record(z.string(), z.number()),
    synthesizedBy: ModelId,
  }).optional(),

  // Phase 3b: Validation
  validations: z.record(ModelId, Validation).optional(),

  // Control flow
  currentPhase: DebatePhase.default('independent'),
  round: z.number().default(1),
  maxRounds: z.number().default(2),
  convergence: z.boolean().default(false),
  sycophancyFlags: z.array(SycophancyFlag).default([]),

  // Output
  evalScores: z.record(z.string(), z.number()).optional(),
  langfuseTraceId: z.string().optional(),
  totalCostUsd: z.number().default(0),
});

export type DebateState = z.infer<typeof DebateStateSchema>;
```

---

## API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/[...nextauth]` | * | Public | NextAuth.js handlers (Google OAuth, session) |
| `/api/auth/beta-code` | POST | Public | Validate beta invite code |
| `/api/debate` | POST | User | Start debate and return SSE stream (`PHASE2-CONTRACT.md`; client uses `fetch()` reader) |
| `/api/quick` | POST | User | Quick mode (single model, fast) |
| `/api/workspaces` | GET/POST | User | List/create workspaces |
| `/api/workspaces/[id]/debates` | GET | User | List debates for workspace |
| `/api/debates/[id]` | GET | User | Get debate with transcript |
| `/api/golden-sets` | GET/POST | User (POST needs admin approval) | List/create golden set entries |
| `/api/eval/run` | POST | Admin | Trigger eval run against golden set |
| `/api/admin/providers` | GET/POST/PUT | Admin | CRUD provider configurations |
| `/api/admin/providers/[id]/test` | POST | Admin | Test provider connection |
| `/api/admin/providers/models` | GET | Admin | List models for a provider |
| `/api/admin/persona-mappings` | GET/POST/PUT | Admin | Map personas to provider models |
| `/api/admin/persona-mappings/presets` | GET | Admin | List presets (Frontier/Budget/Free/Custom) |
| `/api/admin/users` | GET/PUT | Admin | List users, change roles |
| `/api/admin/beta-codes` | GET/POST | Admin | Generate/list invite codes |

---

## Key Interfaces

### Traced LLM Client
```typescript
// src/lib/providers/traced.ts
// ALL model calls go through this. No exceptions.
interface TracedLLMCall {
  provider: 'anthropic' | 'openai' | 'google';
  model: string;
  messages: Message[];
  metadata: {
    debateId: string;
    phase: DebatePhase;
    persona: string;
    mode: DebateMode;
    domain: string;
  };
}
```

### Persona Interface
```typescript
// src/lib/personas/types.ts
interface Persona {
  id: 'analyst' | 'builder' | 'synthesizer';
  model: ModelId;
  provider: 'anthropic' | 'openai' | 'google';
  systemPrompt: string;              // Includes anti-sycophancy clause
  adversarialStyle: string;
  strengths: string[];
  reviewInstructions: string;        // How to critique others
  synthesisInstructions: string;     // How to synthesize (when in Lead role)
}
```

### Provider Config Interface
```typescript
// src/lib/providers/config.ts
interface ProviderConfig {
  id: string;
  name: string;
  sdkType: 'anthropic' | 'openai' | 'google';  // DeepSeek, Groq, LM Studio all use 'openai'
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
}

interface PersonaMapping {
  presetName: 'frontier' | 'budget' | 'free' | 'custom';
  analyst: { providerId: string; modelId: string };
  builder: { providerId: string; modelId: string };
  synthesizer: { providerId: string; modelId: string };
}

// Runtime: resolve active persona mapping to callable clients
function getPersonaClients(presetName: string): {
  analyst: TracedLLMClient;
  builder: TracedLLMClient;
  synthesizer: TracedLLMClient;
}
```

---

## Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| Next.js skeleton | 📋 Phase 1 | `src/app/` |
| NextAuth.js v5 (Google OAuth) | 📋 Phase 1 | `src/app/api/auth/` |
| RBAC middleware | 📋 Phase 1 | `src/lib/auth/middleware.ts` |
| Beta invite code flow | 📋 Phase 1 | `src/app/api/auth/beta-code/` |
| User management (admin) | 📋 Phase 1 | `src/app/admin/users/` |
| Provider config (admin) | 📋 Phase 1 | `src/app/admin/providers/` |
| Persona mapping (admin) | 📋 Phase 1 | `src/app/admin/personas/` |
| Drizzle schema | 📋 Phase 1 | `src/lib/db/schema.ts` |
| Turso client | 📋 Phase 1 | `src/lib/db/client.ts` |
| Langfuse tracing wrapper | 📋 Phase 1 | `src/lib/providers/traced.ts` |
| Quick mode | 📋 Phase 1 | `src/app/api/quick/route.ts` |
| LangGraph debate graph | 📋 Phase 2 | `src/lib/graph/` |
| Persona definitions | 📋 Phase 2 | `src/lib/personas/` |
| Anti-sycophancy stack | 📋 Phase 2 | `src/lib/anti-sycophancy/` |
| SSE streaming | 📋 Phase 2 | `src/app/api/debate/route.ts` |
| Trigger.dev tasks (optional) | 📋 Phase 2b+ | `src/trigger/` |
| Langfuse LLM-as-judge | 📋 Phase 3 | `src/lib/eval/` |
| MCP context update | 📋 Phase 3 | `src/lib/mcp/` |
| Golden set management | 📋 Phase 3 | `src/lib/eval/golden-sets.ts` |
| LLM Guard integration | 📋 Phase 4 | TBD |
| deepeval-ts integration | 📋 Phase 5 | TBD |

---

## Deployment

### Architecture
```
┌──────────────────────────────────┐
│         Vercel (Frontend)        │
│  Next.js 15 — SSR + API Routes  │
│  Preview deploys on every PR     │
│  Pro: 60s function timeout       │
└──────────┬───────────────────────┘
           │
     ┌─────┼──────────────────┐
     │     │                  │
     ▼     ▼                  ▼
  Turso   LLM APIs    ┌──────────────────┐
  (Edge   (Anthropic,  │  GCP Cloud Run    │
   SQLite) OpenAI,     │  Langfuse         │
           Google AI,  │  (self-hosted)    │
           DeepSeek,   │  + Cloud SQL      │
           Groq)       │  (Postgres)       │
                       └──────────────────┘
```

| Service | Host | Tier | Cost |
|---------|------|------|------|
| Next.js app | Vercel | Free → Pro ($20/mo) | Free during dev |
| Database | Turso | Free → Scaler ($8/mo) | Free covers beta |
| Observability | GCP Cloud Run | Langfuse self-hosted | ~$5-10/mo |
| Langfuse DB | GCP Cloud SQL (Postgres) | Basic | ~$7/mo |
| Long jobs (optional) | Trigger.dev v4 | Cloud (Phase 2b+) | Free tier → $25/mo |

### Gemini Access
Google AI SDK (not Vertex AI). Gemini API key via Google One AI Premium plan.
Uses `@google/generative-ai` SDK — same as other providers, just a different SDK.

### Local Development
```bash
npm run dev                    # Next.js on localhost:3000
npx drizzle-kit studio         # DB browser on localhost:4983
# Langfuse: docker compose up  # localhost:3001
# Trigger.dev v4 (optional, deferred): npx trigger.dev@latest dev
```

### Environment Variables
```bash
# Database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=xxx

# Auth (NextAuth.js v5)
AUTH_SECRET=xxx                            # openssl rand -base64 32
AUTH_GOOGLE_ID=xxx                         # Google OAuth client ID
AUTH_GOOGLE_SECRET=xxx                     # Google OAuth client secret

# Model Providers (env var fallbacks — admin UI overrides these)
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx
GOOGLE_GENERATIVE_AI_API_KEY=xxx
DEEPSEEK_API_KEY=xxx                       # Optional: budget provider
GROQ_API_KEY=xxx                           # Optional: free tier provider

# Observability
LANGFUSE_SECRET_KEY=xxx
LANGFUSE_PUBLIC_KEY=xxx
LANGFUSE_BASEURL=http://localhost:3001     # Local: localhost:3001
                                           # Prod: https://langfuse-xxxxx.run.app

# Trigger.dev v4 (optional, deferred)
TRIGGER_SECRET_KEY=xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000   # Prod: https://the-board.vercel.app
```

### Vercel Configuration
- **Framework:** Next.js (auto-detected)
- **Build command:** `npm run build`
- **Function timeout:** 300s default on Pro (up to 800s max with Fluid Compute)
- **Phase 2a debates:** Run directly on Vercel + LangGraph + SSE (`/api/debate`, see `PHASE2-CONTRACT.md`)
- **Trigger.dev v4:** Optional Phase 2b+ for durability/retries/continue-on-disconnect
- **Preview deploys:** Automatic on every PR branch
- **Environment variables:** Set in Vercel dashboard, never committed

### GCP Cloud Run — Langfuse
```bash
# Deploy Langfuse to Cloud Run (one-time setup)
gcloud run deploy langfuse \
  --image ghcr.io/langfuse/langfuse:latest \
  --port 3000 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=postgres://... \
  --set-env-vars NEXTAUTH_SECRET=xxx \
  --set-env-vars NEXTAUTH_URL=https://langfuse-xxxxx.run.app \
  --min-instances 0 \
  --max-instances 2 \
  --memory 512Mi \
  --region us-central1
```
- Scales to zero when idle (saves cost)
- Cloud SQL Postgres for Langfuse's database
- Internal access only if desired (Vercel backend → Cloud Run via service URL)

---

## Phase 2 Decisions and Open Questions

### Phase 2a Debate Streaming Contract (Resolved for Phase 2a)
Phase 2a uses a single `POST /api/debate` route on Vercel that returns an SSE stream. The client consumes it via `fetch()` + `ReadableStream` reader (not `EventSource`, because `POST`).

Authoritative protocol details live in `PHASE2-CONTRACT.md`:
- request shape
- SSE event envelope + ordering guarantees
- disconnect behavior (Phase 2a)
- HITL-lite signaling

### Trigger.dev v4 Adoption Thresholds (Phase 2b+)
Trigger.dev is deferred for Phase 2a. Revisit only if Vercel + SSE proves insufficient for reliability (timeouts, disconnect-loss, retry needs, or continue-on-disconnect requirements).

### Provider API Key Storage Strategy
- **Phase 1:** Keys stored in Vercel environment variables (server-side only). Admin UI reads from env, no DB storage.
- **Phase 2+:** Migrate to DB storage with application-level encryption. Encryption key stored in Vercel env var (not in DB). Add key rotation support.
- **Future:** Evaluate GCP Secret Manager or Vercel's encrypted env if multi-environment management becomes painful.

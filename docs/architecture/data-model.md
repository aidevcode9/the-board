# Data Model reference

Extracted from the existing architecture specification. These are design-contract examples; source remains the implementation evidence. This documentation change does not alter any frozen interface.

[Architecture index](../../ARCHITECTURE.md)

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

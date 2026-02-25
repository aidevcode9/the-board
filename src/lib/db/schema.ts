// Drizzle ORM schema — Turso (libSQL/SQLite) with portability rules:
// • No SQLite-specific features (autoincrement, BLOB, etc.)
// • Portable column types only: text, integer, real
// • JSON stored as text — parse with Zod at application layer
// • All IDs: CUID2 text strings (not auto-increment integers)
// • Timestamps: integer Unix epoch (portable across SQLite + Postgres)
// • API keys stored as text — encryption is a Phase 4 concern (see REQUIREMENTS.md §10)

import { createId } from '@paralleldrive/cuid2';
import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ── Auth & RBAC ───────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(createId),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'timestamp' }), // Required by @auth/drizzle-adapter
  name: text('name'),
  image: text('image'), // Google OAuth avatar URL
  role: text('role').notNull().default('user'), // 'admin' | 'user' (extensible via DB)
  // $defaultFn required: DrizzleAdapter inserts only NextAuth-standard columns;
  // without a default, NOT NULL constraint fails on every new user creation.
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
});

export const betaCodes = sqliteTable('beta_codes', {
  id: text('id').primaryKey().$defaultFn(createId),
  code: text('code').notNull().unique(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  usedBy: text('used_by').references(() => users.id, { onDelete: 'set null' }),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// sessions uses sessionToken as primary key — matches @auth/drizzle-adapter requirement.
// No synthetic CUID2 id on this table (NextAuth convention).
export const sessions = sqliteTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
});

// accounts uses (provider, providerAccountId) as composite PK — matches @auth/drizzle-adapter.
// Column TS property names must match the adapter's expected interface (snake_case for OAuth fields).
export const accounts = sqliteTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'oauth' | 'email' | 'credentials'
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'), // raw Unix seconds (no timestamp mode — OAuth spec)
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

// ── Provider Configuration ────────────────────────────────────────────────────

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey().$defaultFn(createId),
  name: text('name').notNull().unique(), // "Anthropic", "DeepSeek", "Groq", etc.
  sdkType: text('sdk_type').notNull(), // 'anthropic' | 'openai' | 'google'
  baseUrl: text('base_url').notNull(),
  // NOTE: API key stored as plaintext — encryption deferred to Phase 4 (LLM Guard)
  apiKey: text('api_key').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastTestedAt: integer('last_tested_at', { mode: 'timestamp' }),
  lastTestStatus: text('last_test_status'), // 'success' | 'failure'
  lastTestLatencyMs: integer('last_test_latency_ms'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const providerModels = sqliteTable('provider_models', {
  id: text('id').primaryKey().$defaultFn(createId),
  providerId: text('provider_id')
    .notNull()
    .references(() => providers.id, { onDelete: 'cascade' }),
  modelId: text('model_id').notNull(), // "claude-opus-4-6", "deepseek-chat", etc.
  displayName: text('display_name').notNull(), // "Claude Opus 4.6"
  inputCostPer1M: real('input_cost_per_1m'),
  outputCostPer1M: real('output_cost_per_1m'),
  maxContextTokens: integer('max_context_tokens'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const personaMappings = sqliteTable(
  'persona_mappings',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    presetName: text('preset_name').notNull(), // 'frontier' | 'budget' | 'free' | 'custom'
    personaSlot: text('persona_slot').notNull(), // 'analyst' | 'builder' | 'synthesizer'
    providerModelId: text('provider_model_id')
      .notNull()
      .references(() => providerModels.id, { onDelete: 'cascade' }),
    isDefault: integer('is_default', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('preset_persona_idx').on(table.presetName, table.personaSlot)],
);

// ── Workspaces & Debates ──────────────────────────────────────────────────────

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    name: text('name').notNull(),
    domain: text('domain').notNull(), // 'system-design' | 'ai-ethics' | etc.
    contextPath: text('context_path'), // path to domain CONTEXT.md file
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('workspace_domain_user_idx').on(table.domain, table.createdBy)],
);

export const debates = sqliteTable('debates', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  mode: text('mode').notNull(), // 'quick' | 'compare' | 'debate' | 'deep'
  domain: text('domain').notNull(),

  // Role assignment (set by router node)
  leadModel: text('lead_model'), // 'claude' | 'gpt' | 'gemini'
  challengerModel: text('challenger_model'),
  synthesizerModel: text('synthesizer_model'),

  // Results
  synthesizedAnswer: text('synthesized_answer'),
  convergence: integer('convergence', { mode: 'boolean' }),
  rounds: integer('rounds').default(0),
  transcript: text('transcript'), // JSON blob — parse with Zod at app layer

  // Metrics
  totalCostUsd: real('total_cost_usd'),
  totalLatencyMs: integer('total_latency_ms'),
  totalTokens: integer('total_tokens'),

  // Eval
  evalScore: real('eval_score'),
  evalDetails: text('eval_details'), // JSON blob — parse with Zod at app layer
  addedToGoldenSet: integer('added_to_golden_set', { mode: 'boolean' }).default(false),

  // Sycophancy tracking
  sycophancyFlags: text('sycophancy_flags'), // JSON array — parse with Zod at app layer

  langfuseTraceId: text('langfuse_trace_id'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const debateResponses = sqliteTable('debate_responses', {
  id: text('id').primaryKey().$defaultFn(createId),
  debateId: text('debate_id')
    .notNull()
    .references(() => debates.id, { onDelete: 'cascade' }),
  phase: text('phase').notNull(), // 'independent' | 'review' | 'synthesis' | 'validation'
  round: integer('round').notNull(),
  model: text('model').notNull(), // 'claude' | 'gpt' | 'gemini'
  role: text('role').notNull(), // Quick: persona slot ('analyst'|'builder'|'synthesizer'); Debate: 'lead'|'challenger'|'synthesizer'
  content: text('content').notNull(),
  confidence: real('confidence'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  latencyMs: integer('latency_ms'),
  costUsd: real('cost_usd'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Eval & Golden Sets ────────────────────────────────────────────────────────

export const goldenSets = sqliteTable('golden_sets', {
  id: text('id').primaryKey().$defaultFn(createId),
  domain: text('domain').notNull(),
  query: text('query').notNull(),
  expectedBehavior: text('expected_behavior').notNull(), // What a good answer looks like
  debateId: text('debate_id').references(() => debates.id, { onDelete: 'set null' }),
  evalThreshold: real('eval_threshold').default(0.85),
  status: text('status').default('active'), // 'active' | 'retired'
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const evalRuns = sqliteTable('eval_runs', {
  id: text('id').primaryKey().$defaultFn(createId),
  debateId: text('debate_id').references(() => debates.id, { onDelete: 'cascade' }),
  goldenSetId: text('golden_set_id').references(() => goldenSets.id, { onDelete: 'cascade' }),
  metric: text('metric').notNull(), // 'relevancy' | 'faithfulness' | 'completeness' | 'debate_quality'
  score: real('score').notNull(),
  details: text('details'), // JSON explanation — parse with Zod at app layer
  evaluator: text('evaluator').notNull(), // 'langfuse-judge' | 'deepeval-cloud'
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Type exports ──────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type BetaCode = typeof betaCodes.$inferSelect;
export type NewBetaCode = typeof betaCodes.$inferInsert;

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;

export type ProviderModel = typeof providerModels.$inferSelect;
export type NewProviderModel = typeof providerModels.$inferInsert;

export type PersonaMapping = typeof personaMappings.$inferSelect;
export type NewPersonaMapping = typeof personaMappings.$inferInsert;

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type Debate = typeof debates.$inferSelect;
export type NewDebate = typeof debates.$inferInsert;

export type DebateResponse = typeof debateResponses.$inferSelect;
export type NewDebateResponse = typeof debateResponses.$inferInsert;

export type GoldenSet = typeof goldenSets.$inferSelect;
export type NewGoldenSet = typeof goldenSets.$inferInsert;

export type EvalRun = typeof evalRuns.$inferSelect;
export type NewEvalRun = typeof evalRuns.$inferInsert;

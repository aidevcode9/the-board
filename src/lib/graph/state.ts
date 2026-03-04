// ── LangGraph Debate State ──────────────────────────────────────────────────
// Annotation.Root for LangGraph state management + Zod schemas for validation.
// See ARCHITECTURE.md § LangGraph State Interface for the canonical schema.

import { Annotation } from '@langchain/langgraph';
import { z } from 'zod';

// ── Zod Schemas (validation at graph entry/exit) ────────────────────────────

export const ModelId = z.enum(['analyst', 'builder', 'synthesizer']);
export type ModelId = z.infer<typeof ModelId>;

export const DebateMode = z.enum(['quick', 'compare', 'debate', 'deep']);
export type DebateMode = z.infer<typeof DebateMode>;

export const DebatePhase = z.enum(['independent', 'review', 'synthesis', 'validation']);
export type DebatePhase = z.infer<typeof DebatePhase>;

export const ModelResponseSchema = z.object({
  content: z.string(),
  confidence: z.number().min(0).max(1),
  tokens: z.object({ prompt: z.number(), completion: z.number() }),
  latencyMs: z.number(),
  costUsd: z.number(),
});
export type ModelResponse = z.infer<typeof ModelResponseSchema>;

export const ReviewSchema = z.object({
  flaws: z.array(z.string()),
  strengths: z.array(z.string()),
  suggestions: z.array(z.string()),
  overallAssessment: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const ValidationSchema = z.object({
  agrees: z.boolean(),
  disagreementReason: z.string().optional(),
  confidence: z.number().min(0).max(1),
});
export type Validation = z.infer<typeof ValidationSchema>;

export const SycophancyFlagSchema = z.object({
  type: z.enum([
    'confidence_collapse',
    'blind_agreement',
    'diminishing_returns',
    'position_reversal',
  ]),
  model: ModelId,
  round: z.number(),
  details: z.string(),
});
export type SycophancyFlag = z.infer<typeof SycophancyFlagSchema>;

export const RoleConfigSchema = z.object({
  lead: ModelId,
  challenger: ModelId,
  synthesizer: ModelId,
  weights: z.object({
    analyst: z.number(),
    builder: z.number(),
    synthesizer: z.number(),
  }),
});
export type RoleConfig = z.infer<typeof RoleConfigSchema>;

export const SynthesisSchema = z.object({
  content: z.string(),
  confidencePerClaim: z.record(z.string(), z.number()),
  synthesizedBy: ModelId,
});
export type Synthesis = z.infer<typeof SynthesisSchema>;

// ── LangGraph Annotation (state management with reducers) ──────────────────

/** Merge reducer: merge incoming record keys into existing record */
function mergeRecords<T>(current: Record<string, T>, update: Record<string, T>): Record<string, T> {
  return { ...current, ...update };
}

/** Additive reducer: sum values */
function addNumbers(current: number, update: number): number {
  return current + update;
}

/** Append reducer: concat arrays */
function appendArray<T>(current: T[], update: T[]): T[] {
  return [...current, ...update];
}

export const DebateStateAnnotation = Annotation.Root({
  // Input (set once at graph entry)
  query: Annotation<string>,
  mode: Annotation<DebateMode>,
  domain: Annotation<string>,
  workspaceId: Annotation<string>,
  debateId: Annotation<string>,
  userId: Annotation<string>,

  // Role assignment (set by route node)
  roleConfig: Annotation<RoleConfig | undefined>,

  // Phase 1: Independent responses — merge reducer for parallel accumulation
  responses: Annotation<Record<string, ModelResponse>>({
    reducer: mergeRecords,
    default: () => ({}),
  }),

  // Phase 2: Cross-reviews — merge reducer for parallel accumulation
  reviews: Annotation<Record<string, { ofResponseA: Review; ofResponseB: Review }>>({
    reducer: mergeRecords,
    default: () => ({}),
  }),

  // Phase 3: Synthesis
  synthesis: Annotation<Synthesis | undefined>,

  // Phase 3b: Validations — merge reducer for parallel accumulation
  validations: Annotation<Record<string, Validation>>({
    reducer: mergeRecords,
    default: () => ({}),
  }),

  // Control flow
  currentPhase: Annotation<DebatePhase>,
  round: Annotation<number>,
  maxRounds: Annotation<number>,
  convergence: Annotation<boolean>,
  hitlRequired: Annotation<boolean>,

  // Sycophancy tracking — append reducer for accumulation
  sycophancyFlags: Annotation<SycophancyFlag[]>({
    reducer: appendArray,
    default: () => [],
  }),

  // Metrics — additive reducer for cost accumulation
  totalCostUsd: Annotation<number>({
    reducer: addNumbers,
    default: () => 0,
  }),

  // Tracing
  langfuseTraceId: Annotation<string | undefined>,
});

export type DebateState = typeof DebateStateAnnotation.State;
export type DebateStateUpdate = typeof DebateStateAnnotation.Update;

// ── Helper: Create initial state from input ────────────────────────────────

const MAX_ROUNDS: Record<DebateMode, number> = {
  quick: 0,
  compare: 0,
  debate: 2,
  deep: 4,
};

export function createInitialState(input: {
  query: string;
  mode: DebateMode;
  domain: string;
  workspaceId: string;
  debateId: string;
  userId: string;
}): DebateState {
  return {
    query: input.query,
    mode: input.mode,
    domain: input.domain,
    workspaceId: input.workspaceId,
    debateId: input.debateId,
    userId: input.userId,
    roleConfig: undefined,
    responses: {},
    reviews: {},
    synthesis: undefined,
    validations: {},
    currentPhase: 'independent',
    round: 1,
    maxRounds: MAX_ROUNDS[input.mode],
    convergence: false,
    hitlRequired: false,
    sycophancyFlags: [],
    totalCostUsd: 0,
    langfuseTraceId: undefined,
  };
}

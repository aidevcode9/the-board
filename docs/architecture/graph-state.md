# Graph State reference

Extracted from the existing architecture specification. These are design-contract examples; source remains the implementation evidence. This documentation change does not alter any frozen interface.

[Architecture index](../../ARCHITECTURE.md)

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

## Execution corrections (2026-10-07)

Serial coordinators own phase and round transitions; parallel workers only merge
persona records and add cost/flags. The independent batch joins before one review
fan-out. Each review batch joins before one synthesis, followed by two non-lead
validators and one convergence decision. The compiled graph carries a 40-step
execution budget because four cycles with barriers exceed the default 25 steps;
routing still caps Debate at two cycles and Deep at four.

`round` identifies the current/completed cycle, starting at one. Only the
`advance_review` coordinator increments it. Validation records carry runtime
`round` and `status` (`valid`, `invalid`, `failed`); legacy records without them
remain readable but cannot establish convergence. Valid disagreement is distinct
from invalid JSON or a failed provider. The final synthesis is retained at the
cap and unresolved/incomplete validation triggers the existing review signal.
No durable approval or resume mechanism is introduced.

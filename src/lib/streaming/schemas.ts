import { z } from 'zod';

export const debateModeSchema = z.enum(['compare', 'debate', 'deep']);

export const debateRequestSchema = z.object({
  query: z.string().min(1).max(10_000),
  mode: debateModeSchema,
  workspaceId: z.string().min(1).max(100).nullable().optional(),
  domain: z.string().min(1).max(100).nullable().optional(),
});

export type DebateRequest = z.infer<typeof debateRequestSchema>;

export const debatePhaseSchema = z.enum(['independent', 'review', 'synthesis', 'validation']);

export const debateStreamEventTypeSchema = z.enum([
  'run_started',
  'phase_started',
  'participant_started',
  'participant_token',
  'participant_completed',
  'phase_completed',
  'cost_updated',
  'human_review_required',
  'eval_completed',
  'run_completed',
  'error',
]);

export type DebateStreamEventType = z.infer<typeof debateStreamEventTypeSchema>;

export const debateStreamEventSchema = z.object({
  v: z.literal(1),
  seq: z.number().int().positive(),
  debateId: z.string().min(1),
  type: debateStreamEventTypeSchema,
  ts: z.string().min(1),
  phase: debatePhaseSchema.optional(),
  round: z.number().int().positive().optional(),
  payload: z.record(z.unknown()),
});

export type DebateStreamEvent = z.infer<typeof debateStreamEventSchema>;

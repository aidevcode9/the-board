import { describe, expect, it, vi } from 'vitest';

// Mock server-only (no-op in test — imported transitively by context loader)
vi.mock('server-only', () => ({}));

import { KNOWN_DOMAINS } from '../../../src/lib/context';
import {
  EVAL_SCORE_THRESHOLD,
  KNOWN_SECTIONS,
  type UpdateKnowledgeInput,
  type UpdateKnowledgeResult,
  executeUpdateKnowledge,
  updateKnowledgeInputSchema,
  updateKnowledgeOutputSchema,
} from '../../../src/lib/mcp/tools/update-knowledge';

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('updateKnowledgeInputSchema', () => {
  it('accepts valid input with all required fields', () => {
    const input: UpdateKnowledgeInput = {
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'CAP theorem trade-offs in distributed databases.',
      debateId: 'clx1234567890',
      evalScore: 0.92,
    };
    const result = updateKnowledgeInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects empty domain', () => {
    const result = updateKnowledgeInputSchema.safeParse({
      domain: '',
      section: 'coreConcepts',
      insight: 'Some insight',
      debateId: 'clx123',
      evalScore: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty insight', () => {
    const result = updateKnowledgeInputSchema.safeParse({
      domain: 'security',
      section: 'coreConcepts',
      insight: '',
      debateId: 'clx123',
      evalScore: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it('rejects evalScore below 0', () => {
    const result = updateKnowledgeInputSchema.safeParse({
      domain: 'security',
      section: 'coreConcepts',
      insight: 'Valid insight',
      debateId: 'clx123',
      evalScore: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects evalScore above 1', () => {
    const result = updateKnowledgeInputSchema.safeParse({
      domain: 'security',
      section: 'coreConcepts',
      insight: 'Valid insight',
      debateId: 'clx123',
      evalScore: 1.1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts evalScore at boundaries (0 and 1)', () => {
    const base = {
      domain: 'security',
      section: 'coreConcepts' as const,
      insight: 'Valid insight',
      debateId: 'clx123',
    };
    expect(updateKnowledgeInputSchema.safeParse({ ...base, evalScore: 0 }).success).toBe(true);
    expect(updateKnowledgeInputSchema.safeParse({ ...base, evalScore: 1 }).success).toBe(true);
  });

  it('rejects invalid section name', () => {
    const result = updateKnowledgeInputSchema.safeParse({
      domain: 'security',
      section: 'invalidSection',
      insight: 'Valid insight',
      debateId: 'clx123',
      evalScore: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it('accepts all known section names', () => {
    for (const section of KNOWN_SECTIONS) {
      const result = updateKnowledgeInputSchema.safeParse({
        domain: 'security',
        section,
        insight: 'Valid insight',
        debateId: 'clx123',
        evalScore: 0.9,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects missing required fields', () => {
    expect(updateKnowledgeInputSchema.safeParse({}).success).toBe(false);
    expect(updateKnowledgeInputSchema.safeParse({ domain: 'security' }).success).toBe(false);
  });

  it('rejects unknown domain name', () => {
    const result = updateKnowledgeInputSchema.safeParse({
      domain: 'unknown-domain',
      section: 'coreConcepts',
      insight: 'Valid insight',
      debateId: 'clx123',
      evalScore: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it('rejects path-traversal-style domain', () => {
    const result = updateKnowledgeInputSchema.safeParse({
      domain: '../../etc',
      section: 'coreConcepts',
      insight: 'Valid insight',
      debateId: 'clx123',
      evalScore: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it('rejects insight exceeding max length', () => {
    const result = updateKnowledgeInputSchema.safeParse({
      domain: 'security',
      section: 'coreConcepts',
      insight: 'x'.repeat(2001),
      debateId: 'clx123',
      evalScore: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it('accepts insight at max length boundary', () => {
    const result = updateKnowledgeInputSchema.safeParse({
      domain: 'security',
      section: 'coreConcepts',
      insight: 'x'.repeat(2000),
      debateId: 'clx123',
      evalScore: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it('rejects debateId exceeding max length', () => {
    const result = updateKnowledgeInputSchema.safeParse({
      domain: 'security',
      section: 'coreConcepts',
      insight: 'Valid insight',
      debateId: 'x'.repeat(129),
      evalScore: 0.9,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateKnowledgeOutputSchema', () => {
  it('accepts valid output with updated status', () => {
    const output: UpdateKnowledgeResult = {
      status: 'updated',
      domain: 'system-design',
      section: 'coreConcepts',
      message: 'Knowledge updated successfully.',
    };
    const result = updateKnowledgeOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('accepts valid output with gated status', () => {
    const output: UpdateKnowledgeResult = {
      status: 'gated',
      domain: 'security',
      section: 'disagreements',
      message: 'Tool execution gated until Phase 3.',
    };
    const result = updateKnowledgeOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('accepts valid output with below_threshold status', () => {
    const output: UpdateKnowledgeResult = {
      status: 'below_threshold',
      domain: 'security',
      section: 'misconceptions',
      message: 'Eval score 0.70 is below threshold 0.85.',
    };
    const result = updateKnowledgeOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = updateKnowledgeOutputSchema.safeParse({
      status: 'invalid',
      domain: 'security',
      section: 'coreConcepts',
      message: 'Invalid',
    });
    expect(result.success).toBe(false);
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('EVAL_SCORE_THRESHOLD is 0.85', () => {
    expect(EVAL_SCORE_THRESHOLD).toBe(0.85);
  });

  it('KNOWN_SECTIONS covers all DomainContext sections', () => {
    expect(KNOWN_SECTIONS).toContain('coreConcepts');
    expect(KNOWN_SECTIONS).toContain('disagreements');
    expect(KNOWN_SECTIONS).toContain('interviewFramings');
    expect(KNOWN_SECTIONS).toContain('misconceptions');
    expect(KNOWN_SECTIONS.length).toBe(4);
  });
});

// ── Handler Execution ─────────────────────────────────────────────────────────

describe('executeUpdateKnowledge', () => {
  it('returns gated status in Phase 1 regardless of valid input', async () => {
    const input: UpdateKnowledgeInput = {
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'New insight about CAP theorem.',
      debateId: 'clx_abc123',
      evalScore: 0.92,
    };
    const result = await executeUpdateKnowledge(input);
    expect(result.status).toBe('gated');
    expect(result.domain).toBe('system-design');
    expect(result.section).toBe('coreConcepts');
    expect(result.message).toContain('Phase 3');
  });

  it('returns below_threshold when evalScore is below 0.85', async () => {
    const input: UpdateKnowledgeInput = {
      domain: 'security',
      section: 'misconceptions',
      insight: 'Some insight.',
      debateId: 'clx_def456',
      evalScore: 0.7,
    };
    const result = await executeUpdateKnowledge(input);
    expect(result.status).toBe('below_threshold');
    expect(result.message).toContain('0.70');
    expect(result.message).toContain('0.85');
  });

  it('returns below_threshold for score exactly at threshold boundary', async () => {
    const input: UpdateKnowledgeInput = {
      domain: 'ai-ethics',
      section: 'disagreements',
      insight: 'Ethics insight.',
      debateId: 'clx_ghi789',
      evalScore: 0.85,
    };
    // At exactly 0.85, should pass threshold check but still be gated in Phase 1
    const result = await executeUpdateKnowledge(input);
    // Score >= 0.85 passes threshold, but Phase 1 gates execution
    expect(result.status).toBe('gated');
  });

  it('returns below_threshold for score just below threshold', async () => {
    const input: UpdateKnowledgeInput = {
      domain: 'ai-ethics',
      section: 'disagreements',
      insight: 'Ethics insight.',
      debateId: 'clx_jkl012',
      evalScore: 0.849,
    };
    const result = await executeUpdateKnowledge(input);
    expect(result.status).toBe('below_threshold');
  });

  it('preserves domain and section in output', async () => {
    const input: UpdateKnowledgeInput = {
      domain: 'ml-engineering',
      section: 'interviewFramings',
      insight: 'Feature store patterns.',
      debateId: 'clx_mno345',
      evalScore: 0.95,
    };
    const result = await executeUpdateKnowledge(input);
    expect(result.domain).toBe('ml-engineering');
    expect(result.section).toBe('interviewFramings');
  });
});

// ── Domain Coverage ───────────────────────────────────────────────────────────

describe('domain coverage', () => {
  it('accepts all KNOWN_DOMAINS from context loader', async () => {
    for (const domain of KNOWN_DOMAINS) {
      const input: UpdateKnowledgeInput = {
        domain,
        section: 'coreConcepts',
        insight: `Insight for ${domain}.`,
        debateId: `clx_${domain}`,
        evalScore: 0.9,
      };
      const result = updateKnowledgeInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });
});

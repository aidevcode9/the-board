import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock server-only (no-op in test — imported transitively by context loader)
vi.mock('server-only', () => ({}));

// Mock the writer module to isolate handler logic from filesystem
vi.mock('../../../src/lib/context/writer', () => ({
  SECTION_HEADINGS: {
    coreConcepts: 'Core Concepts',
    disagreements: 'Key Disagreements & Resolutions',
    interviewFramings: 'Interview Framings',
    misconceptions: 'Common Misconceptions',
  },
  appendInsightToSection: vi.fn(),
}));

import { appendInsightToSection } from '../../../src/lib/context/writer';
import type { UpdateKnowledgeInput } from '../../../src/lib/mcp/tools/update-knowledge';
import { executeUpdateKnowledge } from '../../../src/lib/mcp/tools/update-knowledge';

const mockAppendInsight = vi.mocked(appendInsightToSection);

// ── Phase 3 Handler Activation ──────────────────────────────────────────────

describe('executeUpdateKnowledge (Phase 3 — active)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls appendInsightToSection and returns updated on success', async () => {
    mockAppendInsight.mockResolvedValue({
      status: 'updated',
      message: 'Insight appended to Core Concepts.',
    });

    const input: UpdateKnowledgeInput = {
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'New insight about CAP theorem.',
      debateId: 'clx_abc123',
      evalScore: 0.92,
    };
    const result = await executeUpdateKnowledge(input);

    expect(result.status).toBe('updated');
    expect(result.domain).toBe('system-design');
    expect(result.section).toBe('coreConcepts');
    expect(mockAppendInsight).toHaveBeenCalledOnce();
    expect(mockAppendInsight).toHaveBeenCalledWith({
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'New insight about CAP theorem.',
      debateId: 'clx_abc123',
    });
  });

  it('still returns below_threshold when evalScore is below 0.85', async () => {
    const input: UpdateKnowledgeInput = {
      domain: 'security',
      section: 'misconceptions',
      insight: 'Some insight.',
      debateId: 'clx_def456',
      evalScore: 0.7,
    };
    const result = await executeUpdateKnowledge(input);

    expect(result.status).toBe('below_threshold');
    expect(mockAppendInsight).not.toHaveBeenCalled();
  });

  it('returns file_not_found when writer reports missing file', async () => {
    mockAppendInsight.mockResolvedValue({
      status: 'file_not_found',
      message: 'CONTEXT.md not found for domain.',
    });

    const input: UpdateKnowledgeInput = {
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'Insight for missing domain.',
      debateId: 'clx_missing',
      evalScore: 0.9,
    };
    const result = await executeUpdateKnowledge(input);

    // Handler should pass through writer's status
    expect(result.status).not.toBe('gated');
  });

  it('returns budget_exceeded when writer reports token overflow', async () => {
    mockAppendInsight.mockResolvedValue({
      status: 'budget_exceeded',
      message: 'Token budget exceeded.',
    });

    const input: UpdateKnowledgeInput = {
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'Insight for full file.',
      debateId: 'clx_budget',
      evalScore: 0.95,
    };
    const result = await executeUpdateKnowledge(input);

    expect(result.status).not.toBe('updated');
  });
});

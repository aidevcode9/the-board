// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock server-only (no-op in test)
vi.mock('server-only', () => ({}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock node:path — resolve must enforce real path resolution for traversal checks
vi.mock('node:path', () => ({
  join: vi.fn((...segments: string[]) => segments.join('/')),
  resolve: vi.fn((...segments: string[]) => {
    // Simplified resolve: normalize '..' for path traversal detection
    const joined = segments.join('/');
    const parts = joined.split('/');
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') resolved.pop();
      else if (part !== '.') resolved.push(part);
    }
    return resolved.join('/');
  }),
}));

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ── Test Fixtures ─────────────────────────────────────────────────────────────

const VALID_CONTEXT_MD = `# System Design — Interview Prep Knowledge

> Auto-updated from high-quality debates. Last update: 2026-02-25

---

## Overview

System design interviews test your ability to reason about large-scale systems.

---

## Core Concepts

### CAP Theorem
- **Definition:** Consistency, Availability, Partition-tolerance trade-offs.
- **Interview relevance:** Shows engineering maturity.

### Eventual Consistency
- **Definition:** Converges to consistent state over time.

---

## Key Disagreements & Resolutions

### Strong vs Eventual Consistency
- When to use strong: financial transactions
- When to use eventual: social media feeds

---

## Interview Framings

### Rate Limiting Design
- Start with constraints, mention algorithms, discuss coordination.

---

## Common Misconceptions

- **Myth:** Distributed systems are just scaled-up single instances.
  - **Reality:** They introduce fundamentally new failure modes.

---

## References

- Contributing debate IDs: debate-001, debate-002
`;

const MINIMAL_CONTEXT_MD = `# General — Interview Prep Knowledge

> Auto-updated from high-quality debates. Last update: 2026-02-25

---

## Overview

General interview preparation knowledge.

---

## Core Concepts

---

## Key Disagreements & Resolutions

*(This section grows as debates contribute knowledge.)*

---

## Interview Framings

*(This section grows as high-scoring debates identify effective answer patterns.)*

---

## Common Misconceptions

*(This section grows as debate critiques identify recurring misunderstandings.)*

---

## References

- Contributing debate IDs: *(none yet)*
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('loadDomainContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and parses a domain CONTEXT.md file', async () => {
    vi.mocked(readFile).mockResolvedValue(VALID_CONTEXT_MD);

    const { loadDomainContext } = await import('@/lib/context/loader');

    const result = await loadDomainContext('system-design');

    expect(result).not.toBeNull();
    expect(result?.domain).toBe('system-design');
    expect(result?.rawContent).toBe(VALID_CONTEXT_MD);
  });

  it('resolves default path from domain name', async () => {
    vi.mocked(readFile).mockResolvedValue(MINIMAL_CONTEXT_MD);

    const { loadDomainContext } = await import('@/lib/context/loader');

    await loadDomainContext('ai-ethics');

    expect(join).toHaveBeenCalled();
    const joinCall = vi.mocked(join).mock.calls[0];
    expect(joinCall).toBeDefined();
    expect(joinCall?.some((s: string) => s.includes('ai-ethics'))).toBe(true);
  });

  it('uses custom contextPath when provided', async () => {
    vi.mocked(readFile).mockResolvedValue(MINIMAL_CONTEXT_MD);

    const { loadDomainContext } = await import('@/lib/context/loader');

    await loadDomainContext('custom', 'contexts/custom/CONTEXT.md');

    expect(readFile).toHaveBeenCalled();
  });

  it('returns null for non-existent domain file', async () => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    vi.mocked(readFile).mockRejectedValue(err);

    const { loadDomainContext } = await import('@/lib/context/loader');

    const result = await loadDomainContext('nonexistent');

    expect(result).toBeNull();
  });

  it('throws DomainContextError on non-ENOENT file errors', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('Permission denied'));

    const { loadDomainContext, DomainContextError } = await import('@/lib/context/loader');

    await expect(loadDomainContext('system-design')).rejects.toThrow(DomainContextError);
  });

  it('does not leak filesystem paths in error messages', async () => {
    vi.mocked(readFile).mockRejectedValue(
      new Error("EPERM: operation not permitted, open '/server/path/CONTEXT.md'"),
    );

    const { loadDomainContext } = await import('@/lib/context/loader');

    try {
      await loadDomainContext('system-design');
    } catch (err) {
      expect((err as Error).message).not.toContain('/server/path');
      expect((err as Error).message).toContain('system-design');
    }
  });
});

describe('path traversal protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects domain with path traversal characters', async () => {
    const { loadDomainContext, DomainContextError } = await import('@/lib/context/loader');

    await expect(loadDomainContext('../../etc')).rejects.toThrow(DomainContextError);
  });

  it('rejects contextPath that escapes contexts directory', async () => {
    const { loadDomainContext, DomainContextError } = await import('@/lib/context/loader');

    await expect(loadDomainContext('x', '../../.env')).rejects.toThrow(DomainContextError);
  });

  it('rejects contextPath with absolute path outside contexts', async () => {
    const { loadDomainContext, DomainContextError } = await import('@/lib/context/loader');

    await expect(loadDomainContext('x', '/etc/passwd')).rejects.toThrow(DomainContextError);
  });

  it('throws error with PATH_TRAVERSAL code', async () => {
    const { loadDomainContext, DomainContextError } = await import('@/lib/context/loader');

    try {
      await loadDomainContext('../../etc');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainContextError);
      expect((err as InstanceType<typeof DomainContextError>).code).toBe('PATH_TRAVERSAL');
    }
  });
});

describe('parseDomainContext', () => {
  it('extracts overview section', async () => {
    const { parseDomainContext } = await import('@/lib/context/loader');

    const result = parseDomainContext(VALID_CONTEXT_MD, 'system-design');

    expect(result.overview).toContain('large-scale systems');
  });

  it('extracts core concepts section', async () => {
    const { parseDomainContext } = await import('@/lib/context/loader');

    const result = parseDomainContext(VALID_CONTEXT_MD, 'system-design');

    expect(result.coreConcepts).toContain('CAP Theorem');
    expect(result.coreConcepts).toContain('Eventual Consistency');
  });

  it('extracts disagreements section', async () => {
    const { parseDomainContext } = await import('@/lib/context/loader');

    const result = parseDomainContext(VALID_CONTEXT_MD, 'system-design');

    expect(result.disagreements).toContain('Strong vs Eventual');
  });

  it('extracts interview framings section', async () => {
    const { parseDomainContext } = await import('@/lib/context/loader');

    const result = parseDomainContext(VALID_CONTEXT_MD, 'system-design');

    expect(result.interviewFramings).toContain('Rate Limiting');
  });

  it('extracts misconceptions section', async () => {
    const { parseDomainContext } = await import('@/lib/context/loader');

    const result = parseDomainContext(VALID_CONTEXT_MD, 'system-design');

    expect(result.misconceptions).toContain('scaled-up single instances');
  });

  it('handles minimal context with empty sections', async () => {
    const { parseDomainContext } = await import('@/lib/context/loader');

    const result = parseDomainContext(MINIMAL_CONTEXT_MD, 'general');

    expect(result.domain).toBe('general');
    expect(result.overview).toContain('General interview');
    expect(result.coreConcepts).toBe('');
    expect(result.disagreements).toContain('grows as debates');
    expect(result.interviewFramings).toContain('grows as high-scoring');
    expect(result.misconceptions).toContain('grows as debate critiques');
  });

  it('preserves raw content', async () => {
    const { parseDomainContext } = await import('@/lib/context/loader');

    const result = parseDomainContext(VALID_CONTEXT_MD, 'system-design');

    expect(result.rawContent).toBe(VALID_CONTEXT_MD);
  });

  it('sets domain from parameter', async () => {
    const { parseDomainContext } = await import('@/lib/context/loader');

    const result = parseDomainContext(VALID_CONTEXT_MD, 'my-domain');

    expect(result.domain).toBe('my-domain');
  });
});

describe('estimateTokenCount', () => {
  it('estimates tokens using ~3 chars per token heuristic', async () => {
    const { estimateTokenCount } = await import('@/lib/context/loader');

    // 300 chars / 3 = 100 tokens
    const text = 'a'.repeat(300);
    const estimate = estimateTokenCount(text);

    expect(estimate).toBe(100);
  });

  it('returns 0 for empty string', async () => {
    const { estimateTokenCount } = await import('@/lib/context/loader');

    expect(estimateTokenCount('')).toBe(0);
  });
});

describe('validateContextSize', () => {
  it('passes when content is within token budget', async () => {
    const { validateContextSize } = await import('@/lib/context/loader');

    // 300 chars / 3 = 100 tokens, well under 4000 budget
    const result = validateContextSize('a'.repeat(300));

    expect(result.isWithinBudget).toBe(true);
    expect(result.estimatedTokens).toBe(100);
    expect(result.maxTokens).toBe(4000);
  });

  it('fails when content exceeds token budget', async () => {
    const { validateContextSize } = await import('@/lib/context/loader');

    // 15000 chars / 3 = 5000 tokens, over 4000 budget
    const result = validateContextSize('a'.repeat(15000));

    expect(result.isWithinBudget).toBe(false);
    expect(result.estimatedTokens).toBe(5000);
  });

  it('respects custom maxTokens parameter', async () => {
    const { validateContextSize } = await import('@/lib/context/loader');

    // 300 chars / 3 = 100 tokens, over 50 budget
    const result = validateContextSize('a'.repeat(300), 50);

    expect(result.isWithinBudget).toBe(false);
    expect(result.maxTokens).toBe(50);
  });
});

describe('KNOWN_DOMAINS', () => {
  it('exports the list of known domain identifiers', async () => {
    const { KNOWN_DOMAINS } = await import('@/lib/context/loader');

    expect(KNOWN_DOMAINS).toContain('system-design');
    expect(KNOWN_DOMAINS).toContain('ai-ethics');
    expect(KNOWN_DOMAINS).toContain('code-generation');
    expect(KNOWN_DOMAINS).toContain('security');
    expect(KNOWN_DOMAINS).toContain('distributed-systems');
    expect(KNOWN_DOMAINS).toContain('ml-engineering');
    expect(KNOWN_DOMAINS).toHaveLength(6);
  });
});

describe('DEFAULT_CONTEXT_DIR', () => {
  it('exports the default context directory path', async () => {
    const { DEFAULT_CONTEXT_DIR } = await import('@/lib/context/loader');

    expect(DEFAULT_CONTEXT_DIR).toBe('contexts');
  });
});

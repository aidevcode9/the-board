import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock server-only (no-op in test — imported transitively by context loader)
vi.mock('server-only', () => ({}));

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SECTION_HEADINGS, appendInsightToSection } from '../../src/lib/context/writer';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_CONTEXT_MD = `# System Design — Interview Prep Knowledge

> Auto-updated from high-quality debates. Last update: 2026-02-25

---

## Overview

System design interviews test your ability to reason about large-scale systems.

---

## Core Concepts

### CAP Theorem
- Consistency, Availability, Partition-tolerance.

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

let testDir: string;

beforeEach(async () => {
  // Create a temp directory with a domain context file
  testDir = join(tmpdir(), `the-board-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const domainDir = join(testDir, 'contexts', 'system-design');
  await mkdir(domainDir, { recursive: true });
  await writeFile(join(domainDir, 'CONTEXT.md'), SAMPLE_CONTEXT_MD, 'utf-8');
});

afterEach(async () => {
  // Clean up temp dir
  const { rm } = await import('node:fs/promises');
  await rm(testDir, { recursive: true, force: true });
});

// ── Section Heading Mapping ──────────────────────────────────────────────────

describe('SECTION_HEADINGS', () => {
  it('maps all known section keys to markdown headings', () => {
    expect(SECTION_HEADINGS.coreConcepts).toBe('Core Concepts');
    expect(SECTION_HEADINGS.disagreements).toBe('Key Disagreements & Resolutions');
    expect(SECTION_HEADINGS.interviewFramings).toBe('Interview Framings');
    expect(SECTION_HEADINGS.misconceptions).toBe('Common Misconceptions');
  });
});

// ── appendInsightToSection ───────────────────────────────────────────────────

describe('appendInsightToSection', () => {
  it('appends insight bullet to the correct section', async () => {
    const result = await appendInsightToSection({
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'Paxos vs Raft: Raft is easier to implement but Paxos handles more edge cases.',
      debateId: 'clx_test123',
      contextDir: join(testDir, 'contexts'),
    });

    expect(result.status).toBe('updated');
    const content = await readFile(
      join(testDir, 'contexts', 'system-design', 'CONTEXT.md'),
      'utf-8',
    );
    expect(content).toContain('Paxos vs Raft');
    expect(content).toContain('clx_test123');
  });

  it('updates the "Last update" date in header', async () => {
    await appendInsightToSection({
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'Test insight.',
      debateId: 'clx_date_test',
      contextDir: join(testDir, 'contexts'),
    });

    const content = await readFile(
      join(testDir, 'contexts', 'system-design', 'CONTEXT.md'),
      'utf-8',
    );
    // Should update the date from 2026-02-25 to today
    expect(content).not.toContain('Last update: 2026-02-25');
    expect(content).toMatch(/Last update: \d{4}-\d{2}-\d{2}/);
  });

  it('adds debateId to the References section', async () => {
    await appendInsightToSection({
      domain: 'system-design',
      section: 'disagreements',
      insight: 'Disagreement insight.',
      debateId: 'clx_ref_test',
      contextDir: join(testDir, 'contexts'),
    });

    const content = await readFile(
      join(testDir, 'contexts', 'system-design', 'CONTEXT.md'),
      'utf-8',
    );
    expect(content).toContain('clx_ref_test');
    // Should replace "*(none yet)*" with actual IDs
    expect(content).not.toContain('*(none yet)*');
  });

  it('returns budget_exceeded when append would exceed token budget', async () => {
    // Create a CONTEXT.md that's nearly at budget
    const bigContent = SAMPLE_CONTEXT_MD.replace(
      '### CAP Theorem\n- Consistency, Availability, Partition-tolerance.',
      `### CAP Theorem\n${'- Long concept entry with padding text. '.repeat(800)}`,
    );
    await writeFile(join(testDir, 'contexts', 'system-design', 'CONTEXT.md'), bigContent, 'utf-8');

    const result = await appendInsightToSection({
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'This should not fit because the file is too large already.',
      debateId: 'clx_budget_test',
      contextDir: join(testDir, 'contexts'),
    });

    expect(result.status).toBe('budget_exceeded');
  });

  it('appends to an empty section (replaces placeholder text)', async () => {
    const result = await appendInsightToSection({
      domain: 'system-design',
      section: 'misconceptions',
      insight: '"Microservices are always better than monoliths" — context-dependent.',
      debateId: 'clx_empty_section',
      contextDir: join(testDir, 'contexts'),
    });

    expect(result.status).toBe('updated');
    const content = await readFile(
      join(testDir, 'contexts', 'system-design', 'CONTEXT.md'),
      'utf-8',
    );
    // Placeholder should be replaced
    expect(content).not.toContain('*(This section grows as debate critiques');
    expect(content).toContain('Microservices are always better than monoliths');
  });

  it('handles multiple appends to same section', async () => {
    await appendInsightToSection({
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'First insight about consensus.',
      debateId: 'clx_multi_1',
      contextDir: join(testDir, 'contexts'),
    });

    await appendInsightToSection({
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'Second insight about sharding.',
      debateId: 'clx_multi_2',
      contextDir: join(testDir, 'contexts'),
    });

    const content = await readFile(
      join(testDir, 'contexts', 'system-design', 'CONTEXT.md'),
      'utf-8',
    );
    expect(content).toContain('First insight about consensus');
    expect(content).toContain('Second insight about sharding');
    expect(content).toContain('clx_multi_1');
    expect(content).toContain('clx_multi_2');
  });

  it('returns file_not_found when CONTEXT.md does not exist', async () => {
    const result = await appendInsightToSection({
      domain: 'nonexistent-domain',
      section: 'coreConcepts',
      insight: 'Some insight.',
      debateId: 'clx_missing',
      contextDir: join(testDir, 'contexts'),
    });

    expect(result.status).toBe('file_not_found');
  });

  it('formats insight as a bullet point with debate source', async () => {
    await appendInsightToSection({
      domain: 'system-design',
      section: 'coreConcepts',
      insight: 'Load balancer algorithms comparison.',
      debateId: 'clx_format_test',
      contextDir: join(testDir, 'contexts'),
    });

    const content = await readFile(
      join(testDir, 'contexts', 'system-design', 'CONTEXT.md'),
      'utf-8',
    );
    // Should be formatted as a bullet with source attribution
    expect(content).toMatch(/- Load balancer algorithms comparison\. \(source: clx_format_test\)/);
  });

  it('rejects path traversal in domain name', async () => {
    await expect(
      appendInsightToSection({
        domain: '../../etc',
        section: 'coreConcepts',
        insight: 'Malicious insight.',
        debateId: 'clx_traversal',
        contextDir: join(testDir, 'contexts'),
      }),
    ).rejects.toThrow('Context path escapes allowed directory');
  });
});

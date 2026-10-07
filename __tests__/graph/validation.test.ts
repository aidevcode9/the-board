import { checkConvergence } from '@/lib/graph/edges';
import { parseValidation } from '@/lib/graph/nodes/validate';
import { createInitialState } from '@/lib/graph/state';
import { assignRoles } from '@/lib/personas/roles';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/lib/providers/factory', () => ({ createLLMClient: vi.fn() }));
vi.mock('@/lib/providers/traced', () => ({ withTracing: vi.fn() }));

describe('strict validation parsing', () => {
  it.each([true, false])('accepts boolean %s with valid confidence', (agrees) => {
    expect(parseValidation(JSON.stringify({ agrees, confidence: 0.8 }))).toMatchObject({
      agrees,
      confidence: 0.8,
    });
  });
  it('accepts fenced JSON', () => {
    expect(parseValidation('```json\n{"agrees":true,"confidence":1}\n```')?.agrees).toBe(true);
  });
  it.each([
    'I do not agree.',
    'I cannot agree.',
    'I disagree.',
    '{broken',
    '{"agrees":"true","confidence":0.8}',
    '{"confidence":0.8}',
    '{"agrees":true}',
    '{"agrees":true,"confidence":-1}',
    '{"agrees":true,"confidence":2}',
    '{"agrees":true,"confidence":"0.8"}',
    '{"agrees":true,"confidence":1e999}',
  ])('rejects %s', (content) => {
    expect(parseValidation(content)).toBeNull();
  });
});
describe('current synthesis convergence', () => {
  const base = () => ({
    ...createInitialState({
      query: 'x',
      mode: 'debate',
      domain: 'security',
      workspaceId: 'w',
      debateId: 'd',
      userId: 'u',
    }),
    roleConfig: assignRoles('security'),
  });
  it.each(['missing', 'failed', 'invalid', 'stale'])(
    'rejects a %s second validation at cap',
    (kind) => {
      const state = base();
      state.round = 2;
      state.validations = { builder: { agrees: true, confidence: 1, status: 'valid', round: 2 } };
      if (kind !== 'missing')
        state.validations.synthesizer = {
          agrees: true,
          confidence: 1,
          status: kind === 'stale' ? 'valid' : (kind as 'failed' | 'invalid'),
          round: kind === 'stale' ? 1 : 2,
        };
      expect(checkConvergence(state)).toEqual({ convergence: false, hitlRequired: true });
    },
  );
});

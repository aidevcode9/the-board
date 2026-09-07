import { parseValidationResponse } from '@/lib/graph/validation-parser';
import { describe, expect, it } from 'vitest';

describe('validation parser golden cases', () => {
  it.each([
    {
      name: 'negated agreement',
      content: 'I cannot agree because the answer has no rollback plan.',
    },
    {
      name: 'contradictory prose',
      content: 'I agree with the direction, but I disagree with the proposed deployment sequence.',
    },
    {
      name: 'missing confidence',
      content: '{"agrees": true}',
    },
  ])('does not report consensus for $name', ({ content }) => {
    expect(parseValidationResponse(content).agrees).toBe(false);
  });

  it('permits consensus only for the expected structured response', () => {
    expect(parseValidationResponse('{"agrees": true, "confidence": 0.9}').agrees).toBe(true);
  });
});

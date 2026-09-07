import { parseValidationResponse } from '@/lib/graph/validation-parser';
import { describe, expect, it } from 'vitest';

describe('parseValidationResponse', () => {
  it('accepts a complete agreement response', () => {
    expect(parseValidationResponse('{"agrees": true, "confidence": 0.85}')).toEqual({
      agrees: true,
      confidence: 0.85,
    });
  });

  it('accepts a disagreement response with a reason', () => {
    expect(
      parseValidationResponse(
        '{"agrees": false, "disagreementReason": "The deployment rollback is missing.", "confidence": 0.4}',
      ),
    ).toEqual({
      agrees: false,
      disagreementReason: 'The deployment rollback is missing.',
      confidence: 0.4,
    });
  });

  it.each([
    'I cannot agree with the synthesis because it omits a rollback plan.',
    '{"agrees": true}',
    '{"confidence": 0.8}',
    '{"agrees": "true", "confidence": 0.8}',
    '{"agrees": true, "disagreementReason": "I disagree", "confidence": 0.8}',
    '{"agrees": true, "confidence": 1.2}',
    '{"agrees": true',
    'The validator said {"agrees": true, "confidence": 0.9}.',
  ])('fails closed for invalid validation output: %s', (content) => {
    expect(parseValidationResponse(content)).toEqual({
      agrees: false,
      disagreementReason: content,
      confidence: 0.5,
    });
  });
});

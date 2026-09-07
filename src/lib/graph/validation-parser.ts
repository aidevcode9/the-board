import { z } from 'zod';

import type { Validation } from './state';

const ValidationResponseSchema = z
  .object({
    agrees: z.boolean(),
    disagreementReason: z.string().trim().min(1).optional(),
    confidence: z.number().finite().min(0).max(1),
  })
  .strict()
  .superRefine((response, context) => {
    if (response.agrees && response.disagreementReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Agreement responses cannot include a disagreement reason.',
        path: ['disagreementReason'],
      });
    }
  });

function failClosed(content: string): Validation {
  return {
    agrees: false,
    disagreementReason: content.slice(0, 500),
    confidence: 0.5,
  };
}

/**
 * Parses only the JSON contract requested by the validation prompt.
 * Any malformed, ambiguous, or contradictory response is disagreement.
 */
export function parseValidationResponse(content: string): Validation {
  try {
    const parsed = JSON.parse(content.trim());
    const validation = ValidationResponseSchema.safeParse(parsed);

    if (validation.success) {
      return {
        agrees: validation.data.agrees,
        disagreementReason: validation.data.disagreementReason,
        confidence: validation.data.confidence,
      };
    }
  } catch {
    // Invalid JSON must not be interpreted as consensus.
  }

  return failClosed(content);
}

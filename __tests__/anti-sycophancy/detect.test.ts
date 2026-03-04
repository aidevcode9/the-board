import { detectConfidenceCollapse, detectDiminishingReturns } from '@/lib/anti-sycophancy/detect';
import { describe, expect, it } from 'vitest';

describe('anti-sycophancy/detect', () => {
  describe('detectConfidenceCollapse', () => {
    it('returns a flag when confidence drops > 0.3', () => {
      const flag = detectConfidenceCollapse('analyst', 0.9, 0.5, 1);
      expect(flag).not.toBeNull();
      expect(flag?.type).toBe('confidence_collapse');
      expect(flag?.model).toBe('analyst');
      expect(flag?.round).toBe(1);
    });

    it('returns null when confidence drop is <= 0.3', () => {
      const flag = detectConfidenceCollapse('builder', 0.8, 0.6, 1);
      expect(flag).toBeNull();
    });

    it('returns null when confidence increases', () => {
      const flag = detectConfidenceCollapse('synthesizer', 0.5, 0.8, 2);
      expect(flag).toBeNull();
    });

    it('returns null when confidence stays the same', () => {
      const flag = detectConfidenceCollapse('analyst', 0.7, 0.7, 1);
      expect(flag).toBeNull();
    });

    it('detects exactly at 0.3 threshold (not a collapse)', () => {
      const flag = detectConfidenceCollapse('analyst', 0.9, 0.6, 1);
      expect(flag).toBeNull();
    });

    it('detects just above 0.3 threshold', () => {
      const flag = detectConfidenceCollapse('analyst', 0.9, 0.59, 1);
      expect(flag).not.toBeNull();
    });
  });

  describe('detectDiminishingReturns', () => {
    it('returns true when texts are > 85% similar', () => {
      const text1 = 'The main concern is the lack of error handling in the authentication flow.';
      const text2 = 'The main concern is the lack of error handling in the authentication flow.';
      expect(detectDiminishingReturns(text1, text2)).toBe(true);
    });

    it('returns false when texts are substantially different', () => {
      const text1 = 'Rate limiting should use token bucket algorithm for API gateway.';
      const text2 = 'Consider using eventual consistency with CRDTs for distributed state.';
      expect(detectDiminishingReturns(text1, text2)).toBe(false);
    });

    it('returns true for identical texts', () => {
      const text = 'Exactly the same critique.';
      expect(detectDiminishingReturns(text, text)).toBe(true);
    });

    it('returns false for empty texts', () => {
      expect(detectDiminishingReturns('', '')).toBe(false);
    });

    it('handles minor variations (still similar)', () => {
      const text1 =
        'The solution needs better error handling and input validation across all API endpoints.';
      const text2 =
        'The solution needs better error handling and input validation across all API routes.';
      // Very similar — only 1 word changed — should be above threshold
      expect(detectDiminishingReturns(text1, text2)).toBe(true);
    });
  });
});

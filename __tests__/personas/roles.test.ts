import {
  DOMAIN_ROLE_MAP,
  LEAD_WEIGHT,
  assignRoles,
  getPersonaDefinition,
} from '@/lib/personas/roles';
import { describe, expect, it } from 'vitest';

describe('personas/roles', () => {
  describe('LEAD_WEIGHT', () => {
    it('is 0.6 (60% weight for domain lead)', () => {
      expect(LEAD_WEIGHT).toBe(0.6);
    });
  });

  describe('DOMAIN_ROLE_MAP', () => {
    it('assigns builder as lead for code-generation', () => {
      expect(DOMAIN_ROLE_MAP['code-generation']?.lead).toBe('builder');
    });

    it('assigns analyst as lead for ai-ethics', () => {
      expect(DOMAIN_ROLE_MAP['ai-ethics']?.lead).toBe('analyst');
    });

    it('assigns synthesizer as lead for system-design', () => {
      expect(DOMAIN_ROLE_MAP['system-design']?.lead).toBe('synthesizer');
    });

    it('assigns analyst as lead for security', () => {
      expect(DOMAIN_ROLE_MAP.security?.lead).toBe('analyst');
    });
  });

  describe('assignRoles', () => {
    it('returns correct roles for code-generation domain', () => {
      const config = assignRoles('code-generation');
      expect(config.lead).toBe('builder');
      expect(config.challenger).toBe('analyst');
      expect(config.synthesizer).toBe('synthesizer');
      expect(config.weights.builder).toBe(0.6);
      expect(config.weights.analyst).toBe(0.2);
      expect(config.weights.synthesizer).toBe(0.2);
    });

    it('returns correct roles for ai-ethics domain', () => {
      const config = assignRoles('ai-ethics');
      expect(config.lead).toBe('analyst');
      expect(config.weights.analyst).toBe(0.6);
    });

    it('returns correct roles for system-design domain', () => {
      const config = assignRoles('system-design');
      expect(config.lead).toBe('synthesizer');
      expect(config.weights.synthesizer).toBe(0.6);
    });

    it('falls back to analyst lead for unknown domains', () => {
      const config = assignRoles('unknown-domain');
      expect(config.lead).toBe('analyst');
      expect(config.weights.analyst).toBe(0.6);
    });

    it('weights sum to 1.0', () => {
      for (const domain of [
        'code-generation',
        'ai-ethics',
        'system-design',
        'security',
        'unknown',
      ]) {
        const config = assignRoles(domain);
        const sum = config.weights.analyst + config.weights.builder + config.weights.synthesizer;
        expect(sum).toBeCloseTo(1.0);
      }
    });
  });

  describe('getPersonaDefinition', () => {
    it('returns analyst persona definition', () => {
      const def = getPersonaDefinition('analyst');
      expect(def.slot).toBe('analyst');
      expect(def.displayName).toBe('The Analyst');
    });

    it('returns builder persona definition', () => {
      const def = getPersonaDefinition('builder');
      expect(def.slot).toBe('builder');
      expect(def.displayName).toBe('The Builder');
    });

    it('returns synthesizer persona definition', () => {
      const def = getPersonaDefinition('synthesizer');
      expect(def.slot).toBe('synthesizer');
      expect(def.displayName).toBe('The Synthesizer');
    });
  });
});

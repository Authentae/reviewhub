import { describe, it, expect } from 'vitest';
import {
  isValidStateCode,
  listStateCodes,
  stateMarginalRate,
  stateSupplementalRate,
} from '@tax/state-rates';
import { TaxCalcError } from '@tax/types';

describe('isValidStateCode', () => {
  it('returns true for known states', () => {
    expect(isValidStateCode('CA')).toBe(true);
    expect(isValidStateCode('TX')).toBe(true);
    expect(isValidStateCode('NY')).toBe(true);
  });
  it('returns false for unknown codes', () => {
    expect(isValidStateCode('ZZ')).toBe(false);
    expect(isValidStateCode('')).toBe(false);
  });
});

describe('listStateCodes', () => {
  it('returns all 50 states + DC + XX placeholder, sorted', () => {
    const codes = listStateCodes();
    expect(codes).toContain('CA');
    expect(codes).toContain('NY');
    expect(codes).toContain('TX');
    expect(codes).toContain('DC');
    expect(codes).toContain('XX');
    expect(codes).toEqual([...codes].sort());
  });
});

describe('stateMarginalRate', () => {
  it('returns 0 for no-tax states', () => {
    for (const s of ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY']) {
      expect(stateMarginalRate(s, 200_000, 'single', 2025)).toBe(0);
    }
  });
  it('returns 12.3% for CA at non-millionaire income', () => {
    expect(stateMarginalRate('CA', 500_000, 'single', 2025)).toBeCloseTo(0.123, 4);
  });
  it('returns 13.3% for CA above $1M (mental-health surcharge)', () => {
    expect(stateMarginalRate('CA', 1_500_000, 'single', 2025)).toBeCloseTo(0.133, 4);
  });
  it('returns 10.9% for NY top bracket', () => {
    expect(stateMarginalRate('NY', 500_000, 'single', 2025)).toBeCloseTo(0.109, 4);
  });
  it('honors override rate', () => {
    expect(stateMarginalRate('CA', 500_000, 'single', 2025, 5)).toBeCloseTo(0.05, 4);
  });
  it('throws for unknown state code', () => {
    expect(() => stateMarginalRate('ZZ', 100_000, 'single', 2025)).toThrow(TaxCalcError);
  });
  it('throws for negative override', () => {
    expect(() => stateMarginalRate('CA', 100_000, 'single', 2025, -5)).toThrow(TaxCalcError);
  });
  it('throws for override over 100%', () => {
    expect(() => stateMarginalRate('CA', 100_000, 'single', 2025, 150)).toThrow(TaxCalcError);
  });
  it('throws for non-finite override', () => {
    expect(() => stateMarginalRate('CA', 100_000, 'single', 2025, NaN)).toThrow(TaxCalcError);
  });
  it('XX placeholder returns 0 (no state tax assumption)', () => {
    expect(stateMarginalRate('XX', 100_000, 'single', 2025)).toBe(0);
  });
});

describe('stateSupplementalRate', () => {
  it('returns CA 10.23% supplemental rate', () => {
    expect(stateSupplementalRate('CA')).toBeCloseTo(0.1023, 4);
  });
  it('returns NY 10.23% supplemental rate', () => {
    expect(stateSupplementalRate('NY')).toBeCloseTo(0.1023, 4);
  });
  it('falls back to top marginal for unlisted states', () => {
    expect(stateSupplementalRate('OR')).toBeCloseTo(0.099, 4);
  });
  it('returns 0 for no-tax states', () => {
    expect(stateSupplementalRate('TX')).toBe(0);
    expect(stateSupplementalRate('WA')).toBe(0);
  });
  it('throws for unknown state', () => {
    expect(() => stateSupplementalRate('ZZ')).toThrow(TaxCalcError);
  });
});

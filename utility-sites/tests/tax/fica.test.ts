import { describe, it, expect } from 'vitest';
import { ficaOnVest, ssWageBase, additionalMedicareThreshold, FICA_RATES } from '@tax/fica';
import { TaxCalcError } from '@tax/types';

describe('ssWageBase', () => {
  it('returns 2025 SS wage base', () => {
    expect(ssWageBase(2025)).toBe(176_100);
  });
  it('returns 2026 projected SS wage base', () => {
    expect(ssWageBase(2026)).toBe(183_600);
  });
});

describe('additionalMedicareThreshold', () => {
  it('returns $200k for single', () => {
    expect(additionalMedicareThreshold('single')).toBe(200_000);
  });
  it('returns $250k for MFJ', () => {
    expect(additionalMedicareThreshold('mfj')).toBe(250_000);
  });
  it('returns $125k for MFS', () => {
    expect(additionalMedicareThreshold('mfs')).toBe(125_000);
  });
  it('returns $200k for HOH', () => {
    expect(additionalMedicareThreshold('hoh')).toBe(200_000);
  });
});

describe('ficaOnVest', () => {
  it('full SS + Medicare when YTD wages are well below the wage base', () => {
    const r = ficaOnVest(50_000, 50_000, 2025, 'single', false);
    expect(r.ssUsd).toBeCloseTo(50_000 * FICA_RATES.ss, 2);
    expect(r.medicareUsd).toBeCloseTo(50_000 * FICA_RATES.medicare, 2);
    expect(r.additionalMedicareUsd).toBe(0);
  });
  it('partial SS when vest crosses the wage base', () => {
    // YTD 150k, wage base 176.1k → only 26.1k of vest gets SS withholding
    const r = ficaOnVest(50_000, 150_000, 2025, 'single', false);
    expect(r.ssUsd).toBeCloseTo(26_100 * FICA_RATES.ss, 2);
    expect(r.medicareUsd).toBeCloseTo(50_000 * FICA_RATES.medicare, 2);
  });
  it('zero SS when YTD wages already past the wage base', () => {
    const r = ficaOnVest(50_000, 200_000, 2025, 'single', false);
    expect(r.ssUsd).toBe(0);
  });
  it('zero SS when alreadyMaxedSs is true regardless of YTD', () => {
    const r = ficaOnVest(50_000, 0, 2025, 'single', true);
    expect(r.ssUsd).toBe(0);
  });
  it('Additional Medicare 0.9% when total comp pushes over single $200k', () => {
    // YTD 180k + vest 50k = 230k → 30k subject to Add Medicare
    const r = ficaOnVest(50_000, 180_000, 2025, 'single', false);
    expect(r.additionalMedicareUsd).toBeCloseTo(30_000 * FICA_RATES.additionalMedicare, 2);
  });
  it('Additional Medicare on full vest when YTD already over threshold', () => {
    const r = ficaOnVest(50_000, 250_000, 2025, 'single', false);
    expect(r.additionalMedicareUsd).toBeCloseTo(50_000 * FICA_RATES.additionalMedicare, 2);
  });
  it('no Additional Medicare when comp stays under threshold (MFJ $250k)', () => {
    const r = ficaOnVest(50_000, 150_000, 2025, 'mfj', false);
    expect(r.additionalMedicareUsd).toBe(0);
  });
  it('throws on negative vest', () => {
    expect(() => ficaOnVest(-1, 0, 2025, 'single', false)).toThrow(TaxCalcError);
  });
  it('throws on NaN vest', () => {
    expect(() => ficaOnVest(NaN, 0, 2025, 'single', false)).toThrow(TaxCalcError);
  });
  it('throws on negative YTD wages', () => {
    expect(() => ficaOnVest(100, -1, 2025, 'single', false)).toThrow(TaxCalcError);
  });
  it('throws on Infinity', () => {
    expect(() => ficaOnVest(100, Infinity, 2025, 'single', false)).toThrow(TaxCalcError);
  });
});

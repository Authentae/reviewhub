import { describe, it, expect } from 'vitest';
import {
  federalIncomeTax,
  federalMarginalRate,
  federalSupplementalWithholdingRate,
  standardDeduction,
  SUPPLEMENTAL_RATES,
} from '@tax/federal-brackets';
import { TaxCalcError } from '@tax/types';

describe('standardDeduction', () => {
  it('returns 2025 single value', () => {
    expect(standardDeduction(2025, 'single')).toBe(15_000);
  });
  it('returns 2025 mfj value', () => {
    expect(standardDeduction(2025, 'mfj')).toBe(30_000);
  });
  it('returns 2026 hoh value', () => {
    expect(standardDeduction(2026, 'hoh')).toBe(23_130);
  });
});

describe('federalMarginalRate', () => {
  it('returns 10% at zero taxable income (single 2025)', () => {
    expect(federalMarginalRate(0, 'single', 2025)).toBeCloseTo(0.1);
  });
  it('returns 22% at $50k single 2025', () => {
    expect(federalMarginalRate(50_000, 'single', 2025)).toBeCloseTo(0.22);
  });
  it('returns 24% just above $103,350 single 2025', () => {
    expect(federalMarginalRate(103_351, 'single', 2025)).toBeCloseTo(0.24);
  });
  it('returns 35% at $300k single 2025', () => {
    expect(federalMarginalRate(300_000, 'single', 2025)).toBeCloseTo(0.35);
  });
  it('returns 37% at $700k single 2025', () => {
    expect(federalMarginalRate(700_000, 'single', 2025)).toBeCloseTo(0.37);
  });
  it('returns 32% at $400k mfj 2025', () => {
    expect(federalMarginalRate(400_000, 'mfj', 2025)).toBeCloseTo(0.32);
  });
  it('uses 2026 brackets when requested', () => {
    expect(federalMarginalRate(11_950, 'single', 2026)).toBeCloseTo(0.1); // below 2026 12% threshold (12,259)
    expect(federalMarginalRate(12_300, 'single', 2026)).toBeCloseTo(0.12);
  });
  it('throws on negative income', () => {
    expect(() => federalMarginalRate(-1, 'single', 2025)).toThrow(TaxCalcError);
  });
  it('throws on NaN', () => {
    expect(() => federalMarginalRate(NaN, 'single', 2025)).toThrow(TaxCalcError);
  });
  it('throws on Infinity', () => {
    expect(() => federalMarginalRate(Infinity, 'single', 2025)).toThrow(TaxCalcError);
  });
});

describe('federalIncomeTax', () => {
  it('returns 0 on zero income', () => {
    expect(federalIncomeTax(0, 'single', 2025)).toBe(0);
  });
  it('returns 10% × income inside the first bracket', () => {
    expect(federalIncomeTax(10_000, 'single', 2025)).toBeCloseTo(1000, 2);
  });
  it('crosses two brackets correctly (single, $20k, 2025)', () => {
    // $11,925 @ 10% = $1,192.50; remaining $8,075 @ 12% = $969.00; total $2,161.50
    expect(federalIncomeTax(20_000, 'single', 2025)).toBeCloseTo(2_161.5, 1);
  });
  it('crosses several brackets (single $200k 2025)', () => {
    // 11925@10 + (48475-11925)@12 + (103350-48475)@22 + (197300-103350)@24 + (200000-197300)@32
    // = 1192.5 + 4386 + 12072.5 + 22548 + 864 = 41063.0
    expect(federalIncomeTax(200_000, 'single', 2025)).toBeCloseTo(41_063, 0);
  });
  it('handles MFJ brackets correctly at $300k', () => {
    // 23850@10 + (96950-23850)@12 + (206700-96950)@22 + (300000-206700)@24
    // = 2385 + 8772 + 24145 + 22392 = 57694
    expect(federalIncomeTax(300_000, 'mfj', 2025)).toBeCloseTo(57_694, 0);
  });
  it('handles top-bracket income (single $1M 2025)', () => {
    expect(federalIncomeTax(1_000_000, 'single', 2025)).toBeGreaterThan(300_000);
    expect(federalIncomeTax(1_000_000, 'single', 2025)).toBeLessThan(360_000);
  });
  it('throws on negative income', () => {
    expect(() => federalIncomeTax(-100, 'single', 2025)).toThrow(TaxCalcError);
  });
  it('throws on NaN', () => {
    expect(() => federalIncomeTax(NaN, 'single', 2025)).toThrow(TaxCalcError);
  });
  it('handles all four filing statuses without throwing', () => {
    for (const fs of ['single', 'mfj', 'mfs', 'hoh'] as const) {
      expect(federalIncomeTax(150_000, fs, 2025)).toBeGreaterThan(0);
      expect(federalIncomeTax(150_000, fs, 2026)).toBeGreaterThan(0);
    }
  });
});

describe('federalSupplementalWithholdingRate', () => {
  it('returns 22% under the $1M threshold', () => {
    expect(federalSupplementalWithholdingRate(0, 100_000, 2025)).toBeCloseTo(0.22);
  });
  it('returns 22% if YTD + payment lands exactly at $1M', () => {
    expect(federalSupplementalWithholdingRate(900_000, 100_000, 2025)).toBeCloseTo(0.22);
  });
  it('returns 37% when YTD already over $1M', () => {
    expect(federalSupplementalWithholdingRate(1_500_000, 50_000, 2025)).toBeCloseTo(0.37);
  });
  it('blends 22% and 37% when payment crosses the threshold', () => {
    // YTD 800k, payment 400k; first 200k @ 22%, next 200k @ 37% → blended 29.5%
    const rate = federalSupplementalWithholdingRate(800_000, 400_000, 2025);
    expect(rate).toBeCloseTo(0.295, 4);
  });
  it('returns the low rate for a zero-dollar payment (degenerate)', () => {
    expect(federalSupplementalWithholdingRate(500_000, 0, 2025)).toBe(SUPPLEMENTAL_RATES.low);
  });
  it('throws on negative YTD', () => {
    expect(() => federalSupplementalWithholdingRate(-1, 100, 2025)).toThrow(TaxCalcError);
  });
  it('throws on negative payment', () => {
    expect(() => federalSupplementalWithholdingRate(0, -1, 2025)).toThrow(TaxCalcError);
  });
  it('throws on NaN payment', () => {
    expect(() => federalSupplementalWithholdingRate(0, NaN, 2025)).toThrow(TaxCalcError);
  });
});

describe('SUPPLEMENTAL_RATES', () => {
  it('exposes low/high/threshold constants', () => {
    expect(SUPPLEMENTAL_RATES.low).toBe(0.22);
    expect(SUPPLEMENTAL_RATES.high).toBe(0.37);
    expect(SUPPLEMENTAL_RATES.threshold).toBe(1_000_000);
  });
});

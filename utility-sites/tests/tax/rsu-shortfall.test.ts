import { describe, it, expect } from 'vitest';
import { calculateRsuShortfall, SAFE_HARBOR } from '@tax/rsu-shortfall';
import { TaxCalcError, type RsuShortfallInput } from '@tax/types';

const baseInput: RsuShortfallInput = {
  taxYear: 2025,
  filingStatus: 'single',
  vestGrossUsd: 50_000,
  ytdSupplementalWagesUsd: 0,
  ytdRegularWagesUsd: 200_000,
  otherTaxableIncomeUsd: 0,
  preTaxDeductionsUsd: 23_500, // 2025 401k limit, conservative
  stateCode: 'CA',
};

describe('calculateRsuShortfall — happy path', () => {
  it('returns sensible shortfall for a CA tech worker, $200k base + $50k vest', () => {
    const r = calculateRsuShortfall(baseInput);
    // Withheld federal = 22% × 50k = 11,000
    expect(r.withheldFederalUsd).toBeCloseTo(11_000, 2);
    expect(r.appliedFederalSupplementalRate).toBeCloseTo(0.22, 4);
    // CA supplemental 10.23% × 50k = 5,115
    expect(r.withheldStateUsd).toBeCloseTo(5_115, 2);
    // Marginal federal at ~226k single is 32%; expected fed = 16k
    expect(r.marginalFederalRatePct).toBeCloseTo(32, 1);
    expect(r.expectedFederalUsd).toBeCloseTo(16_000, 2);
    // Marginal CA at this income is 12.3% (under $1M threshold) → expected state 6,150
    expect(r.marginalStateRatePct).toBeCloseTo(12.3, 1);
    expect(r.expectedStateUsd).toBeCloseTo(6_150, 2);
    // Shortfall positive = under-withheld
    expect(r.shortfallUsd).toBeGreaterThan(0);
    expect(r.isUnderpaymentRisk).toBe(true);
    expect(r.suggestedQuarterlyEstimateUsd).toBeCloseTo(r.shortfallUsd, 2);
  });

  it('shortfall = expected total - withheld total', () => {
    const r = calculateRsuShortfall(baseInput);
    const expectedTotal = r.expectedFederalUsd + r.expectedStateUsd + r.expectedFicaUsd;
    const withheldTotal = r.withheldFederalUsd + r.withheldStateUsd + r.withheldFicaUsd;
    expect(r.shortfallUsd).toBeCloseTo(expectedTotal - withheldTotal, 2);
  });

  it('FICA matches between withheld and expected (FICA is flat)', () => {
    const r = calculateRsuShortfall(baseInput);
    expect(r.withheldFicaUsd).toBe(r.expectedFicaUsd);
  });
});

describe('calculateRsuShortfall — edge cases', () => {
  it('blends 22%+37% federal withholding when YTD crosses $1M', () => {
    const r = calculateRsuShortfall({
      ...baseInput,
      ytdSupplementalWagesUsd: 800_000,
      vestGrossUsd: 400_000,
    });
    // 200k @ 22% + 200k @ 37% = 118,000 → blended 29.5%
    expect(r.appliedFederalSupplementalRate).toBeCloseTo(0.295, 4);
    expect(r.withheldFederalUsd).toBeCloseTo(118_000, 2);
  });

  it('zero state withholding for no-tax state (TX)', () => {
    const r = calculateRsuShortfall({ ...baseInput, stateCode: 'TX' });
    expect(r.withheldStateUsd).toBe(0);
    expect(r.expectedStateUsd).toBe(0);
    expect(r.marginalStateRatePct).toBe(0);
  });

  it('CA mental-health surcharge kicks in over $1M income', () => {
    const r = calculateRsuShortfall({
      ...baseInput,
      ytdRegularWagesUsd: 1_000_000,
      vestGrossUsd: 200_000,
    });
    expect(r.marginalStateRatePct).toBeCloseTo(13.3, 1);
  });

  it('respects state override rate', () => {
    const r = calculateRsuShortfall({ ...baseInput, stateOverrideRatePct: 5 });
    expect(r.marginalStateRatePct).toBeCloseTo(5, 4);
    expect(r.withheldStateUsd).toBeCloseTo(50_000 * 0.05, 2);
  });

  it('returns negative shortfall (overwithheld) for low marginal rate user', () => {
    // Single filer with low income and a small vest: marginal rate may be < 22%
    const r = calculateRsuShortfall({
      taxYear: 2025,
      filingStatus: 'single',
      vestGrossUsd: 5_000,
      ytdSupplementalWagesUsd: 0,
      ytdRegularWagesUsd: 35_000,
      otherTaxableIncomeUsd: 0,
      preTaxDeductionsUsd: 0,
      stateCode: 'TX',
    });
    expect(r.shortfallUsd).toBeLessThan(0);
    expect(r.isUnderpaymentRisk).toBe(false);
    expect(r.suggestedQuarterlyEstimateUsd).toBe(0);
    expect(r.suggestedExtraW4PerPaycheckUsd).toBe(0);
  });

  it('paychecks remaining is between 1 and 26 inclusive', () => {
    const r = calculateRsuShortfall(baseInput);
    expect(r.paychecksRemainingThisYear).toBeGreaterThanOrEqual(1);
    expect(r.paychecksRemainingThisYear).toBeLessThanOrEqual(26);
  });

  it('handles ficaAlreadyMaxed flag (zero SS portion)', () => {
    const r = calculateRsuShortfall({ ...baseInput, ytdRegularWagesUsd: 0, ficaAlreadyMaxed: true });
    // No SS portion, but Medicare still applies
    expect(r.withheldFicaUsd).toBeGreaterThan(0);
    // Without flag, SS would be 50000 * 0.062 = 3100, with flag it should be much smaller
    const without = calculateRsuShortfall({ ...baseInput, ytdRegularWagesUsd: 0 });
    expect(r.withheldFicaUsd).toBeLessThan(without.withheldFicaUsd);
  });

  it('effective federal rate is below marginal at high income', () => {
    const r = calculateRsuShortfall({
      ...baseInput,
      ytdRegularWagesUsd: 500_000,
      vestGrossUsd: 100_000,
    });
    expect(r.effectiveFederalRatePct).toBeLessThan(r.marginalFederalRatePct);
  });
});

describe('calculateRsuShortfall — validation', () => {
  it('throws on zero vest', () => {
    expect(() => calculateRsuShortfall({ ...baseInput, vestGrossUsd: 0 })).toThrow(TaxCalcError);
  });
  it('throws on negative vest', () => {
    expect(() => calculateRsuShortfall({ ...baseInput, vestGrossUsd: -1 })).toThrow(TaxCalcError);
  });
  it('throws on NaN vest', () => {
    expect(() => calculateRsuShortfall({ ...baseInput, vestGrossUsd: NaN })).toThrow(TaxCalcError);
  });
  it('throws on negative YTD regular wages', () => {
    expect(() => calculateRsuShortfall({ ...baseInput, ytdRegularWagesUsd: -1 })).toThrow(TaxCalcError);
  });
  it('throws on negative YTD supplemental wages', () => {
    expect(() => calculateRsuShortfall({ ...baseInput, ytdSupplementalWagesUsd: -1 })).toThrow(
      TaxCalcError,
    );
  });
  it('throws on negative pre-tax deductions', () => {
    expect(() => calculateRsuShortfall({ ...baseInput, preTaxDeductionsUsd: -1 })).toThrow(
      TaxCalcError,
    );
  });
  it('throws on negative other income', () => {
    expect(() => calculateRsuShortfall({ ...baseInput, otherTaxableIncomeUsd: -1 })).toThrow(
      TaxCalcError,
    );
  });
  it('throws on unknown state', () => {
    expect(() => calculateRsuShortfall({ ...baseInput, stateCode: 'ZZ' })).toThrow(TaxCalcError);
  });
});

describe('SAFE_HARBOR', () => {
  it('exposes the $1k threshold', () => {
    expect(SAFE_HARBOR.thresholdUsd).toBe(1_000);
  });
});

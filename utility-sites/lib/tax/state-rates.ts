import type { FilingStatus, TaxYear } from './types';
import { TaxCalcError } from './types';

/**
 * Approximate top marginal state income tax rate (as a fraction) by state.
 * For a v1 calculator, we model state tax as a single marginal rate at the user's
 * approximate income level. Users can override with `stateOverrideRatePct`.
 *
 * Source: Tax Foundation 2025 state individual income tax brackets summary
 * (https://taxfoundation.org/data/all/state/state-income-tax-rates/), simplified.
 *
 * No-income-tax states return 0:
 *   AK, FL, NV, NH (interest/div only — treated as 0 for wages), SD, TN, TX, WA, WY.
 */
const STATE_TOP_RATE: Record<string, number> = {
  AL: 0.05,
  AK: 0,
  AZ: 0.025,
  AR: 0.039,
  CA: 0.123, // top bracket; +1% mental health surcharge over $1M handled below
  CO: 0.044,
  CT: 0.0699,
  DE: 0.066,
  DC: 0.1075,
  FL: 0,
  GA: 0.0539,
  HI: 0.11,
  ID: 0.058,
  IL: 0.0495,
  IN: 0.0305,
  IA: 0.038,
  KS: 0.057,
  KY: 0.04,
  LA: 0.0425,
  ME: 0.0715,
  MD: 0.0575, // local add-ons not modeled
  MA: 0.09, // includes 4% surtax over $1M
  MI: 0.0425,
  MN: 0.0985,
  MS: 0.044,
  MO: 0.047,
  MT: 0.059,
  NE: 0.052,
  NV: 0,
  NH: 0,
  NJ: 0.1075,
  NM: 0.059,
  NY: 0.109,
  NC: 0.0425,
  ND: 0.025,
  OH: 0.035,
  OK: 0.0475,
  OR: 0.099,
  PA: 0.0307,
  RI: 0.0599,
  SC: 0.062,
  SD: 0,
  TN: 0,
  TX: 0,
  UT: 0.0455,
  VT: 0.0875,
  VA: 0.0575,
  WA: 0,
  WV: 0.048,
  WI: 0.0765,
  WY: 0,
  XX: 0,
};

/**
 * California adds a 1% mental health surcharge on income above $1M.
 * Modeled as an effective bump for high-income CA filers.
 */
const CA_MENTAL_HEALTH_THRESHOLD = 1_000_000;
const CA_MENTAL_HEALTH_RATE = 0.01;

const STATE_SUPPLEMENTAL_RATE: Record<string, number> = {
  CA: 0.1023,
  NY: 0.1023,
  // Many states use a flat supplemental withholding rate. For unlisted states,
  // we approximate supplemental withholding as the top marginal rate.
};

export function isValidStateCode(stateCode: string): boolean {
  return stateCode in STATE_TOP_RATE;
}

export function listStateCodes(): string[] {
  return Object.keys(STATE_TOP_RATE).sort();
}

/**
 * Returns the marginal state income tax rate (fraction) at the given taxable
 * income level. v1 uses top marginal as a simple model; future versions can add
 * full bracket tables per state.
 */
export function stateMarginalRate(
  stateCode: string,
  taxableIncomeUsd: number,
  _filingStatus: FilingStatus,
  _taxYear: TaxYear,
  overrideRatePct?: number,
): number {
  if (typeof overrideRatePct === 'number') {
    if (!Number.isFinite(overrideRatePct) || overrideRatePct < 0 || overrideRatePct > 100) {
      throw new TaxCalcError(`Invalid state override rate: ${overrideRatePct}`);
    }
    return overrideRatePct / 100;
  }
  if (!isValidStateCode(stateCode)) {
    throw new TaxCalcError(`Unknown state code: ${stateCode}`);
  }
  let rate = STATE_TOP_RATE[stateCode]!;
  if (stateCode === 'CA' && taxableIncomeUsd > CA_MENTAL_HEALTH_THRESHOLD) {
    rate += CA_MENTAL_HEALTH_RATE;
  }
  return rate;
}

/**
 * Returns the supplemental withholding rate the employer typically uses for the
 * given state, as a fraction. Falls back to the top marginal rate if no
 * specific supplemental rate is published.
 */
export function stateSupplementalRate(stateCode: string): number {
  if (!isValidStateCode(stateCode)) {
    throw new TaxCalcError(`Unknown state code: ${stateCode}`);
  }
  return STATE_SUPPLEMENTAL_RATE[stateCode] ?? STATE_TOP_RATE[stateCode]!;
}

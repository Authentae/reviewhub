import {
  federalIncomeTax,
  federalMarginalRate,
  federalSupplementalWithholdingRate,
  standardDeduction,
} from './federal-brackets';
import { ficaOnVest } from './fica';
import { stateMarginalRate, stateSupplementalRate } from './state-rates';
import type { RsuShortfallInput, RsuShortfallResult } from './types';
import { TaxCalcError } from './types';

const SAFE_HARBOR_THRESHOLD_USD = 1_000;
const BIWEEKLY_PAYCHECKS_PER_YEAR = 26;

function validate(input: RsuShortfallInput): void {
  const numericFields: Array<[keyof RsuShortfallInput, number]> = [
    ['vestGrossUsd', input.vestGrossUsd],
    ['ytdSupplementalWagesUsd', input.ytdSupplementalWagesUsd],
    ['ytdRegularWagesUsd', input.ytdRegularWagesUsd],
    ['otherTaxableIncomeUsd', input.otherTaxableIncomeUsd],
    ['preTaxDeductionsUsd', input.preTaxDeductionsUsd],
  ];
  for (const [name, value] of numericFields) {
    if (!Number.isFinite(value) || value < 0) {
      throw new TaxCalcError(`Invalid ${String(name)}: ${value}`);
    }
  }
  if (input.vestGrossUsd === 0) {
    throw new TaxCalcError('vestGrossUsd must be greater than 0');
  }
}

function paychecksRemainingThisYear(now: Date = new Date()): number {
  const dayOfYear =
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(now.getUTCFullYear(), 0, 0)) /
    86_400_000;
  const fraction = dayOfYear / 365;
  return Math.max(1, Math.round(BIWEEKLY_PAYCHECKS_PER_YEAR * (1 - fraction)));
}

/**
 * Compute the federal/state/FICA shortfall on a single RSU vest event.
 *
 * Approach:
 *   1. Estimate what the EMPLOYER withheld at vest:
 *        - Federal: 22% (or blended with 37% if YTD supplemental crosses $1M).
 *        - State: state-supplemental rate (e.g. CA 10.23%).
 *        - FICA: SS up to wage base + Medicare 1.45% + Additional Medicare 0.9% over the threshold.
 *   2. Estimate what the EMPLOYEE actually owes on the vest at marginal rate:
 *        - Federal: marginal-bracket rate at projected total taxable income.
 *        - State: marginal state rate at projected total income.
 *        - FICA: same as withheld (FICA is not a marginal-rate game).
 *   3. Shortfall = expected total - withheld total.
 *
 * Notes:
 *   - The "expected federal" line is the marginal rate × vest amount, not a
 *     full bracket-traversal of the vest. Vests are typically small enough
 *     relative to existing income that this approximation is within a few
 *     percent. We expose effective rate separately so users can sanity-check.
 *   - State-tax modeling is single-marginal-rate per state in v1.
 *   - This is an estimate, not tax advice.
 */
export function calculateRsuShortfall(input: RsuShortfallInput): RsuShortfallResult {
  validate(input);

  const {
    taxYear,
    filingStatus,
    vestGrossUsd,
    ytdSupplementalWagesUsd,
    ytdRegularWagesUsd,
    otherTaxableIncomeUsd,
    preTaxDeductionsUsd,
    stateCode,
    stateOverrideRatePct,
    ficaAlreadyMaxed,
  } = input;

  // Withheld federal: blended supplemental rate.
  const appliedFederalSupplementalRate = federalSupplementalWithholdingRate(
    ytdSupplementalWagesUsd,
    vestGrossUsd,
    taxYear,
  );
  const withheldFederalUsd = vestGrossUsd * appliedFederalSupplementalRate;

  // Withheld state: state-specific supplemental rate (or top marginal as fallback).
  const stateWithholdingRate = stateOverrideRatePct
    ? stateOverrideRatePct / 100
    : stateSupplementalRate(stateCode);
  const withheldStateUsd = vestGrossUsd * stateWithholdingRate;

  // FICA breakdown (same for withheld and expected — FICA is flat).
  const fica = ficaOnVest(
    vestGrossUsd,
    ytdRegularWagesUsd,
    taxYear,
    filingStatus,
    Boolean(ficaAlreadyMaxed),
  );
  const withheldFicaUsd = fica.ssUsd + fica.medicareUsd + fica.additionalMedicareUsd;
  const expectedFicaUsd = withheldFicaUsd;

  // Projected federal taxable income for the year (used to find marginal rate at the vest).
  const totalGrossWages =
    ytdRegularWagesUsd + ytdSupplementalWagesUsd + vestGrossUsd + otherTaxableIncomeUsd;
  const taxableIncomeForMarginalUsd = Math.max(
    0,
    totalGrossWages - preTaxDeductionsUsd - standardDeduction(taxYear, filingStatus),
  );

  const marginalFederalRatePct = federalMarginalRate(taxableIncomeForMarginalUsd, filingStatus, taxYear) * 100;
  const expectedFederalUsd = vestGrossUsd * (marginalFederalRatePct / 100);

  const totalFederalTaxOnAllIncome = federalIncomeTax(taxableIncomeForMarginalUsd, filingStatus, taxYear);
  const effectiveFederalRatePct =
    taxableIncomeForMarginalUsd > 0
      ? (totalFederalTaxOnAllIncome / taxableIncomeForMarginalUsd) * 100
      : 0;

  // Expected state at marginal rate.
  const marginalStateRatePct =
    stateMarginalRate(stateCode, taxableIncomeForMarginalUsd, filingStatus, taxYear, stateOverrideRatePct) * 100;
  const expectedStateUsd = vestGrossUsd * (marginalStateRatePct / 100);

  const expectedTotal = expectedFederalUsd + expectedStateUsd + expectedFicaUsd;
  const withheldTotal = withheldFederalUsd + withheldStateUsd + withheldFicaUsd;
  const shortfallUsd = expectedTotal - withheldTotal;

  const isUnderpaymentRisk = shortfallUsd > SAFE_HARBOR_THRESHOLD_USD;
  const suggestedQuarterlyEstimateUsd = isUnderpaymentRisk ? shortfallUsd : 0;

  const paychecksLeft = paychecksRemainingThisYear();
  const suggestedExtraW4PerPaycheckUsd =
    shortfallUsd > 0 && paychecksLeft > 0 ? shortfallUsd / paychecksLeft : 0;

  return {
    vestGrossUsd,
    withheldFederalUsd,
    withheldStateUsd,
    withheldFicaUsd,
    expectedFederalUsd,
    expectedStateUsd,
    expectedFicaUsd,
    shortfallUsd,
    suggestedQuarterlyEstimateUsd,
    suggestedExtraW4PerPaycheckUsd,
    paychecksRemainingThisYear: paychecksLeft,
    isUnderpaymentRisk,
    marginalFederalRatePct,
    effectiveFederalRatePct,
    marginalStateRatePct,
    appliedFederalSupplementalRate,
  };
}

export const SAFE_HARBOR = {
  thresholdUsd: SAFE_HARBOR_THRESHOLD_USD,
} as const;

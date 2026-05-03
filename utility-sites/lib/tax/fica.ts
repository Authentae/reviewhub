import type { FicaBreakdown, FilingStatus, TaxYear } from './types';
import { TaxCalcError } from './types';

const SS_WAGE_BASE: Record<TaxYear, number> = {
  2025: 176_100,
  2026: 183_600, // Projected; SSA announces in October.
};

const SS_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const ADDITIONAL_MEDICARE_RATE = 0.009;

const ADDITIONAL_MEDICARE_THRESHOLD: Record<FilingStatus, number> = {
  single: 200_000,
  mfj: 250_000,
  mfs: 125_000,
  hoh: 200_000,
};

export function ssWageBase(taxYear: TaxYear): number {
  return SS_WAGE_BASE[taxYear];
}

export function additionalMedicareThreshold(filingStatus: FilingStatus): number {
  return ADDITIONAL_MEDICARE_THRESHOLD[filingStatus];
}

/**
 * Compute the FICA portion withheld on a single vest, given YTD regular wages
 * already counted toward the SS wage base. Employer-side FICA is the same
 * amount paid separately and is not reflected here (employee perspective only).
 */
export function ficaOnVest(
  vestUsd: number,
  ytdRegularWagesUsd: number,
  taxYear: TaxYear,
  filingStatus: FilingStatus,
  alreadyMaxedSs: boolean,
): FicaBreakdown {
  if (!Number.isFinite(vestUsd) || vestUsd < 0) {
    throw new TaxCalcError(`Invalid vest amount: ${vestUsd}`);
  }
  if (!Number.isFinite(ytdRegularWagesUsd) || ytdRegularWagesUsd < 0) {
    throw new TaxCalcError(`Invalid YTD wages: ${ytdRegularWagesUsd}`);
  }
  const wageBase = ssWageBase(taxYear);
  let ssTaxableOnVest: number;
  if (alreadyMaxedSs) {
    ssTaxableOnVest = 0;
  } else {
    const remainingBase = Math.max(0, wageBase - ytdRegularWagesUsd);
    ssTaxableOnVest = Math.min(vestUsd, remainingBase);
  }
  const ssUsd = ssTaxableOnVest * SS_RATE;
  const medicareUsd = vestUsd * MEDICARE_RATE;

  const addlThreshold = additionalMedicareThreshold(filingStatus);
  const totalCompYtdAfterVest = ytdRegularWagesUsd + vestUsd;
  let addlTaxableOnVest: number;
  if (totalCompYtdAfterVest <= addlThreshold) {
    addlTaxableOnVest = 0;
  } else if (ytdRegularWagesUsd >= addlThreshold) {
    addlTaxableOnVest = vestUsd;
  } else {
    addlTaxableOnVest = totalCompYtdAfterVest - addlThreshold;
  }
  const additionalMedicareUsd = addlTaxableOnVest * ADDITIONAL_MEDICARE_RATE;

  return { ssUsd, medicareUsd, additionalMedicareUsd };
}

export const FICA_RATES = {
  ss: SS_RATE,
  medicare: MEDICARE_RATE,
  additionalMedicare: ADDITIONAL_MEDICARE_RATE,
} as const;

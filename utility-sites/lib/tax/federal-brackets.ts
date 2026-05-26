import type { FilingStatus, TaxYear } from './types';
import { TaxCalcError } from './types';

interface Bracket {
  /** Lower bound (inclusive) of taxable income, USD. */
  from: number;
  /** Marginal rate as a fraction (e.g. 0.24). */
  rate: number;
}

type BracketTable = Record<FilingStatus, Bracket[]>;

// IRS Rev. Proc. 2024-40 (tax year 2025) and projected 2026 (CPI-adjusted estimates).
// Brackets are ordered ascending by `from`. Each bracket applies to income at or above `from`
// and below the `from` of the next bracket.
const BRACKETS_2025: BracketTable = {
  single: [
    { from: 0, rate: 0.1 },
    { from: 11_925, rate: 0.12 },
    { from: 48_475, rate: 0.22 },
    { from: 103_350, rate: 0.24 },
    { from: 197_300, rate: 0.32 },
    { from: 250_525, rate: 0.35 },
    { from: 626_350, rate: 0.37 },
  ],
  mfj: [
    { from: 0, rate: 0.1 },
    { from: 23_850, rate: 0.12 },
    { from: 96_950, rate: 0.22 },
    { from: 206_700, rate: 0.24 },
    { from: 394_600, rate: 0.32 },
    { from: 501_050, rate: 0.35 },
    { from: 751_600, rate: 0.37 },
  ],
  mfs: [
    { from: 0, rate: 0.1 },
    { from: 11_925, rate: 0.12 },
    { from: 48_475, rate: 0.22 },
    { from: 103_350, rate: 0.24 },
    { from: 197_300, rate: 0.32 },
    { from: 250_525, rate: 0.35 },
    { from: 375_800, rate: 0.37 },
  ],
  hoh: [
    { from: 0, rate: 0.1 },
    { from: 17_000, rate: 0.12 },
    { from: 64_850, rate: 0.22 },
    { from: 103_350, rate: 0.24 },
    { from: 197_300, rate: 0.32 },
    { from: 250_500, rate: 0.35 },
    { from: 626_350, rate: 0.37 },
  ],
};

// Projected 2026 brackets — ~2.8% CPI inflation adjustment from 2025 thresholds.
// These will be replaced with actual IRS Rev. Proc. values when published in late 2025.
const BRACKETS_2026: BracketTable = {
  single: [
    { from: 0, rate: 0.1 },
    { from: 12_259, rate: 0.12 },
    { from: 49_832, rate: 0.22 },
    { from: 106_244, rate: 0.24 },
    { from: 202_824, rate: 0.32 },
    { from: 257_540, rate: 0.35 },
    { from: 643_888, rate: 0.37 },
  ],
  mfj: [
    { from: 0, rate: 0.1 },
    { from: 24_518, rate: 0.12 },
    { from: 99_665, rate: 0.22 },
    { from: 212_488, rate: 0.24 },
    { from: 405_649, rate: 0.32 },
    { from: 515_079, rate: 0.35 },
    { from: 772_645, rate: 0.37 },
  ],
  mfs: [
    { from: 0, rate: 0.1 },
    { from: 12_259, rate: 0.12 },
    { from: 49_832, rate: 0.22 },
    { from: 106_244, rate: 0.24 },
    { from: 202_824, rate: 0.32 },
    { from: 257_540, rate: 0.35 },
    { from: 386_322, rate: 0.37 },
  ],
  hoh: [
    { from: 0, rate: 0.1 },
    { from: 17_476, rate: 0.12 },
    { from: 66_666, rate: 0.22 },
    { from: 106_244, rate: 0.24 },
    { from: 202_824, rate: 0.32 },
    { from: 257_514, rate: 0.35 },
    { from: 643_888, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION_2025: Record<FilingStatus, number> = {
  single: 15_000,
  mfj: 30_000,
  mfs: 15_000,
  hoh: 22_500,
};

const STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
  single: 15_420,
  mfj: 30_840,
  mfs: 15_420,
  hoh: 23_130,
};

const SUPPLEMENTAL_HIGH_RATE_THRESHOLD = 1_000_000;
const SUPPLEMENTAL_LOW_RATE = 0.22;
const SUPPLEMENTAL_HIGH_RATE = 0.37;

function bracketsFor(taxYear: TaxYear, filingStatus: FilingStatus): Bracket[] {
  const table = taxYear === 2025 ? BRACKETS_2025 : BRACKETS_2026;
  return table[filingStatus];
}

export function standardDeduction(taxYear: TaxYear, filingStatus: FilingStatus): number {
  const table = taxYear === 2025 ? STANDARD_DEDUCTION_2025 : STANDARD_DEDUCTION_2026;
  return table[filingStatus];
}

/**
 * Returns the marginal federal rate (as a fraction) for the given taxable income.
 */
export function federalMarginalRate(
  taxableIncomeUsd: number,
  filingStatus: FilingStatus,
  taxYear: TaxYear,
): number {
  if (!Number.isFinite(taxableIncomeUsd) || taxableIncomeUsd < 0) {
    throw new TaxCalcError(`Invalid taxable income: ${taxableIncomeUsd}`);
  }
  const brackets = bracketsFor(taxYear, filingStatus);
  let rate = brackets[0]!.rate;
  for (const b of brackets) {
    if (taxableIncomeUsd >= b.from) rate = b.rate;
    else break;
  }
  return rate;
}

/**
 * Returns total federal income tax owed on the given taxable income, computed across brackets.
 */
export function federalIncomeTax(
  taxableIncomeUsd: number,
  filingStatus: FilingStatus,
  taxYear: TaxYear,
): number {
  if (!Number.isFinite(taxableIncomeUsd) || taxableIncomeUsd < 0) {
    throw new TaxCalcError(`Invalid taxable income: ${taxableIncomeUsd}`);
  }
  const brackets = bracketsFor(taxYear, filingStatus);
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const cur = brackets[i]!;
    const next = brackets[i + 1];
    if (taxableIncomeUsd <= cur.from) break;
    const upper = next ? Math.min(taxableIncomeUsd, next.from) : taxableIncomeUsd;
    tax += (upper - cur.from) * cur.rate;
    if (!next || taxableIncomeUsd <= next.from) break;
  }
  return tax;
}

/**
 * Federal supplemental wage withholding rate for a payment, given YTD supplemental wages.
 * Rule: 22% on the first $1,000,000 of supplemental wages in the year, 37% on the excess.
 *
 * Returns the BLENDED rate to apply to a single payment of `paymentUsd` when YTD supplemental
 * paid before this payment is `ytdSupplementalUsd`.
 */
export function federalSupplementalWithholdingRate(
  ytdSupplementalUsd: number,
  paymentUsd: number,
  _taxYear: TaxYear,
): number {
  if (!Number.isFinite(ytdSupplementalUsd) || ytdSupplementalUsd < 0) {
    throw new TaxCalcError(`Invalid YTD supplemental: ${ytdSupplementalUsd}`);
  }
  if (!Number.isFinite(paymentUsd) || paymentUsd < 0) {
    throw new TaxCalcError(`Invalid payment: ${paymentUsd}`);
  }
  if (paymentUsd === 0) return SUPPLEMENTAL_LOW_RATE;

  const startTotal = ytdSupplementalUsd;
  const endTotal = ytdSupplementalUsd + paymentUsd;
  const threshold = SUPPLEMENTAL_HIGH_RATE_THRESHOLD;

  if (endTotal <= threshold) return SUPPLEMENTAL_LOW_RATE;
  if (startTotal >= threshold) return SUPPLEMENTAL_HIGH_RATE;

  // Mixed: split the payment around the threshold.
  const lowPortion = threshold - startTotal;
  const highPortion = endTotal - threshold;
  const blended = (lowPortion * SUPPLEMENTAL_LOW_RATE + highPortion * SUPPLEMENTAL_HIGH_RATE) / paymentUsd;
  return blended;
}

export const SUPPLEMENTAL_RATES = {
  low: SUPPLEMENTAL_LOW_RATE,
  high: SUPPLEMENTAL_HIGH_RATE,
  threshold: SUPPLEMENTAL_HIGH_RATE_THRESHOLD,
} as const;

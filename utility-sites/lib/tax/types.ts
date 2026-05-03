export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh';
export type TaxYear = 2025 | 2026;

export interface RsuShortfallInput {
  taxYear: TaxYear;
  filingStatus: FilingStatus;
  /** Fair market value of shares vested in this event, USD. */
  vestGrossUsd: number;
  /** Year-to-date supplemental wages already paid (RSU vests, bonuses) BEFORE this vest. */
  ytdSupplementalWagesUsd: number;
  /** Year-to-date regular W-2 wages BEFORE this vest. */
  ytdRegularWagesUsd: number;
  /** Other taxable income for the year (spouse W-2, dividends, interest, etc.). */
  otherTaxableIncomeUsd: number;
  /** Pre-tax deductions YTD (401k, HSA) reducing federal taxable wages. */
  preTaxDeductionsUsd: number;
  /** Two-letter state code, e.g. "CA". Use "XX" if unknown / no state tax. */
  stateCode: string;
  /** Optional override for state marginal rate as a percentage (e.g. 9.3). */
  stateOverrideRatePct?: number;
  /** True if the user has already maxed Social Security wage base via another employer. */
  ficaAlreadyMaxed?: boolean;
}

export interface FicaBreakdown {
  ssUsd: number;
  medicareUsd: number;
  additionalMedicareUsd: number;
}

export interface RsuShortfallResult {
  vestGrossUsd: number;

  withheldFederalUsd: number;
  withheldStateUsd: number;
  withheldFicaUsd: number;

  expectedFederalUsd: number;
  expectedStateUsd: number;
  expectedFicaUsd: number;

  /** expectedTotal - withheldTotal. Positive = owe more, negative = refund expected. */
  shortfallUsd: number;

  /** If the safe-harbor threshold is exceeded, suggested quarterly estimate. */
  suggestedQuarterlyEstimateUsd: number;
  /** If shortfall is positive, suggested per-paycheck extra W-4 withholding for the rest of the year. */
  suggestedExtraW4PerPaycheckUsd: number;
  /** Approximate bi-weekly paychecks remaining this calendar year from "today". */
  paychecksRemainingThisYear: number;
  /** True if shortfall exceeds the IRS safe-harbor threshold ($1,000). */
  isUnderpaymentRisk: boolean;

  marginalFederalRatePct: number;
  effectiveFederalRatePct: number;
  marginalStateRatePct: number;

  /** Federal supplemental withholding rate applied to this vest, as a fraction (0.22 or 0.37 typically). */
  appliedFederalSupplementalRate: number;
}

export class TaxCalcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaxCalcError';
  }
}

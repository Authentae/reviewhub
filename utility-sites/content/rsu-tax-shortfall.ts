export const rsuTaxShortfallContent = {
  slug: 'rsu-tax-shortfall',
  title: 'RSU Tax Withholding Shortfall Calculator',
  metaTitle: 'RSU Tax Withholding Shortfall Calculator (2025–2026)',
  metaDescription:
    'Free calculator to estimate the gap between what your employer withholds at RSU vest (22% or 37%) and what you actually owe. Avoid surprise tax bills and underpayment penalties.',
  h1: 'RSU Tax Shortfall Calculator',
  lede:
    'Your employer withholds federal tax at a flat 22% on RSU vests (37% above $1M YTD). At higher marginal rates, that creates a tax shortfall you only discover at filing time. Estimate yours below.',
  lastUpdated: '2026-05-03',
  taxYearDefault: 2026,
  howToSteps: [
    {
      name: 'Enter your vest details',
      text: 'Type in the gross dollar value of the RSU vest you received (or are about to receive).',
    },
    {
      name: 'Add your year-to-date wages',
      text: 'Include both regular W-2 wages and any prior supplemental wages (other RSU vests, bonuses) paid earlier this year.',
    },
    {
      name: 'Pick your filing status and state',
      text: 'These determine your federal marginal rate and whether state withholding applies.',
    },
    {
      name: 'Read the shortfall and suggested action',
      text: 'If the shortfall exceeds $1,000, consider a quarterly estimated payment or extra W-4 withholding for the rest of the year.',
    },
  ],
  faqs: [
    {
      q: 'Why does my employer withhold only 22% on RSUs?',
      a: 'IRS Pub 15-T treats RSU vests as “supplemental wages,” which have a fixed 22% federal withholding rate up to $1,000,000 in YTD supplemental wages, then 37% on the excess. Your actual marginal rate may be much higher (32%, 35%, or 37%), creating a shortfall.',
    },
    {
      q: 'What is the $1,000,000 threshold?',
      a: 'When your year-to-date supplemental wages cross $1M with this employer, every dollar above the threshold is withheld at 37% instead of 22%. The calculator blends the rate when a single vest crosses the threshold.',
    },
    {
      q: 'Do I need to make estimated tax payments?',
      a: 'You may, especially if the shortfall is over $1,000. The IRS safe-harbor rules let you avoid an underpayment penalty by paying either 90% of this year’s tax or 110% of last year’s (if AGI > $150k). Check IRS Pub 505 for your situation.',
    },
    {
      q: 'What if I am over-withheld?',
      a: 'A negative shortfall means you’ll get a refund on the vest portion at filing time. The calculator labels this clearly. Some people deliberately accept overwithholding as a forced savings mechanism.',
    },
    {
      q: 'Does this work for double-trigger RSUs?',
      a: 'Yes — once the second trigger occurs (typically IPO), the shares vest for tax purposes and the same supplemental-withholding math applies.',
    },
    {
      q: 'Does it cover ISO/NSO/ESPP?',
      a: 'Not directly. Those have different tax mechanics (AMT for ISOs, ordinary income for NSO exercise, qualifying-disposition rules for ESPP). Adjacent calculators are planned.',
    },
    {
      q: 'How accurate is the state tax estimate?',
      a: 'v1 uses the top marginal rate per state as an approximation. For users above the highest bracket the estimate is exact; for lower-income users it overstates state tax by a few percentage points. Use the override field to enter your exact rate.',
    },
    {
      q: 'Is this tax advice?',
      a: 'No — it’s an estimate based on published rules and your inputs. It does not consider AMT, multi-state residency, or other facts a CPA would catch. For decisions involving real money, talk to a licensed tax professional.',
    },
  ],
} as const;

import type { BlogPost } from '../registry';

export const estimatedTax: BlogPost = {
  slug: 'estimated-tax-after-rsu-vest',
  title: 'Should you make estimated tax payments after an RSU vest?',
  description:
    'How the IRS safe-harbor rule works, when an RSU shortfall triggers an underpayment penalty, and the two ways to fix it.',
  datePublished: '2026-04-20',
  dateModified: '2026-05-01',
  authorName: 'Mathstub Editorial',
  reviewerName: 'Pending CPA review',
  affiliateOfferIds: ['turbotax-premier', 'taxact-premier'],
  blocks: [
    {
      type: 'p',
      text:
        'A surprise RSU tax shortfall can also trigger an IRS underpayment penalty. The penalty is small — often a few hundred dollars on a few thousand of shortfall — but it is annoying and entirely avoidable.',
    },
    { type: 'h2', text: 'The safe-harbor rule (IRS Pub 505)' },
    { type: 'p', text: 'You will not owe an underpayment penalty for the year if you paid in (via withholding + estimated taxes) at least the smaller of:' },
    {
      type: 'ul',
      items: [
        '90% of the tax owed for the current year, OR',
        '100% of the tax owed for the prior year (110% if your AGI was over $150,000).',
      ],
    },
    {
      type: 'p',
      text:
        'If your only income is W-2 wages and your withholding covers the prior-year safe harbor, you usually do not need to do anything. RSU vests break this — they push your total income up while only being withheld at 22%.',
    },
    { type: 'h2', text: 'Two ways to plug the gap' },
    { type: 'h3', text: 'Option 1: Make a quarterly estimated tax payment' },
    {
      type: 'p',
      text:
        'Quarterly due dates for 2026 are April 15, June 15, September 15, and January 15 (next year). Pay the shortfall in the quarter the vest occurred — or split it across the remaining quarters. The IRS treats withholding as paid evenly throughout the year by default; estimated payments are credited to the quarter they were made, so timing matters if you want to avoid penalties on prior quarters.',
    },
    { type: 'h3', text: 'Option 2: Update your W-4 to withhold extra' },
    {
      type: 'p',
      text:
        'On the latest Form W-4, line 4(c) lets you specify an additional dollar amount to withhold from each regular paycheck. This is the simplest fix because it works through your existing payroll. The calculator above estimates the per-paycheck add for the rest of the year.',
    },
    {
      type: 'callout',
      text:
        'If the shortfall is over $1,000 and you have plenty of remaining paychecks, prefer the W-4 update. If the shortfall is $1,000+ but few paychecks remain, write the IRS a check.',
    },
    { type: 'h2', text: 'When you do NOT need to act' },
    {
      type: 'ul',
      items: [
        'Shortfall under $1,000 — under the safe-harbor floor.',
        'Your prior-year tax was small, and your existing withholding already covers 110% of it.',
        'You will be claiming a refundable credit large enough to wipe the shortfall (rare with high RSU income).',
      ],
    },
    {
      type: 'p',
      text:
        'When in doubt, run the numbers. Both major tax-prep tools — TurboTax Premier and TaxAct Premier — will project the rest of your year and tell you exactly what to send in.',
    },
  ],
};

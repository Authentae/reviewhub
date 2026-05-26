import type { BlogPost } from '../registry';

export const extraW4: BlogPost = {
  slug: 'extra-w4-withholding-rsu',
  title: 'How to set extra W-4 withholding to cover an RSU shortfall',
  description:
    'Step-by-step guide to using Form W-4 line 4(c) to withhold extra federal tax from each paycheck and avoid an April surprise.',
  datePublished: '2026-04-22',
  dateModified: '2026-05-01',
  authorName: 'Mathstub Editorial',
  reviewerName: 'Pending CPA review',
  affiliateOfferIds: ['turbotax-premier', 'empower'],
  blocks: [
    {
      type: 'p',
      text:
        'The simplest way to plug an RSU withholding shortfall is to update your W-4 so your employer takes a bit more from every regular paycheck for the rest of the year. The W-4 redesign in 2020 made this much easier than the old allowances system.',
    },
    { type: 'h2', text: 'Step 1: Calculate the shortfall' },
    {
      type: 'p',
      text:
        'Use the calculator above. The “suggested extra W-4 per paycheck” line is what to enter on line 4(c).',
    },
    { type: 'h2', text: 'Step 2: Open Form W-4' },
    {
      type: 'p',
      text:
        'Most employers let you update W-4 in their HR portal (Workday, ADP, Rippling, Justworks all support this). Or download the latest paper Form W-4 from the IRS website.',
    },
    { type: 'h2', text: 'Step 3: Fill line 4(c)' },
    {
      type: 'p',
      text:
        'Skip the income/dependents sections if they do not apply. Go to the “Other adjustments” area and put your per-paycheck add into line 4(c) labeled “Extra withholding.” Save and submit.',
    },
    { type: 'h2', text: 'Step 4: Verify on your next paystub' },
    {
      type: 'p',
      text:
        'Federal income tax withheld should jump by the amount you entered. If it does not, your update did not propagate — re-submit and ping payroll.',
    },
    {
      type: 'callout',
      text:
        'After year-end, REMEMBER to undo the W-4 change if it was a one-time vest. Otherwise you will over-withhold all of next year and effectively give the IRS an interest-free loan.',
    },
    { type: 'h2', text: 'Why W-4 beats quarterly estimates for most people' },
    {
      type: 'ul',
      items: [
        'Withholding is treated as paid evenly throughout the year by IRS default — no penalty risk for prior quarters.',
        'No extra forms or check-writing.',
        'Set-and-forget for the duration of the year.',
      ],
    },
    {
      type: 'p',
      text:
        'If you want a single dashboard that shows the impact of equity comp on your overall finances, free tools like Empower can pull your accounts and project taxes alongside investments.',
    },
  ],
};

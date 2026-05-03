import type { BlogPost } from '../registry';

export const byState: BlogPost = {
  slug: 'rsu-taxes-by-state',
  title: 'RSU taxes by state: California, New York, Washington, and Texas compared',
  description:
    'How state income tax stacks on top of federal RSU withholding in the four biggest tech-worker states, with worked examples.',
  datePublished: '2026-04-25',
  dateModified: '2026-05-01',
  authorName: 'Utility Tools Editorial',
  reviewerName: 'Pending CPA review',
  affiliateOfferIds: ['turbotax-premier', 'harness-wealth'],
  blocks: [
    {
      type: 'p',
      text:
        'Federal RSU withholding is the same everywhere: 22% (or 37% above $1M YTD). State withholding is wildly different. Here is how the four biggest tech-worker states actually treat an RSU vest.',
    },
    { type: 'h2', text: 'California' },
    {
      type: 'ul',
      items: [
        'Top marginal rate: 12.3% (13.3% above $1M income with the mental-health surcharge).',
        'Supplemental withholding: 10.23% on stock-option / RSU income (FTB Pub DE 44).',
        'Result: a CA top-bracket employee under-withholds at 2.07% (12.3 − 10.23) on top of the federal gap.',
      ],
    },
    { type: 'h2', text: 'New York' },
    {
      type: 'ul',
      items: [
        'Top marginal rate: 10.9%.',
        'Supplemental withholding: roughly 11.7% (NYC residents face additional city tax of up to 3.876%).',
        'Result: state federal-gap is small, but NYC residents see the largest combined effective rate of any major US tech city.',
      ],
    },
    { type: 'h2', text: 'Washington' },
    {
      type: 'ul',
      items: [
        'No state income tax on wages.',
        'Result: state withholding is zero. Federal-only shortfall applies.',
        'Note: Washington introduced a 7% capital-gains tax in 2022, but that does not affect ordinary RSU vest income — only sales of vested shares above the long-term threshold.',
      ],
    },
    { type: 'h2', text: 'Texas' },
    {
      type: 'ul',
      items: [
        'No state income tax.',
        'Same as Washington — federal-only shortfall.',
      ],
    },
    {
      type: 'callout',
      text:
        'Multi-state residency mid-year (very common for IPO workers who relocate around the lockup) is a separate problem. The income may be split between states based on where the work was performed. This is exactly the kind of fact pattern where a $200 CPA consultation pays for itself.',
    },
    { type: 'h2', text: 'Worked example: $50,000 vest, $200,000 base salary, single filer' },
    {
      type: 'p',
      text:
        'Federal: marginal 32% × $50k = $16,000 owed; withheld 22% × $50k = $11,000; gap $5,000. ' +
        'CA: marginal 12.3% × $50k = $6,150 owed; withheld 10.23% × $50k = $5,115; gap $1,035. ' +
        'NY (no NYC): marginal 10.9% × $50k = $5,450; withheld ~11.7% × $50k = $5,850; refund $400. ' +
        'WA / TX: state gap = $0.',
    },
    {
      type: 'p',
      text:
        'The federal gap is by far the bigger lever. Run the calculator above with your exact state to get specific numbers.',
    },
  ],
};

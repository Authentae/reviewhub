import type { BlogPost } from '../registry';

export const supplementalRule: BlogPost = {
  slug: '22-vs-37-supplemental-withholding',
  title: '22% vs 37% supplemental wage withholding, explained',
  description:
    'The IRS supplemental-wage rule taxes your RSU and bonus payments at 22% — until you cross $1M in YTD supplemental wages, when it jumps to 37%. Here is how the threshold actually works.',
  datePublished: '2026-04-18',
  dateModified: '2026-05-01',
  authorName: 'Utility Tools Editorial',
  reviewerName: 'Pending CPA review',
  affiliateOfferIds: ['turbotax-premier', 'harness-wealth'],
  blocks: [
    {
      type: 'p',
      text:
        'IRS Publication 15-T defines a “supplemental wage” as compensation paid in addition to regular wages — most commonly bonuses, commissions, severance, and RSU vests. The rule for federal withholding on supplemental wages is straightforward, but the threshold trips people up.',
    },
    { type: 'h2', text: 'The two rates' },
    {
      type: 'ul',
      items: [
        '22% on the first $1,000,000 of supplemental wages paid to you by a single employer in the calendar year.',
        '37% on the portion above $1,000,000.',
      ],
    },
    { type: 'h2', text: 'The threshold is per-employer, per-year' },
    {
      type: 'p',
      text:
        'If you change jobs mid-year, both employers reset the $1M counter independently. That means you could legitimately have $1.8M in supplemental wages with $0 paid at 37% — until you file and reconcile against your true marginal rate, which will treat the full amount as ordinary income.',
    },
    { type: 'h2', text: 'How the calculator handles a vest that crosses the threshold' },
    {
      type: 'p',
      text:
        'If your YTD supplemental wages going into a vest are $800k and the vest is $400k, the first $200k of the vest is withheld at 22% and the next $200k at 37%, for a blended rate of 29.5%. The calculator above models this exactly.',
    },
    { type: 'h2', text: 'Why a 37% rate is still not enough at the very top' },
    {
      type: 'p',
      text:
        'Once your total taxable income passes the top federal bracket ($626,350 single in 2025), every additional dollar is taxed at 37% federal — but you also owe Additional Medicare 0.9% on wages above $200k (single) and state income tax of up to 13.3% in CA. The 37% supplemental rate alone leaves a small but meaningful gap at the very top.',
    },
    {
      type: 'callout',
      text:
        'If your situation is complicated (multiple employers in one year, double-trigger vests around an IPO, or you cross the $1M threshold), it is worth $200–400 to have a CPA do the calculation once and confirm. Harness Wealth matches you with equity-comp specialists.',
    },
  ],
};

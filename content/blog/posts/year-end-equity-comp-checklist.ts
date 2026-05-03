import type { BlogPost } from '../registry';

export const yearEndChecklist: BlogPost = {
  slug: 'year-end-equity-comp-checklist',
  title: 'Year-end equity comp tax checklist (RSUs, ESPP, ISO, NSO)',
  description:
    'A 10-item December checklist to avoid surprises on next April’s return when your compensation includes RSUs, ESPP, or stock options.',
  datePublished: '2026-04-30',
  dateModified: '2026-05-01',
  authorName: 'Utility Tools Editorial',
  reviewerName: 'Pending CPA review',
  affiliateOfferIds: ['turbotax-premier', 'harness-wealth', 'carta'],
  blocks: [
    {
      type: 'p',
      text:
        'December is the last useful month to act on equity-comp tax planning for the current year. Use this checklist to walk through your situation; each item links back to the calculator or a deeper article.',
    },
    { type: 'h2', text: 'The checklist' },
    {
      type: 'ol',
      items: [
        'Pull your YTD W-2 wages and YTD supplemental wages from your most recent paystub.',
        'Run the RSU shortfall calculator for each remaining vest expected this year.',
        'Estimate ESPP qualifying disposition implications if you have shares from a 6-month period that completed during the year.',
        'For ISOs, check whether any exercises this year could trigger Alternative Minimum Tax (AMT) — the bargain element is added to AMTI.',
        'For NSO exercises, confirm the bargain element was reported as supplemental wages on a paystub.',
        'If any vest pushed you over $1M YTD supplemental, confirm the 37% rate kicked in on the excess.',
        'Check your W-4 line 4(c) — undo any one-time extra withholding from earlier in the year that no longer applies.',
        'Decide quarterly estimate vs W-4 update for any remaining shortfall (see the estimated-tax article).',
        'Set a January reminder to re-update the W-4 with new RSU vesting dates for next year.',
        'If your equity comp situation is complex (multi-state, multi-employer, IPO mid-year), book a CPA consult before December 31.',
      ],
    },
    { type: 'h2', text: 'Things you cannot fix after December 31' },
    {
      type: 'ul',
      items: [
        'Charitable donations of appreciated stock — must be transferred to the donee organization by year-end to deduct in the current year.',
        'ISO disqualifying disposition timing — selling shares before the qualifying-disposition window changes the character of gain.',
        'Tax-loss harvesting — same rule.',
      ],
    },
    {
      type: 'callout',
      text:
        'If you do nothing else this December, run the calculator above for your next vest and confirm the W-4 line 4(c) is set correctly. Those two actions alone fix 80% of April surprises.',
    },
  ],
};

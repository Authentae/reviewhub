import type { BlogPost } from '../registry';

export const whyRsuTooHigh: BlogPost = {
  slug: 'why-rsu-tax-bill-too-high',
  title: 'Why your RSU tax bill seems too high — the 22% withholding gap, explained',
  description:
    'Your employer withholds 22% federal on RSU vests, but your real marginal rate may be 32–37%. Here is the math, and how to avoid an April surprise.',
  datePublished: '2026-04-15',
  dateModified: '2026-05-01',
  authorName: 'Utility Tools Editorial',
  reviewerName: 'Pending CPA review',
  affiliateOfferIds: ['turbotax-premier', 'taxact-premier'],
  blocks: [
    {
      type: 'p',
      text:
        'If you got an RSU vest this year and a tax bill that made you blink twice in April, you are not alone. The cause is almost always the same: your employer withheld federal income tax at a flat 22% under IRS supplemental-wage rules, but your actual marginal rate is much higher.',
    },
    { type: 'h2', text: 'How RSU withholding works' },
    {
      type: 'p',
      text:
        'When RSUs vest, the IRS treats their fair-market value as ordinary wages. But because vests do not happen on a regular pay cycle, employers default to a flat “supplemental wage” withholding rate published by the IRS in Publication 15-T:',
    },
    {
      type: 'ul',
      items: [
        '22% on the first $1,000,000 of supplemental wages paid to you in the calendar year.',
        '37% on every dollar of supplemental wages above $1,000,000.',
      ],
    },
    {
      type: 'p',
      text:
        'Your employer applies these rates regardless of your actual tax bracket. That is the gap.',
    },
    { type: 'h2', text: 'Where the shortfall comes from' },
    {
      type: 'p',
      text:
        'Imagine a single filer earning $200,000 in regular W-2 wages who receives a $50,000 RSU vest. The marginal federal rate at $250,000 is 35%. The employer withholds $11,000 (22% × $50,000), but the actual federal tax owed on the vest at the margin is closer to $17,500. The $6,500 gap shows up at filing time.',
    },
    {
      type: 'callout',
      text:
        'Run your own number with the calculator above. Inputs stay in your browser; nothing is sent to a server.',
    },
    { type: 'h2', text: 'State withholding makes it worse in a few states' },
    {
      type: 'p',
      text:
        'Some states (notably California and New York) apply a flat supplemental rate around 10.23% to RSU vests. If you are in CA’s top bracket, your real marginal state rate is 12.3% (or 13.3% above $1M with the mental-health surcharge), so a smaller-but-real shortfall stacks on top of the federal one.',
    },
    { type: 'h2', text: 'What to do about it' },
    {
      type: 'ol',
      items: [
        'Estimate the shortfall the moment a vest hits — not in March of next year.',
        'If the shortfall is over $1,000, either make a quarterly estimated tax payment or update your W-4 to withhold extra from your paycheck for the rest of the year.',
        'Keep documentation of the vest, the gross value, and the withholding so your CPA (or you, with TurboTax Premier) can reconcile it on Form 8949 and Schedule D when you file.',
      ],
    },
    {
      type: 'p',
      text:
        'The math is not magic. It is just that the IRS rule was designed for a payroll system, not for the modern equity-comp world. Once you know the gap exists, the fix takes minutes.',
    },
  ],
};

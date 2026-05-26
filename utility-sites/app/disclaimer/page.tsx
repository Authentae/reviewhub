import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  slug: 'disclaimer',
  title: 'Disclaimer',
  description:
    'Information on Mathstub is for educational purposes only and is not tax, legal, or financial advice.',
});

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 prose prose-gray dark:prose-invert">
      <h1>Disclaimer</h1>
      <p>
        The calculators and articles on Mathstub are provided for
        educational and informational purposes only. They are not intended as,
        and do not constitute, tax, legal, accounting, investment, or other
        professional advice.
      </p>
      <p>
        Tax rules vary by jurisdiction and personal circumstances. Our
        calculators model published federal, state, and FICA rules at the time
        of last update, but cannot account for every fact pattern (Alternative
        Minimum Tax, multi-state residency, equity-comp special elections,
        etc.).
      </p>
      <p>
        Before acting on any calculation, consult a licensed Certified Public
        Accountant (CPA) or tax attorney familiar with your situation. Utility
        Tools assumes no liability for losses or penalties incurred from
        reliance on its calculators or content.
      </p>
      <p>
        Some links on this site are affiliate links. See our{' '}
        <a href="/editorial-policy">editorial policy</a> for details on how
        affiliate relationships are managed.
      </p>
    </main>
  );
}

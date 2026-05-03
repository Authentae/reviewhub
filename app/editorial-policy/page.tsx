import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  slug: 'editorial-policy',
  title: 'Editorial policy',
  description:
    'How Mathstub researches, reviews, sources, and updates its calculators and tax content.',
});

export default function EditorialPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 prose prose-gray dark:prose-invert">
      <h1>Editorial policy</h1>
      <p>
        Tax calculators are Your Money or Your Life (YMYL) content. We hold
        them to a higher bar than typical web tools.
      </p>

      <h2>Sources</h2>
      <ul>
        <li>
          Federal income-tax brackets and rules: IRS Rev. Proc. annual
          publications and IRS Publications 15-T (supplemental wages), 505
          (estimated tax), and 525 (taxable income).
        </li>
        <li>
          State income-tax brackets: Tax Foundation’s annual state-bracket
          summary, cross-checked with each state’s Department of Revenue
          published rates.
        </li>
        <li>
          FICA: Social Security Administration’s annual contribution-and-benefit
          base announcement.
        </li>
      </ul>

      <h2>Calculator review process</h2>
      <p>Every new calculator goes through:</p>
      <ol>
        <li>A unit test pass requiring 100% line + branch coverage on the math module.</li>
        <li>
          Independent review by a licensed CPA before public launch. The CPA
          spot-checks the formula, sources cited, and edge cases.
        </li>
        <li>
          A “show the math” section in the UI so any reader can verify what the
          tool did with their inputs.
        </li>
      </ol>

      <h2>Annual updates</h2>
      <p>
        Every January we update brackets, FICA wage base, state rates, and any
        rule changes. Last updated dates are shown on every calculator and
        article.
      </p>

      <h2>Affiliate disclosure</h2>
      <p>
        Some links on this site are affiliate links — we may earn a commission
        at no cost to you when you sign up for a product through them. We only
        feature products that genuinely solve the problem the calculator
        identifies. Affiliate relationships never alter the calculator output.
      </p>
    </main>
  );
}

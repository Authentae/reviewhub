import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  slug: 'about',
  title: 'About',
  description: 'About Mathstub — small free calculators for big money moments.',
});

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 prose prose-gray dark:prose-invert">
      <h1>About Mathstub</h1>
      <p>
        Mathstub ships small, focused calculators for the financial
        situations that catch people off guard — starting with the RSU
        withholding gap that leaves tech workers with a surprise tax bill every
        April.
      </p>

      <h2>What we cover</h2>
      <ul>
        <li>
          <strong>Equity comp tax math</strong> — RSU withholding shortfall,
          ESPP qualifying disposition, ISO/AMT exposure (planned).
        </li>
        <li>
          <strong>Job-change money decisions</strong> — vesting cliffs, FSA
          carryover, COBRA timing (planned).
        </li>
        <li>
          <strong>Anything else that takes a tax pro 15 minutes</strong> to
          calculate but should take a calculator 15 seconds.
        </li>
      </ul>

      <h2>Who builds it</h2>
      <p>
        This site is run by a small team that has personally been blindsided by
        a four-figure RSU tax bill more than once. Tools are reviewed for
        accuracy by a CPA before launch and updated annually as IRS thresholds
        change. See our{' '}
        <a href="/editorial-policy">editorial policy</a> for details.
      </p>

      <h2>How we make money</h2>
      <p>
        Every tool is free to use. We make money two ways: display ads (Google
        AdSense) and affiliate commissions when readers sign up for products
        we’ve vetted (TurboTax, TaxAct, Carta, Empower, Harness Wealth). We
        only recommend products that solve the problem the calculator
        identifies. Affiliate relationships never influence the math.
      </p>

      <h2>Get in touch</h2>
      <p>
        Spotted a calculation mistake or want to suggest a tool? Open an issue
        on our public repo (linked from the footer once we move it).
      </p>
    </main>
  );
}

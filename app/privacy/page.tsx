import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  slug: 'privacy',
  title: 'Privacy policy',
  description: 'How Utility Tools handles cookies, analytics, ads, and your data.',
});

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 prose prose-gray dark:prose-invert">
      <h1>Privacy policy</h1>
      <p>
        Utility Tools does not require an account to use our calculators. Inputs you
        type stay in your browser and are never sent to our servers.
      </p>

      <h2>Cookies and analytics</h2>
      <p>
        We use Google Analytics 4 to understand which pages and features
        visitors use. GA4 sets cookies and may collect anonymized IP, page,
        device, and referrer data.
      </p>

      <h2>Advertising</h2>
      <p>
        We display ads served by Google AdSense. Google and its partners may
        use cookies to serve ads based on prior visits to this site or other
        sites. EEA/UK visitors are shown a Google-managed consent prompt.
        Visit{' '}
        <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer">
          Google Ads Settings
        </a>{' '}
        to control personalized advertising or visit{' '}
        <a href="https://www.aboutads.info" target="_blank" rel="noreferrer">
          aboutads.info
        </a>
        .
      </p>

      <h2>Affiliate links</h2>
      <p>
        Some outbound links on this site are affiliate links. When you click
        one, the partner may set tracking cookies to attribute the referral. We
        receive a commission if you sign up. See our{' '}
        <a href="/disclaimer">disclaimer</a>.
      </p>

      <h2>Contact</h2>
      <p>For privacy questions, email privacy@example.com (replace with real address before launch).</p>
    </main>
  );
}

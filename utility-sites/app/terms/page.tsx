import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  slug: 'terms',
  title: 'Terms of use',
  description: 'Terms of use for Utility Tools.',
});

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 prose prose-gray dark:prose-invert">
      <h1>Terms of use</h1>
      <p>
        By using Utility Tools, you agree to these terms. If you do not agree,
        please do not use the site.
      </p>

      <h2>Use of calculators</h2>
      <p>
        Calculators are provided as-is. We make no guarantees about accuracy,
        suitability for any purpose, or fitness for compliance with any law.
        See our <a href="/disclaimer">disclaimer</a>.
      </p>

      <h2>Intellectual property</h2>
      <p>
        All site content (calculators, articles, design) is the property of the
        site owner unless otherwise noted. You may share short excerpts with
        attribution.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        Utility Tools and its authors are not liable for any direct, indirect,
        incidental, or consequential damages arising from use of this site or
        reliance on its content.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms from time to time. Continued use after a
        change constitutes acceptance.
      </p>
    </main>
  );
}

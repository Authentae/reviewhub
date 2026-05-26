import Link from 'next/link';
import { liveTools } from '@/lib/tools';
import { SITE_NAME } from '@/lib/seo';

export default function HomePage() {
  const tools = liveTools();
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
        Small tools for big money moments.
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-gray-700 dark:text-gray-300">
        {SITE_NAME} ships focused calculators for the financial situations that
        catch people off guard — starting with the RSU withholding gap that
        leaves tech workers with a surprise tax bill every April.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tools</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {tools.map((t) => (
            <li
              key={t.slug}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <Link href={`/${t.slug}`} className="block">
                <h3 className="text-lg font-semibold text-brand-700 dark:text-brand-100">
                  {t.emoji ? `${t.emoji} ` : ''}
                  {t.title}
                </h3>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{t.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

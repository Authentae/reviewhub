import Link from 'next/link';
import { liveTools } from '@/lib/tools';
import { SITE_NAME } from '@/lib/seo';

export function Footer() {
  const tools = liveTools();
  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50 py-8 dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 text-sm md:grid-cols-3">
        <div>
          <h2 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">{SITE_NAME}</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Free tools for your money and your time. No signup, no email walls.
          </p>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Tools</h3>
          <ul className="space-y-1">
            {tools.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/${t.slug}`}
                  className="text-gray-600 hover:text-brand-700 dark:text-gray-400 dark:hover:text-brand-100"
                >
                  {t.shortTitle}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">About</h3>
          <ul className="space-y-1">
            <li>
              <Link
                href="/about"
                className="text-gray-600 hover:text-brand-700 dark:text-gray-400 dark:hover:text-brand-100"
              >
                About
              </Link>
            </li>
            <li>
              <Link
                href="/editorial-policy"
                className="text-gray-600 hover:text-brand-700 dark:text-gray-400 dark:hover:text-brand-100"
              >
                Editorial policy
              </Link>
            </li>
            <li>
              <Link
                href="/disclaimer"
                className="text-gray-600 hover:text-brand-700 dark:text-gray-400 dark:hover:text-brand-100"
              >
                Disclaimer
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="text-gray-600 hover:text-brand-700 dark:text-gray-400 dark:hover:text-brand-100"
              >
                Privacy
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="text-gray-600 hover:text-brand-700 dark:text-gray-400 dark:hover:text-brand-100"
              >
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-5xl px-4 text-xs text-gray-500 dark:text-gray-500">
        © {new Date().getFullYear()} {SITE_NAME}. Some links on this site are
        affiliate links — we may earn a commission at no extra cost to you.
      </p>
    </footer>
  );
}

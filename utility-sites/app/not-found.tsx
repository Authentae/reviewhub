import Link from 'next/link';
import { liveTools } from '@/lib/tools';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Page not found</h1>
      <p className="mt-2 text-gray-700 dark:text-gray-300">
        The page you’re looking for doesn’t exist. Try one of our tools instead:
      </p>
      <ul className="mt-6 space-y-2">
        {liveTools().map((t) => (
          <li key={t.slug}>
            <Link href={`/${t.slug}`} className="text-brand-700 underline">
              {t.title}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/" className="text-brand-700 underline">
          ← Home
        </Link>
      </p>
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { blogPosts } from '@/content/blog/registry';

export const metadata: Metadata = buildMetadata({
  slug: 'blog',
  title: 'Blog',
  description: 'Articles on equity comp tax, RSU planning, and adjacent topics.',
});

export default function BlogIndex() {
  const posts = [...blogPosts].sort((a, b) =>
    a.datePublished < b.datePublished ? 1 : -1,
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Blog</h1>
      <p className="mt-2 text-gray-700 dark:text-gray-300">
        Articles on equity comp tax, RSU planning, and the rules behind the
        calculators on this site.
      </p>
      <ul className="mt-8 space-y-6">
        {posts.map((p) => (
          <li
            key={p.slug}
            className="rounded-md border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <Link href={`/blog/${p.slug}`} className="block">
              <h2 className="text-xl font-semibold text-brand-700 dark:text-brand-100">{p.title}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {new Date(p.datePublished).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="mt-2 text-gray-700 dark:text-gray-300">{p.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

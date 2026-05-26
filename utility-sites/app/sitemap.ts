import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
import { liveTools } from '@/lib/tools';
import { blogPosts } from '@/content/blog/registry';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const root = siteUrl();
  const staticPages = ['', '/about', '/editorial-policy', '/disclaimer', '/privacy', '/terms', '/blog'];

  return [
    ...staticPages.map((p) => ({
      url: `${root}${p}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: p === '' ? 1 : 0.5,
    })),
    ...liveTools().map((t) => ({
      url: `${root}/${t.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...blogPosts.map((p) => ({
      url: `${root}/blog/${p.slug}`,
      lastModified: new Date(p.dateModified),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}

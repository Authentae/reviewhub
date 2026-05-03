import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const noindex = env.noindex();
  return {
    rules: noindex
      ? [{ userAgent: '*', disallow: '/' }]
      : [{ userAgent: '*', allow: '/' }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

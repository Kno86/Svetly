import type { MetadataRoute } from 'next';
import { apiGet } from '../lib/content';
import { siteUrl, sitemapEntries, type SitemapData } from '../lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const res = await apiGet<SitemapData>('/api/sitemap');
  return sitemapEntries(siteUrl(), res.ok ? res.data : null);
}

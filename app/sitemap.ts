import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { JOB_ROLES } from '@/lib/careers';

// Regenerate at most hourly (ISR). Without this the sitemap is built once at
// deploy time, so posts published later via the admin panel never appear in it
// until the next deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://vierradev.com';
  const now = new Date();
  // Stable last-modified for static pages: a fixed date (bump when static content
  // materially changes) instead of `now`, which advanced hourly under ISR and
  // produced the "all-identical, ever-changing lastmod" anti-pattern Google ignores.
  const CONTENT_LASTMOD = new Date('2026-07-15T00:00:00.000Z');
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: CONTENT_LASTMOD,
      changeFrequency: 'weekly',
      priority: 1.0,
      images: [`${baseUrl}/assets/image1.png`, `${baseUrl}/assets/meta-banner.png`],
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: CONTENT_LASTMOD,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/careers`,
      lastModified: CONTENT_LASTMOD,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: CONTENT_LASTMOD,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: CONTENT_LASTMOD,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastModified: CONTENT_LASTMOD,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/work-policy`,
      lastModified: CONTENT_LASTMOD,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/branding`,
      lastModified: CONTENT_LASTMOD,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];
  let blogPages: MetadataRoute.Sitemap = [];
  let tagPages: MetadataRoute.Sitemap = [];
  let authorPages: MetadataRoute.Sitemap = [];
  try {
    const blogPosts = await prisma.blogPost.findMany({
      select: {
        slug: true,
        title: true,
        published_date: true,
        updated_date: true,
        tag: true,
        authors: { select: { name: true } },
      },
      orderBy: {
        published_date: 'desc',
      },
    });
    const filteredPosts = blogPosts.filter((post) => {
      if (!post.slug || !post.slug.trim()) return false;
      if (/[\[\]{}]/.test(post.slug)) return false;
      const slugLower = post.slug.toLowerCase();
      const titleLower = post.title.toLowerCase();
      return !slugLower.includes('test') && !titleLower.includes('test');
    });

    blogPages = filteredPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updated_date ?? post.published_date ?? now),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
      images: [`${baseUrl}/assets/meta-banner.png`],
    }));

    const tagSet = new Set<string>();
    const authorSet = new Set<string>();
    filteredPosts.forEach((post) => {
      if (post.tag) {
        post.tag
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((t) => tagSet.add(t));
      }
      if (post.authors?.name) {
        authorSet.add(post.authors.name);
      }
    });

    tagPages = Array.from(tagSet).map((tag) => ({
      url: `${baseUrl}/blog/tag/${encodeURIComponent(tag)}`,
      lastModified: CONTENT_LASTMOD,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));

    authorPages = Array.from(authorSet).map((name) => ({
      url: `${baseUrl}/blog/author/${encodeURIComponent(name)}`,
      lastModified: CONTENT_LASTMOD,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));
  } catch (error) {
    // A DB failure here silently shrinks the sitemap (all blog + author URLs are
    // dropped), which can read as mass deindexing to search engines. Log at error
    // level so it surfaces in monitoring instead of passing unnoticed; the static
    // pages below are still emitted so the sitemap never comes back empty.
    console.error('Sitemap generation: DB unavailable — blog/author URLs omitted from this build:', error);
  }

  // Individual career role pages — static, generated from the careers data.
  const careerPages: MetadataRoute.Sitemap = JOB_ROLES.map((role) => ({
    url: `${baseUrl}/careers/${role.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Tag archives are intentionally excluded — they are thin, near-duplicate
  // listing pages and carry `noindex, follow`. Author pages stay (E-E-A-T).
  void tagPages;
  return [...staticPages, ...careerPages, ...blogPages, ...authorPages];
}

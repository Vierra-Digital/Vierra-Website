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
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
      images: [`${baseUrl}/assets/image1.png`, `${baseUrl}/assets/meta-banner.png`],
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/careers`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/work-policy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/branding`,
      lastModified: now,
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
        tag: true,
        author: { select: { name: true } },
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
      lastModified: post.published_date ? new Date(post.published_date) : now,
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
      if (post.author?.name) {
        authorSet.add(post.author.name);
      }
    });

    tagPages = Array.from(tagSet).map((tag) => ({
      url: `${baseUrl}/blog/tag/${encodeURIComponent(tag)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));

    authorPages = Array.from(authorSet).map((name) => ({
      url: `${baseUrl}/blog/author/${encodeURIComponent(name)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));
  } catch (error) {
    console.warn('Database unavailable during sitemap generation, skipping blog posts:', error);
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

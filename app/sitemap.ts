import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://vierradev.com';
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/rss.xml`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.4,
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

  return [...staticPages, ...blogPages, ...tagPages, ...authorPages];
}

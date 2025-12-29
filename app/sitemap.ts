import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://vierradev.com';
  const now = new Date();

  // Static pages with proper priorities and change frequencies
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

  // Try to fetch blog posts, but handle errors gracefully
  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const blogPosts = await prisma.blogPost.findMany({
      select: {
        slug: true,
        title: true,
        published_date: true,
      },
      orderBy: {
        published_date: 'desc',
      },
    });

    // Filter out test blogs (case-insensitive check for "test" in slug or title)
    const filteredPosts = blogPosts.filter((post) => {
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
  } catch (error) {
    // If database is unavailable during build, just return static pages
    // Blog posts will be added at runtime when database is available
    console.warn('Database unavailable during sitemap generation, skipping blog posts:', error);
  }

  return [...staticPages, ...blogPages];
}

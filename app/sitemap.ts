import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://vierradev.com';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/work-policy`,
      lastModified: new Date(),
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
        published_date: true,
      },
      orderBy: {
        published_date: 'desc',
      },
    });

    blogPages = blogPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.published_date || new Date(),
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

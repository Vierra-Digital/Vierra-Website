import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

/**
 * Five most recently published blog posts with their view counts.
 *
 * `visits` is the denormalised counter on the post; blog_post_views holds the individual rows.
 * The counter is what the blog itself increments, so it's the number to show — counting the
 * rows would disagree with the public site if any were ever pruned.
 */
export default withAuth(
  async (_req, res) => {
    const posts = await prisma.blogPost.findMany({
      where: { published_date: { lte: new Date() } },
      select: {
        id: true,
        title: true,
        slug: true,
        published_date: true,
        visits: true,
        authors: { select: { name: true } },
      },
      orderBy: { published_date: "desc" },
      take: 5,
    });

    res.status(200).json({
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        publishedDate: post.published_date.toISOString(),
        views: post.visits ?? 0,
        author: post.authors?.name || null,
      })),
    });
  },
  { methods: ["GET"] }
);

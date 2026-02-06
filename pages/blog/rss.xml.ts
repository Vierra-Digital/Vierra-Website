import { GetServerSideProps } from "next"
import { prisma } from "@/lib/prisma"

const escapeXml = (unsafe: string) =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const baseUrl = "https://vierradev.com"
  const posts = await prisma.blogPost.findMany({
    include: { author: true },
    orderBy: { published_date: "desc" },
    take: 50,
  })

  const items = posts
    .map((post) => {
      const title = escapeXml(post.title)
      const link = `${baseUrl}/blog/${post.slug}`
      const description = escapeXml((post as any).description ?? "")
      const pubDate = post.published_date.toUTCString()
      const author = escapeXml(post.author.name)
      return `
        <item>
          <title>${title}</title>
          <link>${link}</link>
          <guid>${link}</guid>
          <description>${description}</description>
          <pubDate>${pubDate}</pubDate>
          <author>${author}</author>
        </item>
      `
    })
    .join("")

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Vierra Blog</title>
    <link>${baseUrl}/blog</link>
    <description>Insights, case studies, and strategies from Vierra.</description>
    <language>en-us</language>
    ${items}
  </channel>
</rss>`

  res.setHeader("Content-Type", "application/rss+xml")
  res.write(rss)
  res.end()

  return { props: {} }
}

export default function RssFeed() {
  return null
}

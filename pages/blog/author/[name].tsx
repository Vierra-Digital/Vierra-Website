import { GetStaticPaths, GetStaticProps } from "next"
import Head from "next/head"
import Script from "next/script"
import Link from "next/link"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/Header"
import Footer from "@/components/FooterSection/Footer"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

type AuthorPageProps = {
  authorName: string
  posts: {
    title: string
    slug: string
    publishedDate: string
    description?: string | null
  }[]
}

const formatDate = (dateString: string): string => {
  const dateStr = dateString.split("T")[0]
  const [year, month, day] = dateStr.split("-")
  return `${month}/${day}/${year}`
}

export default function AuthorPage({ authorName, posts }: AuthorPageProps) {
  const baseUrl = "https://vierradev.com"
  const pageUrl = `${baseUrl}/blog/author/${encodeURIComponent(authorName)}`
  return (
    <>
      <Head>
        <title>{`Vierra | Posts by ${authorName}`}</title>
        <meta
          name="description"
          content={`Browse Vierra blog posts written by ${authorName}.`}
        />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={`Vierra | Posts by ${authorName}`} />
        <meta property="og:description" content={`Browse Vierra blog posts written by ${authorName}.`} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Vierra | Posts by ${authorName}`} />
        <meta name="twitter:description" content={`Browse Vierra blog posts written by ${authorName}.`} />
        <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />
      </Head>
      <Script
        id="schema-org-breadcrumbs-author"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
              { "@type": "ListItem", position: 2, name: "Blog", item: `${baseUrl}/blog` },
              { "@type": "ListItem", position: 3, name: `Author: ${authorName}`, item: pageUrl },
            ],
          }),
        }}
      />
      <Script
        id="schema-org-author-collection"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Author: ${authorName}`,
            url: pageUrl,
            author: { "@type": "Person", name: authorName },
            hasPart: posts.map((p) => ({
              "@type": "BlogPosting",
              headline: p.title,
              url: `${baseUrl}/blog/${p.slug}`,
              datePublished: p.publishedDate,
              author: { "@type": "Person", name: authorName },
            })),
          }),
        }}
      />
      <div className="min-h-screen bg-[#18042A] text-white">
        <Header />
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h1 className={`text-4xl md:text-5xl font-bold ${bricolage.className}`}>Author: {authorName}</h1>
          <p className={`text-[#9BAFC3] mt-3 ${inter.className}`}>
            {posts.length} post{posts.length === 1 ? "" : "s"} by {authorName}.
          </p>
        </div>
        <div className="bg-white text-[#111014]">
          <div className="max-w-6xl mx-auto px-6 py-12">
            {posts.length === 0 ? (
              <div className="text-center text-sm text-[#6B7280]">No posts found.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {posts.map((post) => (
                  <Link key={post.slug} href={`/blog/${post.slug}`} className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className={`text-lg font-semibold text-[#111827] ${bricolage.className}`}>{post.title}</div>
                    <div className="mt-2 text-xs text-[#6B7280] flex items-center gap-2">
                      <span>{formatDate(post.publishedDate)}</span>
                    </div>
                    {post.description && (
                      <p className={`mt-3 text-sm text-[#475569] ${inter.className}`}>{post.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const authors = await prisma.author.findMany({ select: { name: true } })
  const paths = authors.map((a) => ({ params: { name: a.name } }))
  return { paths, fallback: "blocking" }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const authorName = params?.name as string
  const posts = await prisma.blogPost.findMany({
    where: { author: { name: authorName } },
    include: { author: true },
    orderBy: { published_date: "desc" },
    take: 50,
  })
  return {
    props: {
      authorName,
      posts: posts.map(p => ({
        title: p.title,
        slug: p.slug,
        publishedDate: p.published_date.toISOString(),
        description: (p as any).description ?? null,
      })),
    },
    revalidate: 60,
  }
}

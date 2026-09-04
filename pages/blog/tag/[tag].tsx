import { GetStaticPaths, GetStaticProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { getPostsByTag, getAllTags } from "@/lib/blog"
import { jsonLd } from "@/lib/jsonLd";
import BlogListingLayout from "@/components/Blog/BlogListingLayout"


type TagPageProps = {
  tag: string
  posts: {
    title: string
    slug: string
    publishedDate: string
    author: { name: string }
    description?: string | null
    tag?: string | null
  }[]
}

export default function TagPage({ tag, posts }: TagPageProps) {
  const baseUrl = "https://vierradev.com"
  const pageUrl = `${baseUrl}/blog/tag/${encodeURIComponent(tag)}`
  return (
    <>
      <Head>
        <title>{`Vierra | ${tag} Blog Posts`}</title>
        <meta
          name="description"
          content={`Browse Vierra blog posts tagged with ${tag}.`}
        />
        {/* Thin, near-duplicate listing pages — keep out of the index but let
            link equity flow to the posts they list. */}
        <meta name="robots" content="noindex, follow" />
        <meta name="author" content="Vierra Digital" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={`Vierra | ${tag} Blog Posts`} />
        <meta property="og:description" content={`Browse Vierra blog posts tagged with ${tag}.`} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Vierra Digital" />
        <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Vierra | ${tag} Blog Posts`} />
        <meta name="twitter:description" content={`Browse Vierra blog posts tagged with ${tag}.`} />
        <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />
      </Head>
      <script
        id="schema-org-breadcrumbs-tag"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
              { "@type": "ListItem", position: 2, name: "Blog", item: `${baseUrl}/blog` },
              { "@type": "ListItem", position: 3, name: `Tag: ${tag}`, item: pageUrl },
            ],
          }),
        }}
      />
      <script
        id="schema-org-tag-collection"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Tag: ${tag}`,
            url: pageUrl,
            publisher: { "@id": "https://vierradev.com/#organization" },
            hasPart: posts.map((p) => ({
              "@type": "BlogPosting",
              headline: p.title,
              url: `${baseUrl}/blog/${p.slug}`,
              datePublished: p.publishedDate,
              dateModified: p.publishedDate,
              author: {
                "@type": "Person",
                name: p.author.name,
                url: `${baseUrl}/blog/author/${encodeURIComponent(p.author.name)}`,
              },
              publisher: { "@id": "https://vierradev.com/#organization" },
            })),
          }),
        }}
      />
      <BlogListingLayout
        eyebrow="Tag"
        title={tag}
        countLabel={<>{posts.length} post{posts.length === 1 ? "" : "s"} tagged with {tag}</>}
        mainClassName={"bg-[#F3F3F3]"}
        posts={posts}
        renderByline={(post) => {
          const name = (post as TagPageProps["posts"][number]).author?.name
          return name ? (
            <Link href={`/blog/author/${encodeURIComponent(name)}`} className="relative z-20 font-semibold text-[#18042A] hover:text-[#701CC0]">{name}</Link>
          ) : (
            <span className="font-semibold text-[#18042A]">Vierra</span>
          )
        }}
      />
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  try {
    const tags = await getAllTags()
    const paths = tags.map((t) => ({ params: { tag: t } }))
    return { paths, fallback: "blocking" }
  } catch {
    return { paths: [], fallback: "blocking" }
  }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const tag = params?.tag as string

  if (!tag || /[\[\]{}]/.test(tag)) {
    return { notFound: true }
  }

  try {
    const posts = await getPostsByTag(tag, 50)

    if (posts.length === 0) {
      // Revalidate the 404 so a tag that gains its first post between deploys
      // (e.g. a newly published "Case Studies" post) stops 404ing on its own
      // within the window, instead of the negative result sticking until the
      // next build.
      return { notFound: true, revalidate: 600 }
    }

    return {
      props: {
        tag,
        posts: posts.map(p => ({
          title: p.title,
          slug: p.slug,
          publishedDate: p.published_date,
          author: { name: p.author.name },
          description: p.description,
          tag: p.tag ?? null,
        }))
      },
      revalidate: 600,
    }
  } catch (error) {
    // Transient DB failure — rethrow (non-cached 500 + retry) instead of caching a 404.
    console.error("blog/tag/[tag] getStaticProps DB error (retryable, not cached):", error)
    throw error
  }
}

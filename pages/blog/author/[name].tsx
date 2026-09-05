import { GetStaticPaths, GetStaticProps } from "next"
import Head from "next/head"
import { inter } from "@/lib/fonts";
import { getPostsByAuthor, getAllAuthorNames } from "@/lib/blog"
import { authorSameAs, getAuthorProfile } from "@/lib/authorProfiles"
import Image from "next/image"
import { jsonLd } from "@/lib/jsonLd";
import BlogListingLayout from "@/components/Blog/BlogListingLayout"


type AuthorPageProps = {
  authorName: string
  posts: {
    title: string
    slug: string
    publishedDate: string
    description?: string | null
    tag?: string | null
  }[]
}

export default function AuthorPage({ authorName, posts }: AuthorPageProps) {
  const baseUrl = "https://vierradev.com"
  const pageUrl = `${baseUrl}/blog/author/${encodeURIComponent(authorName)}`
  const profile = getAuthorProfile(authorName)
  const authorImageUrl = profile.image ? `${baseUrl}${profile.image}` : undefined
  const linkedIn = profile.sameAs?.find((u) => u.includes("linkedin.com"))
  return (
    <>
      <Head>
        <title>{`Vierra | Posts by ${authorName}`}</title>
        <meta
          name="description"
          content={`Browse Vierra blog posts written by ${authorName}.`}
        />
        <meta name="author" content={authorName} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={`Vierra | Posts by ${authorName}`} />
        <meta property="og:description" content={`Browse Vierra blog posts written by ${authorName}.`} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Vierra Digital" />
        <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Vierra | Posts by ${authorName}`} />
        <meta name="twitter:description" content={`Browse Vierra blog posts written by ${authorName}.`} />
        <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />
      </Head>
      <script
        id="schema-org-breadcrumbs-author"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
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
      <script
        id="schema-org-author-collection"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            name: `Author: ${authorName}`,
            url: pageUrl,
            mainEntity: {
              "@type": "Person",
              name: authorName,
              url: pageUrl,
              jobTitle: profile.jobTitle,
              description: profile.bio,
              image: authorImageUrl,
              sameAs: authorSameAs(authorName),
              worksFor: profile.company
                ? { "@type": "Organization", name: profile.company }
                : { "@id": "https://vierradev.com/#organization" },
            },
            publisher: { "@id": "https://vierradev.com/#organization" },
            hasPart: posts.map((p) => ({
              "@type": "BlogPosting",
              headline: p.title,
              url: `${baseUrl}/blog/${p.slug}`,
              datePublished: p.publishedDate,
              dateModified: p.publishedDate,
              author: {
                "@type": "Person",
                name: authorName,
                url: pageUrl,
              },
              publisher: { "@id": "https://vierradev.com/#organization" },
            })),
          }),
        }}
      />
      <BlogListingLayout
        eyebrow="Author"
        title={authorName}
        countLabel={<>{posts.length} Post{posts.length === 1 ? "" : "s"} By {authorName}</>}
        gridBandClassName={"bg-[#F3F3F3]"}
        posts={posts}
        renderByline={() => <span className="font-semibold text-[#18042A]">{authorName}</span>}
      >
        {profile.bio && (
          <div className="bg-[#F3F3F3]">
            <div className="mx-auto max-w-4xl px-6 pt-14">
              <div className="flex flex-col items-center gap-5 rounded-2xl border border-[#ECE6F5] bg-white p-6 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center sm:text-left md:p-8">
                {profile.image ? (
                  <Image
                    src={profile.image}
                    alt={`${authorName}, ${profile.jobTitle ?? "author"} at Vierra Digital`}
                    width={80}
                    height={80}
                    draggable={false}
                    className="h-20 w-20 flex-shrink-0 select-none rounded-full object-cover ring-2 ring-[#8F42FF]/40 ring-offset-2 ring-offset-white [-webkit-user-drag:none]"
                  />
                ) : (
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-[#701CC0] text-2xl font-bold text-white ring-2 ring-[#8F42FF]/40 ring-offset-2 ring-offset-white">
                    {authorName.charAt(0)}
                  </div>
                )}
                <div className={inter.className}>
                  {profile.jobTitle && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#701CC0]">
                      {profile.jobTitle}, {profile.company ?? "Vierra Digital"}
                    </p>
                  )}
                  <p className="mt-2 text-[15px] leading-relaxed text-[#4B4460]">{profile.bio}</p>
                  {linkedIn && (
                    <a
                      href={linkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#701CC0] transition-colors hover:text-[#8F42FF]"
                    >
                      Connect On LinkedIn
                      <span aria-hidden className="animate-arrow-nudge">
                        →
                      </span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </BlogListingLayout>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  try {
    const names = await getAllAuthorNames()
    const paths = names.map((name) => ({ params: { name } }))
    return { paths, fallback: "blocking" }
  } catch {
    return { paths: [], fallback: "blocking" }
  }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const authorName = params?.name as string

  if (!authorName || /[\[\]{}]/.test(authorName)) {
    return { notFound: true }
  }

  try {
    const posts = await getPostsByAuthor(authorName, 50)

    if (posts.length === 0) {
      return { notFound: true }
    }

    return {
      props: {
        authorName,
        posts: posts.map(p => ({
          title: p.title,
          slug: p.slug,
          publishedDate: p.published_date,
          description: p.description,
          tag: p.tag ?? null,
        })),
      },
      revalidate: 600,
    }
  } catch (error) {
    // Transient DB failure — rethrow (non-cached 500 + retry) instead of caching a 404.
    console.error("blog/author/[name] getStaticProps DB error (retryable, not cached):", error)
    throw error
  }
}

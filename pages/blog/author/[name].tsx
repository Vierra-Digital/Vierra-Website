import { GetStaticPaths, GetStaticProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import { getPostsByAuthor, getAllAuthorNames } from "@/lib/blog"
import { Header } from "@/components/Header"
import Footer from "@/components/FooterSection/Footer"
import { authorSameAs, getAuthorProfile } from "@/lib/authorProfiles"
import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import Image from "next/image"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

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

const formatDate = (dateString: string): string => {
  const dateStr = dateString.split("T")[0]
  const [year, month, day] = dateStr.split("-")
  return `${month}/${day}/${year}`
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
      <script
        id="schema-org-author-collection"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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
      <div className="min-h-screen bg-[#18042A] text-white">
        {/* Hide the main page scrollbar (scrolling still works) */}
        <style jsx global>{`
          html { scroll-behavior: smooth; scrollbar-width: none !important; -ms-overflow-style: none !important; }
          html::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
        `}</style>
        {/* Hero — themed like the legal pages */}
        <div className="relative flex min-h-[60vh] flex-col overflow-hidden bg-[#18042A] text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <motion.div
              className="absolute -top-28 left-[6%] h-[440px] w-[440px] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] opacity-70 blur-[70px]"
              animate={{ x: [0, 70, -30, 0], y: [0, 40, 80, 0], scale: [1, 1.12, 0.94, 1] }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -bottom-44 right-[2%] h-[480px] w-[480px] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] opacity-60 blur-[80px]"
              animate={{ x: [0, -60, 25, 0], y: [0, -35, -70, 0], scale: [1, 0.93, 1.12, 1] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <div className="relative z-20">
            <Header />
          </div>
          <header className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]">Author</span>
            <h1 className={`mt-4 text-5xl font-bold tracking-tight text-white md:text-7xl ${bricolage.className}`}>
              {authorName}
            </h1>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8F42FF]" />
              {posts.length} Post{posts.length === 1 ? "" : "s"} By {authorName}
            </div>
          </header>
        </div>

        {/* Author bio — below the header, on the light band above the posts grid */}
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

        {/* Posts */}
        <div className="bg-[#F3F3F3]">
          <div className="max-w-6xl mx-auto px-6 py-16">
            {posts.length === 0 ? (
              <div className="text-center text-sm text-[#6B7280]">No posts found.</div>
            ) : (
              <div className="columns-1 gap-6 md:columns-2 lg:columns-3 [column-fill:balance]">
                {posts.map((post) => (
                  <article
                    key={post.slug}
                    className="group relative mb-6 flex break-inside-avoid flex-col rounded-2xl border border-[#ECE6F5] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#701CC0]/30 hover:shadow-[0_16px_40px_-16px_rgba(112,28,192,0.35)]"
                  >
                    <Link href={`/blog/${post.slug}`} aria-label={post.title} className="absolute inset-0 z-10 rounded-2xl" />
                    {post.tag && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {post.tag.split(',').slice(0, 3).map((t, index) => (
                          <Link key={index} href={`/blog/tag/${encodeURIComponent(t.trim())}`} className={`relative z-20 rounded-full bg-[#F4EEFC] px-3 py-1 text-[11px] font-semibold text-[#701CC0] transition-colors hover:bg-[#701CC0] hover:text-white ${inter.className}`}>
                            {t.trim()}
                          </Link>
                        ))}
                      </div>
                    )}
                    <h3 className={`text-xl font-bold leading-snug tracking-tight text-[#18042A] transition-colors group-hover:text-[#701CC0] ${bricolage.className}`}>{post.title}</h3>
                    <p className={`mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[#9A93AE] ${inter.className}`}>
                      <span className="font-semibold text-[#18042A]">{authorName}</span>
                      <span className="inline-block h-1 w-1 rounded-full bg-[#9A93AE]" />
                      <span>{formatDate(post.publishedDate)}</span>
                    </p>
                    {post.description && (
                      <p className={`mt-3 text-sm leading-relaxed text-[#64607D] ${inter.className}`}>{post.description}</p>
                    )}
                    <div className="mt-6 flex items-center justify-end border-t border-[#F1EDF8] pt-4">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#F4EEFC] text-[#701CC0] transition-all duration-300 group-hover:bg-[#701CC0] group-hover:text-white">
                        <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </article>
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
      revalidate: 60,
    }
  } catch (error) {
    // Transient DB failure — rethrow (non-cached 500 + retry) instead of caching a 404.
    console.error("blog/author/[name] getStaticProps DB error (retryable, not cached):", error)
    throw error
  }
}

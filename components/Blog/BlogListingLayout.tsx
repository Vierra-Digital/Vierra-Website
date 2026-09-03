import Link from "next/link"
import { bricolage, inter } from "@/lib/fonts"
import { Header } from "@/components/Header"
import Footer from "@/components/FooterSection/Footer"
import { m as motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

/**
 * Shared chrome for the two blog listing pages, /blog/author/[name] and /blog/tag/[tag].
 *
 * They were ~33 duplicated blocks apart: the same scrollbar-hiding global style, the same animated
 * hero, the same masonry grid, and the same post card down to the hover shadow. Only three things
 * genuinely differ — the eyebrow above the title, the count line under it, and the byline inside
 * each card (the author page states a name it already knows; the tag page links to whoever wrote
 * the post). Those are props; everything else lives here once.
 *
 * The pages keep their own <Head>, JSON-LD and data fetching, because those are not the same
 * between them and pretending otherwise is how a shared component turns into a pile of flags.
 */

export type ListingPost = {
  title: string
  slug: string
  publishedDate: string
  description?: string | null
  tag?: string | null
}

/** M/D/YYYY from an ISO date, without pulling the date through a Date object and a timezone. */
export function formatListingDate(dateString: string): string {
  const dateStr = dateString.split("T")[0]
  const [year, month, day] = dateStr.split("-")
  return `${month}/${day}/${year}`
}

type Props = {
  /** Small uppercase label above the title, e.g. "Author" or "Tag". */
  eyebrow: string
  title: string
  /** The pill under the title — a whole node, since the two pages word it differently. */
  countLabel: ReactNode
  posts: ListingPost[]
  /** Byline inside each card. The two pages render this differently; see the note above. */
  renderByline: (post: ListingPost) => ReactNode
  /** Optional block between the hero and the grid (the author page puts its bio card here). */
  children?: ReactNode
  /**
   * The two pages paint the light band at different depths: the tag page put it on <main>, the
   * author page on a div inside it (so its bio card could sit on the same band above the grid).
   * Both are preserved exactly rather than normalised — this refactor is not allowed to move a
   * background one element up or down, and the preview pane here cannot measure layout to prove
   * such a change is invisible.
   */
  mainClassName?: string
  gridBandClassName?: string
}

/** Wraps children in a div only when a class is given; otherwise renders them at the same depth. */
function Band({ className, children }: { className?: string; children: ReactNode }) {
  return className ? <div className={className}>{children}</div> : <>{children}</>
}

export default function BlogListingLayout({
  eyebrow,
  title,
  countLabel,
  posts,
  renderByline,
  children,
  mainClassName,
  gridBandClassName,
}: Props) {
  return (
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]">{eyebrow}</span>
          <h1 className={`mt-4 text-5xl font-bold tracking-tight text-white md:text-7xl ${bricolage.className}`}>
            {title}
          </h1>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8F42FF]" />
            {countLabel}
          </div>
        </header>
      </div>

      <main className={mainClassName}>
        {children}

        {/* Posts */}
        <Band className={gridBandClassName}>
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
                      {renderByline(post)}
                      <span className="inline-block h-1 w-1 rounded-full bg-[#9A93AE]" />
                      <span>{formatListingDate(post.publishedDate)}</span>
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
        </Band>
      </main>
      <Footer />
    </div>
  )
}

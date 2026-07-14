import { useEffect, useRef, useState } from "react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Head from 'next/head';
import { getBlogCatalog } from "@/lib/blog"
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import { Search, ChevronRight } from "lucide-react";
import Footer from "@/components/FooterSection/Footer";
import { GetStaticProps } from "next";
import Link from "next/link";

type BlogPostType = {
    id: string;
    title: string;
    description?: string | null;
    content: string;
    published_date?: string | null;
    slug: string;
    tag?: string | null;
    author: {
        name: string;
    };
};

type Props = {
    latestPosts: BlogPostType[];
    hasFetchError?: boolean;
};

// ISR: the index is statically cached and regenerated at most every 60s (and
// on-demand when a post is created/edited/deleted — see the blog admin API).
// This serves /blog from the CDN instead of a per-request DB round-trip.
export const getStaticProps: GetStaticProps<Props> = async () => {
    try {
        const latestPosts = await getBlogCatalog(90);
        return {
            props: { latestPosts, hasFetchError: false },
            // 5-minute ISR window: posts rarely change minute-to-minute, and the
            // blog admin triggers on-demand revalidation on publish/edit/delete,
            // so this mainly cuts how often the (cold) regeneration runs.
            revalidate: 300,
        };
    } catch (error) {
        // Never cache an empty/errored index — rethrow so Next keeps serving the
        // last good static page and retries on the next revalidation.
        console.error('blog index getStaticProps DB error (retryable, not cached):', error);
        throw error;
    }
};

const formatDate = (dateString?: string | null): string => {
    if (!dateString) return "";
    const dateStr = dateString.split('T')[0];
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
};

const stripHtml = (html?: string | null): string => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

const getExcerpt = (content?: string | null, limit: number = 260): string => {
    const text = stripHtml(content);
    if (text.length <= limit) return text;
    return text.slice(0, limit).trimEnd() + '...';
};

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });
const inter = Inter({ subsets: ["latin"] });
const tags: string[] = ["All Blog Posts", "Case Studies", "Technology", "AI & Automation", "Finance", "Marketing", "Sales", "Management", "Leadership"]


const BlogPage = ({ latestPosts, hasFetchError = false }: Props) => {

    const [tagSelected, setTagSelected] = useState(0);
    const [tagSelectedName, setTagSelectedName] = useState("All Blog Posts");
    const [searchQuery, setSearchQuery] = useState("");
    // Seed from the server-fetched posts so the initial (SSR) render already
    // contains the post list. Initializing to [] left the server HTML showing
    // the empty "Stories In The Making" state until client-side JS re-filtered,
    // making every post invisible to non-JS / first-pass crawlers.
    const [filteredLatestPosts, setFilteredLatestPosts] = useState<BlogPostType[]>(latestPosts)
    const [loading, setLoading] = useState(false);
    // Start with every post rendered so all posts appear in the SSR HTML
    // (crawlable internal links — previously only the first 9 were, orphaning
    // older posts from the index). Infinite scroll still paginates on
    // filter/search. getBlogCatalog caps the catalog at 90, so this is bounded.
    const [visibleCount, setVisibleCount] = useState(latestPosts.length || 9);
    // Hydrate the search box from the URL (?search=) so the WebSite SearchAction
    // structured-data target (/blog?search={term}) actually applies the query.
    useEffect(() => {
        const q = new URLSearchParams(window.location.search).get("search");
        if (q) setSearchQuery(q);
    }, []);
    const batchSize = 9;
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const filterInitialized = useRef(false);

    const filterPostsByTag = (tagName: string, posts: BlogPostType[]) => {
        if (tagName === "All Blog Posts") {
            return posts;
        }
        return posts.filter(post => post.tag && post.tag.split(',').map(t => t.trim()).includes(tagName));
    };

    const filterPostsByQuery = (query: string, posts: BlogPostType[]) => {
        const q = query.trim().toLowerCase();
        if (!q) return posts;
        return posts.filter((post) => {
            const title = post.title?.toLowerCase() || "";
            const content = stripHtml(post.content)?.toLowerCase() || "";
            const description = post.description?.toLowerCase() || "";
            const author = post.author?.name?.toLowerCase() || "";
            const tag = post.tag?.toLowerCase() || "";
            return title.includes(q) || description.includes(q) || content.includes(q) || author.includes(q) || tag.includes(q);
        });
    };

    const handleTagSwitch = async (index: number) => {
        const name = tags[index];
        setTagSelected(index);
        setTagSelectedName(name);
        setLoading(true);

        try {
            const byTag = filterPostsByTag(name, latestPosts);
            const bySearch = filterPostsByQuery(searchQuery, byTag);
            setFilteredLatestPosts(bySearch);
            setVisibleCount(batchSize);
        } catch (error) {
            console.error("Error filtering posts:", error);
            setFilteredLatestPosts([]);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        const byTag = filterPostsByTag(tagSelectedName, latestPosts);
        const bySearch = filterPostsByQuery(searchQuery, byTag);
        setFilteredLatestPosts(bySearch);
        // Keep the initial full render intact (all posts stay in the SSR HTML for
        // crawlers); only restart pagination when the user changes tag/search.
        if (filterInitialized.current) setVisibleCount(batchSize);
        else filterInitialized.current = true;
    }, [latestPosts, tagSelectedName, searchQuery]);

    const visiblePosts = filteredLatestPosts.slice(0, visibleCount);
    const hasMore = visibleCount < filteredLatestPosts.length;

    // Infinite scroll: reveal another batch when the sentinel scrolls into view
    useEffect(() => {
        if (!hasMore) return;
        const node = sentinelRef.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount((c) => c + batchSize);
                }
            },
            { rootMargin: "400px" }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, filteredLatestPosts.length]);

    const baseUrl = "https://vierradev.com";
    const canonicalUrl = `${baseUrl}/blog`;

    return (
        <>
            <Head>
                <title>Vierra | Blog</title>
                <meta name="description" content="Insights, case studies, and strategies from Vierra to scale revenue and acquire more clients. Learn about marketing, lead generation, business growth, and digital optimization." />
                <meta name="author" content="Vierra Digital" />
                <meta name="keywords" content="marketing blog, business growth strategies, lead generation tips, digital marketing insights, case studies, business scaling, marketing automation" />
                {hasFetchError && <meta name="robots" content="noindex, nofollow" />}
                <link rel="canonical" href={canonicalUrl} />
                <link rel="alternate" type="application/rss+xml" title="Vierra Blog RSS Feed" href="https://vierradev.com/blog/rss.xml" />
                <meta property="og:title" content="Vierra | Blog" />
                <meta property="og:description" content="Insights, case studies, and strategies from Vierra to scale revenue and acquire more clients." />
                <meta property="og:url" content={canonicalUrl} />
                <meta property="og:type" content="website" />
                <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Vierra | Blog" />
                <meta name="twitter:description" content="Insights, case studies, and strategies from Vierra to scale revenue and acquire more clients." />
                <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />
            </Head>
            <script
                id="schema-org-breadcrumbs"
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        itemListElement: [
                            {
                                "@type": "ListItem",
                                position: 1,
                                name: "Home",
                                item: "https://vierradev.com",
                            },
                            {
                                "@type": "ListItem",
                                position: 2,
                                name: "Blog",
                                item: "https://vierradev.com/blog",
                            },
                        ],
                    }),
                }}
            />
            <script
                id="schema-org-blog"
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Blog",
                        "@id": "https://vierradev.com/blog",
                        name: "Vierra Blog",
                        description: "Insights, case studies, and strategies from Vierra to scale revenue and acquire more clients.",
                        url: "https://vierradev.com/blog",
                        publisher: { "@id": "https://vierradev.com/#organization" },
                        blogPost: latestPosts.slice(0, 10).map(post => ({
                            "@type": "BlogPosting",
                            headline: post.title,
                            description: post.description || stripHtml(post.content).substring(0, 200),
                            url: `https://vierradev.com/blog/${post.slug}`,
                            datePublished: post.published_date,
                            dateModified: post.published_date,
                            author: {
                                "@type": "Person",
                                name: post.author.name,
                                url: `https://vierradev.com/blog/author/${encodeURIComponent(post.author.name)}`,
                            },
                            publisher: { "@id": "https://vierradev.com/#organization" },
                        })),
                    }),
                }}
            />
            <div className="bg-[#18042A] text-white relative overflow-hidden z-0">
                {/* Hide the main page scrollbar (scrolling still works) */}
                <style jsx global>{`
                    html { scroll-behavior: smooth; scrollbar-width: none !important; -ms-overflow-style: none !important; }
                    html::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
                `}</style>

                {/* Dark hero band — same format as the legal pages */}
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
                        <div className="relative flex flex-col items-center">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]">Insights</span>
                            <h1 className={`mt-4 text-5xl font-bold tracking-tight md:text-7xl ${bricolage.className}`}>
                                Blog &amp;{" "}
                                <span className="bg-gradient-to-r from-[#8F42FF] via-[#D4A5FF] to-[#8F42FF] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient">
                                    Case Studies
                                </span>
                            </h1>

                            {/* Square search bar anchored directly below the title (absolute, so the title placement is unchanged) */}
                            <div className="absolute left-1/2 top-full mt-8 w-[90vw] max-w-2xl -translate-x-1/2">
                                <div className="w-full h-12 md:h-14 rounded-lg bg-white border border-gray-200 flex items-center px-4 gap-3 shadow-sm focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                                    <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                    <input
                                        type="search"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search articles, topics, authors..."
                                        className={`w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-500 text-sm md:text-base ${inter.className}`}
                                        aria-label="Search blog posts"
                                    />
                                </div>
                            </div>
                        </div>
                    </header>
                </div>
                <div id="view-section" className="bg-[#F3F3F3] px-8 lg:px-20">
                    <div className="max-w-7xl mx-auto py-20">
                        {/* Categories */}
                        <div className="mb-10 flex flex-wrap gap-2.5">
                            {tags.map((tag, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleTagSwitch(index)}
                                    disabled={loading}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${inter.className} ${
                                        index === tagSelected
                                            ? "bg-[#701CC0] text-white shadow-[0px_4px_14px_0px_#701CC04D]"
                                            : "bg-white text-[#475569] border border-[#E2E8F0] hover:border-[#701CC0]/40 hover:text-[#701CC0]"
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                        {loading && (
                            <div className="mb-8 text-center">
                                <p className={`text-[#475569] ${inter.className}`}>Loading posts...</p>
                            </div>
                        )}
                        {filteredLatestPosts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
                                {/* Elegant search motif — soft sonar rings around a floating gem */}
                                <div className="relative mb-10 flex h-36 w-36 items-center justify-center">
                                    {[0, 1, 2].map((i) => (
                                        <motion.span
                                            key={i}
                                            className="absolute inset-0 rounded-full border border-[#701CC0]/25"
                                            animate={{ scale: [0.7, 1.7], opacity: [0.55, 0] }}
                                            transition={{ duration: 3.6, repeat: Infinity, delay: i * 1.2, ease: "easeOut" }}
                                        />
                                    ))}
                                    <motion.div
                                        className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#18042A] to-[#3A1466] shadow-[0_12px_40px_-8px_rgba(112,28,192,0.6)] ring-1 ring-[#701CC0]/40"
                                        animate={{ y: [0, -7, 0] }}
                                        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        <Search className="h-8 w-8 text-[#D4A5FF]" />
                                    </motion.div>
                                </div>

                                <span className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#A98FD1]">
                                    {searchQuery || tagSelectedName !== "All Blog Posts" ? "No Results" : "Coming Soon"}
                                </span>
                                <h2 className={`text-3xl font-bold tracking-tight text-[#18042A] md:text-4xl ${bricolage.className}`}>
                                    {searchQuery || tagSelectedName !== "All Blog Posts" ? "No Matches Found" : "Stories In The Making"}
                                </h2>
                                {(searchQuery || tagSelectedName !== "All Blog Posts") && (
                                    <button
                                        onClick={() => {
                                            setSearchQuery("");
                                            setTagSelected(0);
                                            setTagSelectedName("All Blog Posts");
                                        }}
                                        className={`mt-10 inline-flex items-center gap-2 rounded-lg border-2 border-[#701CC0] bg-transparent px-6 py-2.5 text-[13px] font-semibold text-[#701CC0] transition-all duration-300 hover:bg-[#701CC0] hover:text-white hover:shadow-[0_12px_30px_-10px_rgba(112,28,192,0.55)] ${inter.className}`}
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="columns-1 gap-6 md:columns-2 lg:columns-3 [column-fill:balance]">
                                    {visiblePosts.map((blog) => (
                                        <article
                                            key={blog.id}
                                            className="group relative mb-6 flex break-inside-avoid flex-col rounded-2xl border border-[#ECE6F5] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#701CC0]/30 hover:shadow-[0_16px_40px_-16px_rgba(112,28,192,0.35)]"
                                        >
                                            {/* Stretched link makes the whole card clickable without nesting anchors */}
                                            <Link href={`/blog/${blog.slug}`} aria-label={blog.title} className="absolute inset-0 z-10 rounded-2xl" />

                                            <div className="mb-4 flex flex-wrap gap-2">
                                                {blog.tag ? blog.tag.split(',').slice(0, 3).map((tag, index) => (
                                                    <Link
                                                        key={index}
                                                        href={`/blog/tag/${encodeURIComponent(tag.trim())}`}
                                                        className={`relative z-20 rounded-full bg-[#F4EEFC] px-3 py-1 text-[11px] font-semibold text-[#701CC0] transition-colors hover:bg-[#701CC0] hover:text-white ${inter.className}`}
                                                    >
                                                        {tag.trim()}
                                                    </Link>
                                                )) : (
                                                    <span className={`relative z-20 rounded-full bg-[#F4EEFC] px-3 py-1 text-[11px] font-semibold text-[#701CC0] ${inter.className}`}>Blog</span>
                                                )}
                                            </div>

                                            <h3 className={`text-xl font-bold leading-snug tracking-tight text-[#18042A] transition-colors group-hover:text-[#701CC0] ${bricolage.className}`}>
                                                {blog.title}
                                            </h3>

                                            <p className={`mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[#9A93AE] ${inter.className}`}>
                                                {blog.author?.name ? (
                                                    <Link href={`/blog/author/${encodeURIComponent(blog.author.name)}`} className="relative z-20 font-semibold text-[#18042A] hover:text-[#701CC0]">
                                                        {blog.author.name}
                                                    </Link>
                                                ) : (
                                                    <span className="font-semibold text-[#18042A]">Vierra</span>
                                                )}
                                                {blog.published_date && (
                                                    <>
                                                        <span className="inline-block h-1 w-1 rounded-full bg-[#9A93AE]" />
                                                        <span>{formatDate(blog.published_date)}</span>
                                                    </>
                                                )}
                                            </p>

                                            <p className={`mt-3 text-sm leading-relaxed text-[#64607D] ${inter.className}`}>
                                                {blog.description || getExcerpt(blog.content)}
                                            </p>

                                            <div className="mt-6 flex items-center justify-end border-t border-[#F1EDF8] pt-4">
                                                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#F4EEFC] text-[#701CC0] transition-all duration-300 group-hover:bg-[#701CC0] group-hover:text-white">
                                                    <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                                                </span>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                                {hasMore && (
                                    <div ref={sentinelRef} className="flex justify-center py-12">
                                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#701CC0]/25 border-t-[#701CC0]" />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </>
    )
}
export default BlogPage;
import { useEffect, useRef, useState } from "react";
import { bricolage, inter } from "@/lib/fonts";
import Head from 'next/head';
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import Footer from "@/components/FooterSection/Footer";
import SocialShareBar from "@/components/Blog/SocialShareBar";
import AuthorBio from "@/components/Blog/AuthorBio";
import { authorSameAs, getAuthorProfile } from "@/lib/authorProfiles";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getPostBySlug, getRelatedPosts, getAllSlugs } from '@/lib/blog';
import { GetStaticPaths, GetStaticProps } from 'next';

type BlogPostProps = {
    title: string;
    description?: string | null;
    content: string;
    author: { name: string };
    publishedDate: string;
    updatedDate?: string | null;
    tag?: string | null;
    slug: string;
    relatedPosts: { title: string; slug: string; publishedDate: string; author: { name: string }; tag?: string | null; description?: string | null }[];
};


const formatDate = (dateString: string): string => {
    const dateStr = dateString.split('T')[0];
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
};

const BlogViewPage = ({
    title,
    description,
    content,
    author,
    publishedDate,
    updatedDate,
    tag,
    slug,
    relatedPosts
}: BlogPostProps) => {

    const blogUrl = `https://vierradev.com/blog/${slug}`;
    const authorPageUrl = `https://vierradev.com/blog/author/${encodeURIComponent(author.name)}`;
    const publishedDateISO = new Date(publishedDate).toISOString();
    const modifiedDateISO = new Date(updatedDate ?? publishedDate).toISOString();
    const authorProfile = getAuthorProfile(author.name);
    const authorImageUrl = authorProfile.image ? `https://vierradev.com${authorProfile.image}` : undefined;
    // Per-post social/AI card generated on the fly from the title (app/api/og),
    // so every post has a unique OG image instead of the shared meta-banner.
    const ogImage = `https://vierradev.com/api/og?title=${encodeURIComponent(title)}${tag ? `&tag=${encodeURIComponent(tag.split(',')[0].trim())}` : ''}`;

    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const onScroll = () => {
            const doc = document.documentElement;
            const scrollable = doc.scrollHeight - doc.clientHeight;
            setProgress(scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Record a view once per page load (the ref guards against React's
    // double-invoke in dev). Fire-and-forget — never block or surface errors.
    const viewCounted = useRef(false);
    useEffect(() => {
        if (viewCounted.current) return;
        viewCounted.current = true;
        fetch("/api/blog/view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug }),
            keepalive: true,
        }).catch(() => {});
    }, [slug]);

    return (
        <>
            <Head>
                <title>{`Vierra | ${title}`}</title>
                <meta name="description" content={description || `${title} - Insights and strategies from Vierra to scale revenue and acquire more clients.`} />
                <meta name="author" content={author.name} />
                <meta name="keywords" content={tag ? tag.split(',').map(t => t.trim()).join(', ') : 'marketing, lead generation, business growth, digital marketing'} />
                <link rel="canonical" href={blogUrl} />
                <link rel="alternate" type="application/rss+xml" title="Vierra Blog RSS Feed" href="https://vierradev.com/blog/rss.xml" />


                <meta property="og:type" content="article" />
                <meta property="og:title" content={title} />
                <meta property="og:description" content={description || `${title} - Insights and strategies from Vierra.`} />
                <meta property="og:url" content={blogUrl} />
                <meta property="og:site_name" content="Vierra" />
                <meta property="og:image" content={ogImage} />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="article:published_time" content={publishedDateISO} />
                <meta property="article:modified_time" content={modifiedDateISO} />
                <meta property="article:author" content={author.name} />
                {tag && tag.split(',').map((t, index) => (
                    <meta key={index} property="article:tag" content={t.trim()} />
                ))}
                
                
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={title} />
                <meta name="twitter:description" content={description || `${title} - Insights and strategies from Vierra.`} />
                <meta name="twitter:creator" content="@vierradev" />
                <meta name="twitter:image" content={ogImage} />
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
                            {
                                "@type": "ListItem",
                                position: 3,
                                name: title,
                                item: blogUrl,
                            },
                        ],
                    }),
                }}
            />
            <script
                id="schema-org-article"
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BlogPosting",
                        headline: title,
                        description: description || `${title} - Insights and strategies from Vierra.`,
                        image: [ogImage],
                        datePublished: publishedDateISO,
                        dateModified: modifiedDateISO,
                        author: {
                            "@type": "Person",
                            name: author.name,
                            url: authorPageUrl,
                            jobTitle: authorProfile.jobTitle,
                            description: authorProfile.bio,
                            image: authorImageUrl,
                            sameAs: authorSameAs(author.name),
                            worksFor: authorProfile.company
                                ? { "@type": "Organization", name: authorProfile.company }
                                : { "@id": "https://vierradev.com/#organization" },
                        },
                        publisher: { "@id": "https://vierradev.com/#organization" },
                        mainEntityOfPage: {
                            "@type": "WebPage",
                            "@id": blogUrl,
                        },
                        isPartOf: {
                            "@type": "Blog",
                            "@id": "https://vierradev.com/blog",
                            name: "Vierra Blog",
                        },
                        keywords: tag || "marketing, lead generation, business growth",
                        wordCount: (content || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length || undefined,
                        about: (tag || "B2B Lead Generation").split(",").map((t) => ({ "@type": "Thing", name: t.trim() })),
                    }),
                }}
            />
            {/* Reading progress bar */}
            <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent">
                <div
                    className="h-full bg-gradient-to-r from-[#701CC0] via-[#B366FF] to-[#8F42FF] transition-[width] duration-150 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="min-h-screen bg-[#18042A] text-white relative overflow-hidden z-0">
                {/* Hero band — blobs are confined here so they don't bleed into the body.
                    min-h-[60vh] keeps this band the same length as the blog listing,
                    tag, author and legal pages. */}
                <div className="relative flex min-h-[60vh] flex-col overflow-hidden">
                {/* Animated gradient blobs — same format as the rest of the site */}
                <div aria-hidden className="pointer-events-none absolute inset-0">
                    <motion.div
                        className="absolute -top-28 left-[6%] h-[440px] w-[440px] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] opacity-70 blur-[70px]"
                        animate={{ x: [0, 70, -30, 0], y: [0, 40, 80, 0], scale: [1, 1.12, 0.94, 1] }}
                        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                        className="absolute top-[18%] right-[2%] h-[480px] w-[480px] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] opacity-60 blur-[80px]"
                        animate={{ x: [0, -60, 25, 0], y: [0, -35, -70, 0], scale: [1, 0.93, 1.12, 1] }}
                        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                    />
                </div>

                <div className="relative z-20">
                    <Header />
                </div>

                <header className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-8 pb-16 pt-10 lg:px-20">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]">Article</span>
                    <h1 className={`mt-4 max-w-6xl text-4xl font-bold leading-tight tracking-tight text-[#EFF3FF] md:text-5xl lg:text-6xl ${bricolage.className}`}>
                        {title ? title : "Blog not found."}
                    </h1>
                    {description && (
                        <p className={`mt-5 line-clamp-3 max-w-3xl text-base text-white/70 md:text-lg ${inter.className}`}>{description}</p>
                    )}
                    <div id="metadata-row" className="mt-6 flex flex-wrap items-center gap-3 text-sm md:text-base">
                        <p className={`text-white/60 ${bricolage.className}`}>
                            By{" "}
                            <Link href={`/blog/author/${encodeURIComponent(author.name)}`} className="font-medium text-[#C99DFF] transition-colors hover:text-white">
                                {author.name}
                            </Link>
                        </p>
                        <div className="h-[4px] w-[4px] bg-white/30 rounded-full"></div>
                        <p className={`text-white/60 ${bricolage.className}`}>{formatDate(publishedDate)}</p>
                        {tag && (
                            <>
                                <div className="h-[4px] w-[4px] bg-white/30 rounded-full"></div>
                                <div className="flex flex-wrap gap-2">
                                    {tag.split(',').map((t, index) => (
                                        <Link key={index} href={`/blog/tag/${encodeURIComponent(t.trim())}`}>
                                            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs md:text-sm font-medium text-[#D4A5FF] backdrop-blur-md transition-colors hover:border-[#8F42FF]/50 hover:text-white">
                                                {t.trim()}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </header>
                </div>
                <div id="view-section" className="bg-white px-6 md:px-8 lg:px-20">
                    <div id="blog-text" className="flex flex-col pb-16 md:pb-20 items-center pt-12 md:pt-16 lg:pt-20">
                        <div id="blog-text-content" className="w-full max-w-3xl">
                            <div className={`text-[#1F2937] text-base md:text-lg leading-relaxed ${inter.className}`}>
                                <style jsx global>{`
                                  html { scroll-behavior: smooth; scrollbar-width: none !important; -ms-overflow-style: none !important; }
                                  html::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
                                  /* Normalize legacy <font> tags and inline fonts from pasted content */
                                  #blog-text-content font { font-family: inherit !important; font-size: inherit !important; }
                                  #blog-text-content [style*="font-family"] { font-family: inherit !important; }
                                  #blog-text-content [style*="font-size"] { font-size: inherit !important; }
                                  #blog-text-content a { color: #2563eb; text-decoration: underline; }
                                  #blog-text-content img { 
                                    display: block; 
                                    max-width: 100%; 
                                    height: auto; 
                                    border-radius: 8px;
                                    margin: 16px 0;
                                  }
                                  #blog-text-content div[style*="text-align: left"] img,
                                  #blog-text-content div[style*="text-align:left"] img { 
                                    margin-left: 0; 
                                    margin-right: auto; 
                                  }
                                  #blog-text-content div[style*="text-align: center"] img,
                                  #blog-text-content div[style*="text-align:center"] img { 
                                    margin-left: auto; 
                                    margin-right: auto; 
                                  }
                                  #blog-text-content div[style*="text-align: right"] img,
                                  #blog-text-content div[style*="text-align:right"] img { 
                                    margin-left: auto; 
                                    margin-right: 0; 
                                  }
                                  #blog-text-content iframe {
                                    display: block;
                                    max-width: 100%;
                                    margin: 16px 0;
                                    border-radius: 8px;
                                  }
                                  #blog-text-content video {
                                    display: block;
                                    max-width: 100%;
                                    margin: 16px 0;
                                    border-radius: 8px;
                                  }
                                  /* Block-level spacing — content is raw HTML with no inline
                                     margins, and Tailwind preflight zeroes them, so set them here. */
                                  #blog-text-content p { margin: 0 0 1.25rem; }
                                  #blog-text-content h2,
                                  #blog-text-content h3,
                                  #blog-text-content h4 {
                                    font-weight: 700;
                                    color: #111827;
                                    line-height: 1.25;
                                    scroll-margin-top: 90px;
                                  }
                                  #blog-text-content h2 { font-size: 1.6rem; margin: 2.5rem 0 1rem; }
                                  #blog-text-content h3 { font-size: 1.25rem; margin: 1.9rem 0 0.6rem; }
                                  #blog-text-content h4 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; }
                                  #blog-text-content > :first-child { margin-top: 0; }
                                  #blog-text-content ul,
                                  #blog-text-content ol { margin: 0 0 1.25rem; padding-left: 1.5rem; }
                                  #blog-text-content ul { list-style: disc; }
                                  #blog-text-content ol { list-style: decimal; }
                                  #blog-text-content li { margin: 0.4rem 0; padding-left: 0.25rem; }
                                  #blog-text-content strong { font-weight: 700; color: #111827; }
                                  #blog-text-content blockquote {
                                    margin: 1.5rem 0;
                                    padding: 0.5rem 1.25rem;
                                    border-left: 4px solid #8F42FF;
                                    background: #faf7ff;
                                    color: #4B4460;
                                    border-radius: 0 8px 8px 0;
                                  }
                                  /* Tables — branded, readable, horizontally scrollable on small screens */
                                  #blog-text-content table {
                                    width: 100%;
                                    margin: 1.9rem 0;
                                    border-collapse: collapse;
                                    font-size: 0.95rem;
                                    line-height: 1.45;
                                    display: block;
                                    overflow-x: auto;
                                    -webkit-overflow-scrolling: touch;
                                  }
                                  #blog-text-content thead th {
                                    background: #18042A;
                                    color: #fff;
                                    text-align: left;
                                    font-weight: 600;
                                  }
                                  #blog-text-content th,
                                  #blog-text-content td {
                                    border: 1px solid #E5E0EC;
                                    padding: 0.65rem 0.9rem;
                                    vertical-align: top;
                                  }
                                  #blog-text-content tbody tr:nth-child(even) { background: #faf8fd; }
                                  #blog-text-content table a { color: #2563eb; }
                                  @media (max-width: 640px) {
                                    #blog-text-content table { font-size: 0.85rem; }
                                    #blog-text-content th,
                                    #blog-text-content td { padding: 0.45rem 0.55rem; }
                                  }
                                `}</style>
                                <div dangerouslySetInnerHTML={{ __html: content }} />
                            </div>
                        </div>
                        {/* Author bio: sibling of #blog-text-content — same centered
                            column and padded container, so it's free of the prose
                            styles yet flows right under the article with no gap. */}
                        <div className="w-full max-w-3xl">
                            <AuthorBio name={author.name} />
                        </div>
                    </div>
                </div>
                <SocialShareBar
                    url={blogUrl}
                    title={title}
                    description={description || undefined}
                />
                {relatedPosts.length > 0 && (
                    <div className="bg-[#F3F3F3] px-6 md:px-8 lg:px-20">
                        <div className="max-w-5xl mx-auto py-16">
                            <h2 className={`text-2xl md:text-3xl font-semibold text-[#111827] mb-8 ${bricolage.className}`}>Related Posts</h2>
                            <div className="columns-1 gap-6 md:columns-2 lg:columns-3 [column-fill:balance]">
                                {relatedPosts.map((post) => (
                                    <Link
                                        key={post.slug}
                                        href={`/blog/${post.slug}`}
                                        className="group relative mb-6 flex break-inside-avoid flex-col rounded-2xl border border-[#ECE6F5] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#701CC0]/30 hover:shadow-[0_16px_40px_-16px_rgba(112,28,192,0.35)]"
                                    >
                                        {post.tag && (
                                            <div className="mb-4 flex flex-wrap gap-2">
                                                {post.tag.split(',').slice(0, 3).map((t, index) => (
                                                    <span key={index} className={`rounded-full bg-[#F4EEFC] px-3 py-1 text-[11px] font-semibold text-[#701CC0] ${inter.className}`}>
                                                        {t.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <h3 className={`text-xl font-bold leading-snug tracking-tight text-[#18042A] transition-colors group-hover:text-[#701CC0] ${bricolage.className}`}>
                                            {post.title}
                                        </h3>
                                        <p className={`mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[#9A93AE] ${inter.className}`}>
                                            <span className="font-semibold text-[#18042A]">{post.author?.name ?? "Vierra"}</span>
                                            <span className="inline-block h-1 w-1 rounded-full bg-[#9A93AE]" />
                                            <span>{formatDate(post.publishedDate)}</span>
                                        </p>
                                        <p className={`mt-3 text-sm leading-relaxed text-[#64607D] ${inter.className}`}>
                                            {post.description || ""}
                                        </p>
                                        <div className="mt-6 flex items-center justify-end border-t border-[#F1EDF8] pt-4">
                                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#F4EEFC] text-[#701CC0] transition-all duration-300 group-hover:bg-[#701CC0] group-hover:text-white">
                                                <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <Footer />
        </>
    )
}

export const getStaticPaths: GetStaticPaths = async () => {
    try {
    // Prerender only the most recent posts at build time; older and newly-added
    // posts are generated on-demand via fallback: 'blocking'. This keeps Netlify
    // build time bounded as the post count grows (each prerender is a remote
    // Supabase round-trip, serialized by connection_limit=1).
    const slugs = await getAllSlugs(25);
    const paths = slugs.map((slug) => ({ params: { slug } }));

    return { paths, fallback: 'blocking' };
    } catch (error) {
        console.warn('Database unavailable during static path generation, using fallback mode:', error);
        return { paths: [], fallback: 'blocking' };
    }
};

// Add native lazy-loading + async decoding to images inside CMS post bodies.
// The first image is left eager (it may be the post's LCP element); every later
// image defers until near the viewport, cutting bandwidth and CLS on long posts.
// Images that already declare `loading` are left untouched.
function addLazyImages(html: string): string {
    if (!html) return html;
    let seen = 0;
    return html.replace(/<img\b[^>]*>/gi, (tag) => {
        seen += 1;
        if (seen === 1) return tag;
        if (/\bloading\s*=/i.test(tag)) return tag;
        return tag.replace(/<img\b/i, '<img loading="lazy" decoding="async"');
    });
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
    const slug = params?.slug as string;

    if (!slug || /[\[\]{}]/.test(slug)) {
        return { notFound: true };
    }

    try {
    const post = await getPostBySlug(slug);

    if (!post) {
        return { notFound: true };
    }

    const relatedPosts = await getRelatedPosts(
        { slug: post.slug, tag: post.tag, authorName: post.author.name },
        3
    );

    return {
        props: {
            title: post.title,
            description: post.description,
            content: addLazyImages(post.content),
            author: { name: post.author.name },
            publishedDate: post.published_date,
            updatedDate: post.updated_date,
            tag: post.tag,
            slug: post.slug,
            relatedPosts: relatedPosts.map(p => ({
                title: p.title,
                slug: p.slug,
                publishedDate: p.published_date,
                author: { name: p.author.name },
                tag: p.tag ?? null,
                description: p.description,
            }))
        },
        // 5-minute ISR window (on-demand revalidation still fires on publish/edit).
        revalidate: 300,
    };
    } catch (error) {
        // Transient DB failure (e.g. Supabase pooler saturation during a GSC crawl
        // burst). Rethrow so Next returns a non-cached 500 and retries on the next
        // request — NEVER cache a 404 for a post that actually exists.
        console.error('blog/[slug] getStaticProps DB error (retryable, not cached):', error);
        throw error;
    }
};

export default BlogViewPage;
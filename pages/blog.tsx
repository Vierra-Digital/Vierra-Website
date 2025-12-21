import React, { useEffect, useState } from "react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Head from 'next/head';
import Script from 'next/script';
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import Footer from "@/components/FooterSection/Footer";
import { GetStaticProps } from "next";
import Link from "next/link";
// removed search modal usage for inline search

type BlogPostType = {
    id: number;
    author_id?: number | null;
    title: string;
    description?: string | null;
    content: string;
    image_url?: string | null;
    published_date?: string | null;
    slug: string;
    visits?: number | null;
    tag?: string | null;
    author: {
        name: string;
    };
};

type Props = {
    latestPosts: BlogPostType[];
    trendingPosts: BlogPostType[];
};

export const getStaticProps: GetStaticProps<Props> = async () => {
    const [latestPosts, trendingPosts] = await Promise.all([
        prisma.blogPost.findMany({
            orderBy: { published_date: "desc" },
            take: 10,
            include: { author: { select: { name: true } } },
        }),
        prisma.blogPost.findMany({
            orderBy: { visits: "desc" },
            take: 10,
            include: { author: { select: { name: true } } },
        }),
    ]);

    return {
        props: {
            latestPosts: latestPosts.map(post => ({
                ...post,
                published_date: post.published_date.toISOString(),
                author: { name: post.author.name },
            })),
            trendingPosts: trendingPosts.map(post => ({
                ...post,
                published_date: post.published_date.toISOString(),
                author: { name: post.author.name },
            })),
        },
        revalidate: 60,
    };
};

declare global {
    interface Window {
        particlesJS: {
            load: (tagId: string, path: string, callback?: () => void) => void;
        };
        pJSDom?: { pJS: Record<string, unknown> }[];
    }
}

const formatDate = (dateString?: string | null): string => {
    if (!dateString) return "";
    // Parse date string directly to avoid timezone issues
    const dateStr = dateString.split('T')[0]; // Get YYYY-MM-DD part
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


const BlogPage = ({ latestPosts }: Props) => {

    const [tagSelected, setTagSelected] = useState(0);
    const [tagSelectedName, setTagSelectedName] = useState("All Blog Posts");
    const [searchQuery, setSearchQuery] = useState("");
    const [filteredLatestPosts, setFilteredLatestPosts] = useState<BlogPostType[]>([])
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 6;

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
            setCurrentPage(1);
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
        setCurrentPage(1);
    }, [latestPosts, tagSelectedName, searchQuery]);

    const totalPages = Math.ceil(filteredLatestPosts.length / pageSize) || 1;
    const paginatedPosts = filteredLatestPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <>
            <Head>
                <title>Vierra | Blog</title>
                <meta name="description" content="Insights, case studies, and strategies from Vierra to scale revenue and acquire more clients. Learn about marketing, lead generation, business growth, and digital optimization." />
                <meta name="keywords" content="marketing blog, business growth strategies, lead generation tips, digital marketing insights, case studies, business scaling, marketing automation" />
                <link rel="canonical" href="https://vierradev.com/blog" />
                <meta property="og:title" content="Vierra | Blog" />
                <meta property="og:description" content="Insights, case studies, and strategies from Vierra to scale revenue and acquire more clients." />
                <meta property="og:url" content="https://vierradev.com/blog" />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Vierra | Blog" />
                <meta name="twitter:description" content="Insights, case studies, and strategies from Vierra to scale revenue and acquire more clients." />
            </Head>
            <Script
                id="schema-org-blog"
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Blog",
                        name: "Vierra Blog",
                        description: "Insights, case studies, and strategies from Vierra to scale revenue and acquire more clients.",
                        url: "https://vierradev.com/blog",
                        publisher: {
                            "@type": "Organization",
                            name: "Vierra Digital",
                            logo: {
                                "@type": "ImageObject",
                                url: "https://vierradev.com/assets/meta-banner.png",
                            },
                        },
                        blogPost: latestPosts.slice(0, 10).map(post => ({
                            "@type": "BlogPosting",
                            headline: post.title,
                            description: post.description || stripHtml(post.content).substring(0, 200),
                            url: `https://vierradev.com/blog/${post.slug}`,
                            datePublished: post.published_date,
                            author: {
                                "@type": "Person",
                                name: post.author.name,
                            },
                        })),
                    }),
                }}
            />
            <div className="min-h-screen bg-[#18042A] text-white relative overflow-hidden z-0">
                {Array.from({ length: 7 }).map((_, index) => (
                    <motion.div
                        key={index}
                        className="absolute top-0 h-full border-l border-white opacity-5 -z-10"
                        style={{ left: `${(index + 1) * (100 / 8)}%` }}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "100%", opacity: 0.05, x: [0, 10, 0] }}
                        transition={{
                            duration: 3,
                            delay: index * 0.2,
                            ease: "easeInOut",
                            x: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                        }}
                    />
                ))}

                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: { opacity: 0, y: -20 },
                        visible: { opacity: 1, y: 0 },
                    }}
                >
                    <Header />
                </motion.div>

                <main className="relative px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-10">
                    <motion.div
                        initial={{ x: 0, y: 0 }}
                        animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "easeInOut",
                        }}
                        className="absolute top-[7%] left-[10%] w-[470px] h-[470px] max-w-[475px] max-h-[475px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] -z-20"
                    />
                    <motion.div
                        initial={{ x: 0, y: 0 }}
                        animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "easeInOut",
                        }}
                        className="absolute -bottom-[32%] -right-[3%] w-[545px] h-[545px] max-w-[550px] max-h-[550px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] -z-20"
                    />

                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{
                            hidden: { opacity: 0, y: 20 },
                            visible: {
                                opacity: 1,
                                y: 0,
                                transition: { staggerChildren: 0.2, ease: "easeOut" },
                            },
                        }}
                        className=""
                    >


                        <div id="control-section" className="p-8 w-full lg:p-20">
                            <div id="header-text-holder" className="my-4 max-w-2xl mb-5">
                                <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold leading-tight lg:mb-6 text-[#EFF3FF] ${bricolage.className}`}>Blog And</h1>
                                <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold leading-tight lg:mb-6 text-[#EFF3FF] ${bricolage.className}`}>Case Studies</h1>
                            </div>
                            <div id="subtext-search-row" className="w-full h-auto flex flex-col sm:flex-col md:flex-col lg:flex-row xl:flex-row justify-between">
                                <div id="subtext-holder" className={`text-[#9BAFC3] text-base md:text-lg mb-10 max-w-2xl ${inter.className}`}>
                                    <p>Check out the latest insights, case studies, analytics,<br />and projects from Vierra.</p>
                                </div>

                                <div id="search-holder" className="flex w-full lg:w-[556px]">
                                    <div className="w-full h-12 md:h-14 rounded-lg bg-white border border-gray-200 flex items-center px-4 gap-3 shadow-sm hover:shadow-md transition-shadow">
                                        <Search className="h-5 w-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search articles, topics, authors..."
                                            className={`w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-500 text-sm md:text-base ${inter.className}`}
                                            aria-label="Search blog posts"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div id="tag-row" className="w-full h-auto mt-5 flex flex-wrap gap-3">
                                {tags.map((tag, index) => (
                                    <Button
                                        key={index}
                                        id="tag-holder"
                                        className={
                                            index === tagSelected
                                                ? `bg-[#701CC0] hover:bg-[#5a1799] text-[#EFF3FF] border-none px-4 py-2`
                                                : `bg-transparent text-[#F3F3F3] border rounded-lg border-[#F3F3F3] hover:text-[#EFF3FF] hover:bg-[#701CC0] hover:border-[#701CC0] px-4 py-2`
                                        }
                                        onClick={() => handleTagSwitch(index)}
                                        disabled={loading}
                                    >
                                        <p className={`text-sm md:text-base ${bricolage.className}`}>{tag}</p>
                                    </Button>
                                ))}
                            </div>
                            {loading && (
                                <div className="mt-4 text-center">
                                    <p className={`text-[#9BAFC3] ${inter.className}`}>Loading posts...</p>
                                </div>
                            )}

                        </div>
                    </motion.div>


                </main>
                <div id="view-section" className="bg-[#F3F3F3] px-8 lg:px-20">
                    <div className="max-w-7xl mx-auto py-20">
                        <h1 id="part-1-header" className={`text-xl md:text-2xl lg:text-3xl font-bold leading-tight mb-6 text-[#18042A] ${bricolage.className}`}>All Blog Posts</h1>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                            {paginatedPosts.map((blog) => (
                                <div key={blog.id}>
                                    <Link href={`/blog/${blog.slug}`} passHref>
                                        <div className="rounded-2xl bg-white p-5 md:p-6 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer">
                                            <h3 className={`text-base md:text-lg font-bold text-[#0F172A] ${bricolage.className}`}>{blog.title}</h3>
                                            <div className="mt-1 text-[11px] md:text-xs text-[#334155] flex items-center gap-2">
                                                <span>By {blog.author?.name ?? "Unknown"}</span>
                                                <div className="h-1 w-1 bg-gray-400 rounded-full"></div>
                                                <span>{blog.published_date ? formatDate(blog.published_date) : ''}</span>
                                            </div>
                                            <p className={`mt-3 text-sm md:text-base text-[#475569] ${inter.className}`}>{blog.description || getExcerpt(blog.content)}</p>
                                            <div className="flex flex-wrap gap-1 mt-3">
                                                {blog.tag ? blog.tag.split(',').map((tag, index) => (
                                                    <span key={index} className="text-[10px] md:text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                                                        {tag.trim()}
                                                    </span>
                                                )) : (
                                                    <span className="text-[10px] md:text-xs font-semibold text-purple-600">Blog</span>
                                                )}
                                            </div>
                                            <div className="mt-4 flex items-center justify-between">
                                                <span className="text-[#701CC0] font-semibold text-sm md:text-base">Read More</span>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            ))}
                                </div>
                        <div className="flex items-center gap-3 mt-10">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm md:text-base shadow-[0px_4px_15.9px_0px_#701CC061] hover:bg-[#5f17a5] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#701CC0]/50"
                            >
                                Previous
                            </button>
                            <span className="text-[#9BAFC3] text-sm md:text-base">{currentPage} / {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm md:text-base shadow-[0px_4px_15.9px_0px_#701CC061] hover:bg-[#5f17a5] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#701CC0]/50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
                {/* inline search only; modals removed */}

            </div >
            <Footer />
        </>
    )
}
export default BlogPage;
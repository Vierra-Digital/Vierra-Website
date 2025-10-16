import React, { useEffect, useMemo, useState } from "react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Head from 'next/head';
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import Image from 'next/image';
import Footer from "@/components/FooterSection/Footer";
import { GetStaticProps } from "next";
import Link from "next/link";
// removed search modal usage for inline search

type BlogPostType = {
    id: number;
    author_id?: number | null;
    title: string;
    content: string;
    image_url?: string | null;
    published_date?: string | null;
    slug: string;
    is_test?: boolean | null;
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
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const formatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    return formatter.format(date);
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


const BlogPage = ({ latestPosts, trendingPosts: _trendingPosts }: Props) => {

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
        return posts.filter(post => post.tag === tagName);
    };

    const filterPostsByQuery = (query: string, posts: BlogPostType[]) => {
        const q = query.trim().toLowerCase();
        if (!q) return posts;
        return posts.filter((post) => {
            const title = post.title?.toLowerCase() || "";
            const content = stripHtml(post.content)?.toLowerCase() || "";
            const author = post.author?.name?.toLowerCase() || "";
            const tag = post.tag?.toLowerCase() || "";
            return title.includes(q) || content.includes(q) || author.includes(q) || tag.includes(q);
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
                <meta name="description" content="Insights, case studies, and strategies from Vierra to scale revenue and acquire more clients." />
                <link rel="canonical" href="https://vierradev.com/blog" />
            </Head>
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
                                    <p>Check out the latest insights, case studies, analytics, and projects from Vierra.</p>
                                </div>

                                <div id="search-holder" className="flex w-full lg:w-[556px]">
                                    <div className="w-full h-11 md:h-14 rounded-full bg-[#F3F3F3] flex items-center px-6 gap-3">
                                        <Search className="h-4 w-4 md:h-5 md:w-5 text-[#646A69]" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search articles, topics, authors..."
                                            className={`w-full bg-transparent outline-none text-[#18042A] placeholder:text-[#646A69] text-sm md:text-base lg:text-lg ${inter.className}`}
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
                                <Link key={blog.id} href={`/blog/${blog.slug}`} passHref>
                                    <div className="rounded-2xl bg-white p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                                        <span className="text-[10px] md:text-xs font-semibold text-purple-600">{blog.tag || 'Blog'}</span>
                                        <h3 className={`mt-2 text-base md:text-lg font-bold text-[#18042A] ${bricolage.className}`}>{blog.title}</h3>
                                        <div className="mt-1 text-[11px] md:text-xs text-[#6B7280]">{blog.published_date ? formatDate(blog.published_date) : ''}</div>
                                        <p className={`mt-3 text-sm md:text-base text-[#6B7280] ${inter.className}`}>{getExcerpt(blog.content)}</p>
                                        <div className="mt-4 flex items-center justify-between">
                                            <span className="text-[#701CC0] font-semibold text-sm md:text-base">Read More</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 md:gap-3 mt-10">
                            <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 md:px-4 md:py-2 rounded-full bg-white text-[#18042A] disabled:opacity-50 text-sm md:text-base">Prev</button>
                            <span className="text-[#6B7280] text-sm md:text-base">{currentPage} / {totalPages}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 md:px-4 md:py-2 rounded-full bg-white text-[#18042A] disabled:opacity-50 text-sm md:text-base">Next</button>
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
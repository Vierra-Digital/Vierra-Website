import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
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
import { SearchModal } from "@/components/Blog/SearchModal";
import { AllPostsModal } from "@/components/Blog/AllPostsModal";

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
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
};

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });
const inter = Inter({ subsets: ["latin"] });
const tags: string[] = ["All Blog Posts", "Case Studies", "Technology", "AI & Automation", "Finance", "Marketing", "Sales", "Management", "Leadership"]


const BlogPage = ({ latestPosts, trendingPosts }: Props) => {

    const [tagSelected, setTagSelected] = useState(0);
    const [tagSelectedName, setTagSelectedName] = useState("All Blog Posts");
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [isAllPostModalOpen, setIsAllPostModalOpen] = useState(false);
    const [filteredLatestPosts, setFilteredLatestPosts] = useState<BlogPostType[]>([])
    const [filteredTrendingPosts, setFilteredTrendingPosts] = useState<BlogPostType[]>([])
    const [loading, setLoading] = useState(false);

    const filterPostsByTag = (tagName: string, posts: BlogPostType[]) => {
        if (tagName === "All Blog Posts") {
            return posts;
        }
        return posts.filter(post => post.tag === tagName);
    };

    const handleTagSwitch = async (index: number) => {
        const name = tags[index];
        setTagSelected(index);
        setTagSelectedName(name);
        setLoading(true);

        try {
            const filteredLatest = filterPostsByTag(name, latestPosts);
            const filteredTrending = filterPostsByTag(name, trendingPosts);

            setFilteredLatestPosts(filteredLatest);
            setFilteredTrendingPosts(filteredTrending);
        } catch (error) {
            console.error("Error filtering posts:", error);
            setFilteredLatestPosts([]);
            setFilteredTrendingPosts([]);
        } finally {
            setLoading(false);
        }
    };



    const router = useRouter();


    useEffect(() => {
        setFilteredLatestPosts(latestPosts);
        setFilteredTrendingPosts(trendingPosts);
    }, [latestPosts, trendingPosts]);

    useEffect(() => {
        router.push("/blog")

    }, [router]);

    return (
        <>
            <Head>
                <title>Vierra | Home</title>
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

                <main className="relative px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
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
                                <h1 className={`text-5xl md:text-6xl font-bold leading-tight lg:mb-6 text-[#EFF3FF] ${bricolage.className}`}>Vierra</h1>
                                <h1 className={`text-5xl md:text-6xl font-bold leading-tight lg:mb-6 text-[#EFF3FF] ${bricolage.className}`}>Marketing Blog</h1>
                            </div>
                            <div id="subtext-search-row" className="w-full h-auto flex flex-col sm:flex-col md:flex-col lg:flex-row xl:flex-row justify-between">
                                <div id="subtext-holder" className={`text-[#9BAFC3] text-lg mb-10 max-w-2xl ${inter.className}`}>
                                    <p>Check out the latest news, projects, and insights from Vierra.</p>
                                </div>

                                <button id="search-holder" className="flex" onClick={() => setIsSearchModalOpen(true)}>
                                    <div className="w-full lg:w-[556px] h-[56px] rounded-full bg-[#F3F3F3] flex items-center px-10 justify-between cursor-pointer">
                                        <p id="search-text" className={`lg:text-lg text-[#646A69] ${bricolage.className}`}>Search...
                                        </p>
                                        <div id="search-icon-holder">
                                            <Search className="h-[25px] w-[25px] text-[#646A69]" />
                                        </div>
                                    </div>
                                </button>
                            </div>
                            <div id="tag-row" className="w-full h-auto mt-5 flex flex-wrap gap-3">
                                {tags.map((tag, index) => (
                                    <Button
                                        key={index}
                                        id="tag-holder"
                                        className={
                                            index === tagSelected
                                                ? `bg-[#701CC0] hover:bg-[#5a1799] text-[#EFF3FF] border-none`
                                                : `bg-transparent text-[#F3F3F3] border rounded-lg border-[#F3F3F3] hover:text-[#EFF3FF] hover:bg-[#701CC0] hover:border-[#701CC0]`
                                        }
                                        onClick={() => handleTagSwitch(index)}
                                        disabled={loading}
                                    >
                                        <p className={`text-lg ${bricolage.className}`}>{tag}</p>
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
                    <div id="view-part-1" className="pt-20">
                        <h1 id="part-1-header" className={`text-2xl md:text-3xl font-bold leading-tight mb-6 text-[#18042A] ${bricolage.className}`}>All Blog Posts</h1>
                        <div id="vp-1-blogs-container" className="w-full flex flex-col lg:flex-row gap-6">
                            {!loading && (
                                <div
                                    className="w-full lg:flex-[0.5] relative aspect-square rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-300"
                                    style={{
                                        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6)), url(${filteredLatestPosts[0] ? filteredLatestPosts[0].image_url : ""})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat'
                                    }}
                                >
                                    {filteredLatestPosts[0] ? (
                                        <Link href={`/blog/${filteredLatestPosts[0].slug}`} passHref>
                                            <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                                                <div className="mb-4">
                                                    <span className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium">
                                                        {filteredLatestPosts[0].tag ? filteredLatestPosts[0].tag : "Lorem Ipsum"}
                                                    </span>
                                                </div>
                                                <div className="transform transition-transform duration-300 group-hover:translate-y-[-8px]">
                                                    <h2 className={`text-2xl lg:text-3xl font-bold mb-3 leading-tight ${bricolage.className}`}>
                                                        {filteredLatestPosts[0].title}
                                                    </h2>
                                                    <div className="flex flex-row gap-5 items-center mt-4">
                                                        <span className={`text-lg text-[#EFF3FF] ${inter.className}`}>
                                                            {filteredLatestPosts[0].author.name}
                                                        </span>
                                                        <span className={`text-lg text-[#EFF3FF] ${inter.className}`}>
                                                            {formatDate(filteredLatestPosts[0].published_date)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                                        </Link>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white items-center justify-center">
                                            <p>{`No blogs with the tag "${tagSelectedName}" yet`}</p>
                                        </div>
                                    )}


                                </div>
                            )}
                            <div className="w-full lg:flex-[0.5] grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredLatestPosts.slice(1, 5).map((blog) => (
                                    <Link key={blog.id} href={`/blog/${blog.slug}`} passHref>

                                        <div
                                            className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-300"
                                            style={{
                                                backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6)), url(${blog.image_url})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                backgroundRepeat: 'no-repeat'
                                            }}
                                        >
                                            <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                                                <div className="mb-4">
                                                    <span className="bg-purple-600 text-white px-5 py-2 rounded-lg text-xs font-medium">
                                                        {blog.tag ? blog.tag : "Lorem Ipsum"}
                                                    </span>
                                                </div>
                                                <div className="transform transition-transform duration-300 group-hover:translate-y-[-4px]">
                                                    <h3 className={`text-sm lg:text-base font-bold mb-1 leading-tight ${bricolage.className}`}>
                                                        {blog.title}
                                                    </h3>
                                                </div>
                                            </div>
                                            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div id="view-part-2" className="pt-20">
                        <div id="part-2-heading-row" className="flex w-full flex-row justify-between items-center">
                            <h1 id="part-2-header" className={`text-2xl md:text-3xl font-bold leading-tight mt-6 mb-6 text-[#18042A] ${bricolage.className}`}>Trending</h1>
                            <Button onClick={() => setIsAllPostModalOpen(true)} className={`h-fit px-4 py-2 border border-[#646A69] text-[#646A69] rounded-lg ${bricolage.className} hover:text-[#EFF3FF] bg-transparent`}>View All Posts</Button>
                        </div>
                        <div id="vp-2-blogs-container" className="w-full flex flex-col lg:flex-row gap-6">
                            <div className="w-full grid lg:grid-cols-4 gap-4">
                                {filteredTrendingPosts[0] ? filteredTrendingPosts.slice(0, 4).map((blog) => (
                                    <Link key={blog.id} href={`/blog/${blog.slug}`} passHref>

                                        <div
                                            className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-300"
                                            style={{
                                                backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6)), url(${blog.image_url})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                backgroundRepeat: 'no-repeat'
                                            }}
                                        >
                                            <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                                                <div className="mb-4">
                                                    <span className="bg-purple-600 text-white px-5 py-2 rounded-lg text-xs font-medium">
                                                        {blog.tag ? blog.tag : "Lorem Ipsum"}
                                                    </span>
                                                </div>
                                                <div className="transform transition-transform duration-300 group-hover:translate-y-[-4px]">
                                                    <h3 className={`text-sm lg:text-base font-bold mb-1 leading-tight ${bricolage.className}`}>
                                                        {blog.title}
                                                    </h3>
                                                </div>
                                            </div>
                                            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                                        </div>
                                    </Link>
                                )) : (
                                    <div
                                        className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-300"
                                        style={{
                                            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6))`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            backgroundRepeat: 'no-repeat'
                                        }}
                                    >
                                        <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                                            <div className="mb-4">

                                            </div>
                                            <div className="transform transition-transform duration-300 group-hover:translate-y-[-4px]">
                                                <h3 className={`text-sm lg:text-base font-bold mb-1 leading-tight ${bricolage.className}`}>
                                                    {`No blogs with the tag "${tagSelectedName}" yet`}

                                                </h3>
                                            </div>
                                        </div>

                                    </div>
                                )}

                            </div>

                        </div>
                    </div>
                    <div id="view-part-3" className="pt-20">
                        <div id="part-3-heading-row" className="flex w-full flex-row justify-between items-center">
                            <h1 id="part-3-header" className={`text-2xl md:text-3xl font-bold leading-tight mt-6 mb-6 text-[#18042A] ${bricolage.className}`}>Editor&apos;s Pick</h1>
                            <Button onClick={() => setIsAllPostModalOpen(true)} className={`h-fit px-4 py-2 border border-[#646A69] text-[#646A69] rounded-lg ${bricolage.className} hover:text-[#EFF3FF] bg-transparent`}>View All Posts</Button>
                        </div>
                        <div id="vp-3-blogs-container" className="w-full flex gap-6 pb-5">
                            <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {filteredTrendingPosts[0] ? filteredTrendingPosts.slice(0, 6).map((blog) => (
                                    <Link key={blog.id} href={`/blog/${blog.slug}`} passHref>
                                        <div id="editor-blog-container" className="flex flex-row w-full h-24 p-5 gap-3 border-[1px] border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden transition-all duration-300 hover:shadow-lg">
                                            <div id="editor-blog-image-container" className="w-20 h-full flex-shrink-0">
                                                <Image alt={blog.title ?? "blog image"} src={blog.image_url ?? "/assets/vierra-logo.png"} width={80} height={80} className="object-cover" />
                                            </div>
                                            <div id="editor-blog-text-container" className="flex flex-col justify-center">
                                                <span className={`text-sm md:text-md font-bold leading-tight text-[#18042A] ${bricolage.className}`}>
                                                    {blog.title}
                                                </span>
                                                <span className={`text-sm font-bold font-normal leading-tight mt-2 text-[#18042A] ${bricolage.className}`}>
                                                    {blog.published_date ? formatDate(blog.published_date) : ""}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                )) : (
                                    <div id="editor-blog-container" className="flex flex-row w-full h-24 p-5 gap-3 border-[1px] border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden transition-all duration-300 hover:shadow-lg">
                                        <div id="editor-blog-image-container" className="w-20 h-full flex-shrink-0">
                                        </div>
                                        <div id="editor-blog-text-container" className="flex flex-col justify-center">
                                            <span className={`text-sm md:text-md font-bold leading-tight text-[#18042A] ${bricolage.className}`}>
                                                {`No blogs with the tag "${tagSelectedName}" yet`}

                                            </span>
                                            <span className={`text-sm font-bold font-normal leading-tight mt-2 text-[#18042A] ${bricolage.className}`}>
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div id="view-part-4" className="py-20 flex flex-col lg:flex-row gap-3">
                        <div id="weekly-best" className="flex-[2] w-full">
                            <div id="part-4-heading-row" className="flex w-full flex-row justify-between items-center">
                                <h1 id="part-4-header" className={`text-2xl md:text-3xl font-bold leading-tight text-[#18042A] ${bricolage.className}`}>Weekly Best</h1>
                                <Button onClick={() => setIsAllPostModalOpen(true)} className={`h-fit px-4 py-2 border border-[#646A69] text-[#646A69] rounded-lg ${bricolage.className} hover:text-[#EFF3FF] bg-transparent`}>View All Posts</Button>
                            </div>
                            <div id="part-4-weekly-feature-container" className="mt-4">
                                {filteredTrendingPosts.length > 0 ? (
                                    <Link href={`/blog/${filteredTrendingPosts[0].slug}`} passHref>

                                        <div
                                            className="w-full lg:flex-[0.5] relative h-[453px] rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-300"
                                            style={{
                                                backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6)), url(${filteredTrendingPosts[0].image_url})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                backgroundRepeat: 'no-repeat'
                                            }}
                                        >
                                            <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                                                <div className="mb-4">
                                                    <span className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium">
                                                        {filteredTrendingPosts[0].tag ? filteredTrendingPosts[0].tag : "Lorem Ipsum"}

                                                    </span>
                                                </div>
                                                <div className="transform transition-transform duration-300 group-hover:translate-y-[-8px]">
                                                    <h2 className={`text-2xl lg:text-3xl font-bold mb-3 leading-tight ${bricolage.className}`}>
                                                        {filteredTrendingPosts[0].title}
                                                    </h2>
                                                    <div className="flex flex-row gap-5 items-center mt-4">
                                                        <span className={`text-lg text-[#EFF3FF] ${inter.className}`}>
                                                            {filteredTrendingPosts[0].author.name}
                                                        </span>
                                                        <span className={`text-lg text-[#EFF3FF] ${inter.className}`}>
                                                            {filteredTrendingPosts[0].published_date ? formatDate(filteredTrendingPosts[0].published_date) : ""}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                                        </div>
                                    </Link>
                                ) : (
                                    <div
                                        className="w-full lg:flex-[0.5] relative h-[453px] rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-300"
                                        style={{
                                            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6)), url(${filteredTrendingPosts[0] ? filteredTrendingPosts[0].image_url : ""})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            backgroundRepeat: 'no-repeat'
                                        }}
                                    >

                                        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                                            <div className="mb-4">
                                            
                                            </div>
                                            <div className="transform transition-transform duration-300 group-hover:translate-y-[-8px]">
                                                <h2 className={`text-2xl lg:text-3xl font-bold mb-3 leading-tight ${bricolage.className}`}>
                                                    {`No blogs with the tag "${tagSelectedName}" yet`}
                                                </h2>
                                                <div className="flex flex-row gap-5 items-center mt-4">
                                                    <span className={`text-lg text-[#EFF3FF] ${inter.className}`}>
                                                    </span>
                                                    <span className={`text-lg text-[#EFF3FF] ${inter.className}`}>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>
                            <div id="part-4-weekly-other-container" className="mt-4">
                                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {filteredTrendingPosts.slice(0, 6).map((blog) => (
                                            <Link key={blog.id} href={`/blog/${blog.slug}`} passHref>

                                                <div id="editor-blog-container" className="flex flex-row w-full h-24 p-5 gap-3 border-[1px] border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden transition-all duration-300 hover:shadow-lg">
                                                    <div id="editor-blog-image-container" className="w-20 h-full flex-shrink-0">
                                                        <Image alt={blog.title ?? "blog image"} src={blog.image_url ?? "/assets/vierra-logo.png"} width={80} height={80} className="object-cover" />
                                                    </div>
                                                <div id="editor-blog-text-container" className="flex flex-col justify-center">
                                                    <span className={`text-sm md:text-md font-bold leading-tight text-[#18042A] ${bricolage.className}`}>
                                                        {blog.title}
                                                    </span>
                                                    <span className={`text-sm font-normal leading-tight mt-2 text-[#18042A] ${bricolage.className}`}>
                                                        {blog.published_date ? formatDate(blog.published_date) : ""}

                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                        </div>
                        <div id="popular" className="flex-[1] w-full">
                            <div id="popular-posts-container" className="flex flex-col p-2 border-[1px] border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden ">
                                <h1 className={`text-[#18042A] font-semibold ${bricolage.className}`}>Popular Posts</h1>
                                <div className="w-full grid grid-cols-1 sm:grid-cols-1 md:grid-cols-1 gap-4">
                                    {filteredTrendingPosts.slice(0, 6).map((blog) => (
                                        <Link key={blog.id} href={`/blog/${blog.slug}`} passHref>

                                            <div id="editor-blog-container" className="flex flex-row w-full h-24 p-5 gap-3 border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden transition-all duration-300 hover:shadow-lg">
                                                <div id="editor-blog-image-container" className="w-20 h-full flex-shrink-0">
                                                    <Image alt={blog.title ?? "blog image"} src={blog.image_url ?? "/assets/vierra-logo.png"} width={80} height={80} className="object-cover" />
                                                </div>
                                                <div id="editor-blog-text-container" className="flex flex-col justify-center">
                                                    <span className={`text-sm md:text-md font-bold leading-tight text-[#18042A] ${bricolage.className}`}>
                                                        {blog.title}
                                                    </span>
                                                    <span className={`text-sm font-normal leading-tight mt-2 text-[#18042A] ${bricolage.className}`}>
                                                        {blog.published_date ? formatDate(blog.published_date) : ""}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
                {isSearchModalOpen && <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />}
                {isAllPostModalOpen && <AllPostsModal isOpen={isAllPostModalOpen} onClose={() => setIsAllPostModalOpen(false)} />}

            </div >
            <Footer />
        </>
    )
}
export default BlogPage;
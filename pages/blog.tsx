import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { Search } from "lucide-react";
import { FooterSection } from "@/components/FooterSection/MainComponent";
import { Modal } from "@/components/Modal";
import Main from "@/components/ServicesSection/Main";
import Footer from "@/components/FooterSection/Footer";

// interface for testing BlogItems (NOTE: This is not the final structure for Blog Items)
interface BlogItem {
    id: string;
    title: string;
    description: string;
    author: string;
    image: string;
    createdAt: string;
    category?: string;
}

// array for testing BlogItems
const view1Array: BlogItem[] = [
    {
        id: "1",
        title: "Lorem Ipsum",
        description: "Lorem ipsum dolor sit amet, on consectetur adipiscing elit. Vivamus",
        author: "Thomas Walsh",
        image: "/assets/Team/Paul.png",
        createdAt: "1"
    },
    {
        id: "2",
        title: "Lorem Ipsum",
        description: "Lorem ipsum dolor sit amet, on consectetur adipiscing elit. Vivamus",
        author: "Thomas Walsh",
        image: "/assets/Team/Paul.png",
        createdAt: "2"
    },
    {
        id: "3",
        title: "Lorem Ipsum",
        description: "Lorem ipsum dolor sit amet, on consectetur adipiscing elit. Vivamus",
        author: "Thomas Walsh",
        image: "/assets/Team/Paul.png",
        createdAt: "3"
    },
    {
        id: "4",
        title: "Lorem Ipsum",
        description: "Lorem ipsum dolor sit amet, on consectetur adipiscing elit. Vivamus",
        author: "Thomas Walsh",
        image: "/assets/Team/Paul.png",
        createdAt: "4"
    },
    {
        id: "5",
        title: "Lorem Ipsum",
        description: "Lorem ipsum dolor sit amet, on consectetur adipiscing elit. Vivamus",
        author: "Thomas Walsh",
        image: "/assets/Team/Paul.png",
        createdAt: "5"
    },
    {
        id: "6",
        title: "Lorem Ipsum",
        description: "Lorem ipsum dolor sit amet, on consectetur adipiscing elit. Vivamus",
        author: "Thomas Walsh",
        image: "/assets/Team/Paul.png",
        createdAt: "6"
    }
]

declare global {
    interface Window {
        particlesJS: {
            load: (tagId: string, path: string, callback?: () => void) => void;
        };
        pJSDom?: { pJS: Record<string, unknown> }[];
    }
}


const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });
const inter = Inter({ subsets: ["latin"] });
const tags: string[] = ["All Blog Posts", "Latest Blog Posts", "Lorem Ipsum", "Lorem Ipsum", "Lorem Ipsum", "Lorem Ipsum"]


const BlogPage: React.FC = () => {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tagSelected, setTagSelected] = useState(0);

    const initParticles = () => {
        if (typeof window !== 'undefined' && window.particlesJS) {
            window.particlesJS.load('particles-container', '/particles-config.json', () => {
                console.log('particles.js loaded - callback');
            });
        }
    };
    const router = useRouter();

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
                                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                                </div>
                                <div id="search-holder" className="flex">
                                    <div className="w-full lg:w-[556px] h-[56px] rounded-full bg-[#F3F3F3] flex items-center px-10 justify-between">
                                        <p id="search-text" className={`lg:text-lg text-[#646A69] ${bricolage.className}`}>Search...
                                        </p>
                                        <div id="search-icon-holder">
                                            <Search className="h-[25px] w-[25px] text-[#646A69]" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div id="tag-row" className="w-full h-auto mt-5 flex flex-wrap gap-3">
                                {tags.map((tag, index) => (
                                    (index === tagSelected) ? (
                                        <Button id="tag-holder">
                                            <p className={`text-lg text-[#EFF3FF] ${bricolage.className}`}>{tag}</p>
                                        </Button>
                                    ) : (
                                        <Button id="tag-holder" className="bg-transparent text-[#F3F3F3] border rounded-lg border-[#F3F3F3] hover:text-[#EFF3FF]" onClick={() => setTagSelected(index)}>
                                            <p className={`text-lg  ${bricolage.className}`}>{tag}</p>
                                        </Button>
                                    )
                                ))}
                            </div>
                        </div>
                    </motion.div>


                </main>
                <div id="view-section" className="bg-[#F3F3F3] px-8 lg:px-20">
                    <div id="view-part-1" className="pt-20">
                        <h1 id="part-1-header" className={`text-2xl md:text-3xl font-bold leading-tight mb-6 text-[#18042A] ${bricolage.className}`}>All Blog Posts</h1>
                        <div id="vp-1-blogs-container" className="w-full flex flex-col lg:flex-row gap-6">
                            {/* Featured Blog Post (Top on mobile, Left Half on desktop) */}
                            {view1Array.length > 0 && (
                                <div
                                    className="w-full lg:flex-[0.5] relative aspect-square rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                                    style={{
                                        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6)), url(${view1Array[0].image})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat'
                                    }}
                                >


                                    {/* Content overlay */}
                                    <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                                        <div className="mb-4">
                                            <span className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium">
                                                {view1Array[0].title}
                                            </span>
                                        </div>
                                        <div className="transform transition-transform duration-300 group-hover:translate-y-[-8px]">
                                            <h2 className={`text-2xl lg:text-3xl font-bold mb-3 leading-tight ${bricolage.className}`}>
                                                {view1Array[0].description}
                                            </h2>
                                            <div className="flex flex-row gap-5 items-center mt-4">
                                                <span className={`text-lg text-[#EFF3FF] ${inter.className}`}>
                                                    {view1Array[0].author}
                                                </span>
                                                <span className={`text-lg text-[#EFF3FF] ${inter.className}`}>
                                                    99-99-99
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                                </div>
                            )}

                            {/* 2x2 Grid (Bottom on mobile, Right Half on desktop) */}
                            <div className="w-full lg:flex-[0.5] grid grid-cols-2 gap-4">
                                {view1Array.slice(1, 5).map((blog) => (
                                    <div
                                        key={blog.id}
                                        className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-105"
                                        style={{
                                            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6)), url(${blog.image})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            backgroundRepeat: 'no-repeat'
                                        }}
                                    >


                                        {/* Content overlay */}
                                        <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                                            <div className="mb-4">
                                                <span className="bg-purple-600 text-white px-5 py-2 rounded-lg text-xs font-medium">
                                                    {blog.title}
                                                </span>
                                            </div>
                                            <div className="transform transition-transform duration-300 group-hover:translate-y-[-4px]">
                                                <h3 className={`text-sm lg:text-base font-bold mb-1 leading-tight ${bricolage.className}`}>
                                                    {blog.description}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div id="view-part-2" className="pt-20">
                        <div id="part-2-heading-row" className="flex w-full flex-row justify-between items-center">
                            <h1 id="part-2-header" className={`text-2xl md:text-3xl font-bold leading-tight mt-6 mb-6 text-[#18042A] ${bricolage.className}`}>Trending</h1>
                            <button className={`h-fit px-4 py-2 border border-[#646A69] text-[#646A69] rounded-lg ${bricolage.className}`}>View All Posts</button>
                        </div>
                        <div id="vp-2-blogs-container" className="w-full flex flex-col lg:flex-row gap-6">
                            <div className="w-full grid lg:grid-cols-4 gap-4">
                                {view1Array.slice(0, 4).map((blog) => (
                                    <div
                                        key={blog.id}
                                        className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-105"
                                        style={{
                                            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6)), url(${blog.image})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            backgroundRepeat: 'no-repeat'
                                        }}
                                    >

                                        {/* Content overlay */}
                                        <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                                            <div className="mb-4">
                                                <span className="bg-purple-600 text-white px-5 py-2 rounded-lg text-xs font-medium">
                                                    {blog.title}
                                                </span>
                                            </div>
                                            <div className="transform transition-transform duration-300 group-hover:translate-y-[-4px]">
                                                <h3 className={`text-sm lg:text-base font-bold mb-1 leading-tight ${bricolage.className}`}>
                                                    {blog.description}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div id="view-part-3" className="pt-20">
                        <div id="part-3-heading-row" className="flex w-full flex-row justify-between items-center">
                            <h1 id="part-3-header" className={`text-2xl md:text-3xl font-bold leading-tight mt-6 mb-6 text-[#18042A] ${bricolage.className}`}>Editor's Pick</h1>
                            <button className={`h-fit px-4 py-2 border border-[#646A69] text-[#646A69] rounded-lg ${bricolage.className}`}>View All Posts</button>
                        </div>
                        <div id="vp-3-blogs-container" className="w-full flex gap-6 pb-5">
                            <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {view1Array.slice(0, 6).map((blog) => (
                                    <div id="editor-blog-container" className="flex flex-row w-full h-30 p-5 gap-3 border-[1px] border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden">
                                        <div id="editor-blog-image-container" className="w-20 h-full flex-shrink-0">
                                            <img src={blog.image} className="object-cover" />
                                        </div>
                                        <div id="editor-blog-text-container" className="flex flex-col justify-center">
                                            <span className={`text-md font-bold leading-tight text-[#18042A] ${bricolage.className}`}>
                                                {blog.description}
                                            </span>
                                            <span className={`text-sm font-bold font-normal leading-tight mt-2 text-[#18042A] ${bricolage.className}`}>
                                                99-99-9999
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div id="view-part-4" className="py-20 flex flex-col lg:flex-row gap-3">
                        <div id="weekly-best" className="flex-[2] w-full">
                            <div id="part-4-heading-row" className="flex w-full flex-row justify-between items-center">
                                <h1 id="part-4-header" className={`text-2xl md:text-3xl font-bold leading-tight text-[#18042A] ${bricolage.className}`}>Weekly Best</h1>
                                <button className={`h-fit px-4 py-2 border border-[#646A69] text-[#646A69] rounded-lg ${bricolage.className}`}>View All Posts</button>
                            </div>
                            <div id="part-4-weekly-feature-container" className="mt-4">
                                {view1Array.length > 0 && (
                                    <div
                                        className="w-full lg:flex-[0.5] relative h-[453px] rounded-2xl overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                                        style={{
                                            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6)), url(${view1Array[0].image})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            backgroundRepeat: 'no-repeat'
                                        }}
                                    >

                                        {/* Content overlay */}
                                        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                                            <div className="mb-4">
                                                <span className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium">
                                                    {view1Array[0].title}
                                                </span>
                                            </div>
                                            <div className="transform transition-transform duration-300 group-hover:translate-y-[-8px]">
                                                <h2 className={`text-2xl lg:text-3xl font-bold mb-3 leading-tight ${bricolage.className}`}>
                                                    {view1Array[0].description}
                                                </h2>
                                                <div className="flex flex-row gap-5 items-center mt-4">
                                                    <span className={`text-lg text-[#EFF3FF] ${inter.className}`}>
                                                        {view1Array[0].author}
                                                    </span>
                                                    <span className={`text-lg text-[#EFF3FF] ${inter.className}`}>
                                                        99-99-99
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                                    </div>
                                )}
                            </div>
                            <div id="part-4-weekly-other-container" className="mt-4">
                                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {view1Array.slice(0, 6).map((blog) => (
                                        <div id="editor-blog-container" className="flex flex-row w-full h-30 p-5 gap-3 border-[1px] border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden">
                                            <div id="editor-blog-image-container" className="w-20 h-full flex-shrink-0">
                                                <img src={blog.image} className="object-cover" />
                                            </div>
                                            <div id="editor-blog-text-container" className="flex flex-col justify-center">
                                                <span className={`text-md font-bold leading-tight text-[#18042A] ${bricolage.className}`}>
                                                    {blog.description}
                                                </span>
                                                <span className={`text-sm font-normal leading-tight mt-2 text-[#18042A] ${bricolage.className}`}>
                                                    99-99-9999
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                        <div id="popular" className="flex-[1] w-full">
                            <div id="popular-posts-container" className="flex flex-col p-2 border-[1px] border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden">
                                <h1 className={`text-[#18042A] font-semibold ${bricolage.className}`}>Popular Posts</h1>
                                <div className="w-full grid grid-cols-1 sm:grid-cols-1 md:grid-cols-1 gap-4">
                                    {view1Array.slice(0, 6).map((blog) => (
                                        <div id="editor-blog-container" className="flex flex-row w-full h-30 p-5 gap-3 border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden">
                                            <div id="editor-blog-image-container" className="w-20 h-full flex-shrink-0">
                                                <img src={blog.image} className="object-cover" />
                                            </div>
                                            <div id="editor-blog-text-container" className="flex flex-col justify-center">
                                                <span className={`text-md font-bold leading-tight text-[#18042A] ${bricolage.className}`}>
                                                    {blog.description}
                                                </span>
                                                <span className={`text-sm font-normal leading-tight mt-2 text-[#18042A] ${bricolage.className}`}>
                                                    99-99-9999
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div >
            <Footer />
        </>
    )
}
export default BlogPage;
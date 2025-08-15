import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Head from 'next/head';
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import Footer from "@/components/FooterSection/Footer";
import { prisma } from '@/lib/prisma';
import { GetStaticPaths, GetStaticProps } from 'next';



declare global {
    interface Window {
        particlesJS: {
            load: (tagId: string, path: string, callback?: () => void) => void;
        };
        pJSDom?: { pJS: Record<string, unknown> }[];
    }
}


type BlogPostProps = {
    title: string;
    content: string;
    image_url?: string;
    author: { name: string };
    published_date: string;
};

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });
const inter = Inter({ subsets: ["latin"] });
const tags: string[] = ["All Blog Posts", "Latest Blog Posts", "Lorem Ipsum", "Lorem Ipsum", "Lorem Ipsum", "Lorem Ipsum"]


const BlogViewPage = ({
    title,
    content,
    image_url,
    author,
    published_date,
}: BlogPostProps) => {

    const [tagSelected, setTagSelected] = useState(0);

    const initParticles = () => {
        if (typeof window !== 'undefined' && window.particlesJS) {
            window.particlesJS.load('particles-container', '/particles-config.json', () => {
                console.log('particles.js loaded - callback');
            });
        }
    };

    return (
        <>
            <Head>
                <title>Vierra | Blogs</title>
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
                                <h1 className={`text-5xl md:text-6xl font-bold leading-tight lg:mb-6 text-[#EFF3FF] ${bricolage.className}`}>
                                    {title ? title : "Blog not found."}
                                    {/* Lorem ipsum dolor sit amet, consectetur  */}
                                </h1>
                            </div>
                            <div id="blog-description" className="w-[70%]">
                                <p className={`text-[#9BAFC3] ${inter.className}`}>Scale your practice effortlessly. Fill out your schedules and eliminate no-shows. Scale your practice effortlessly. Fill out your schedules and eliminate no-show</p>
                            </div>
                            <div id="metadata-row" className="w-full h-auto mt-5 flex flex-wrap md:flex-row items-center gap-[24px]">
                                <p className={`text-[#9BAFC3] ${bricolage.className}`}>{`By ${author}`}</p>
                                <div id="tiny-ellipse" className="h-[4px] w-[4px] bg-[#9BAFC3] rounded-full"></div>
                                <p className={`text-[#9BAFC3] ${bricolage.className}`}>99-99-99</p>
                                <div id="tiny-ellipse" className="h-[4px] w-[4px] bg-[#9BAFC3] rounded-full"></div>
                                <div id="meta-colorbox">
                                    <span className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium">
                                        Lorem Ipsum
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </main>
                <div id="view-section" className="bg-[#F3F3F3] px-8 lg:px-20">
                    <div id="heading-image" className="w-full flex flex-col justify-center items-center py-20">
                        <img alt="blog image" src={image_url} className="min-w-full lg:min-w-[75%] max-h-[500px] aspect-auto" />
                    </div>
                    <div id="blog-text" className="lg:px-32 flex flex-col pb-20">
                        <div id="blog-text-heading">
                            <h1 className={`font-semibold text-[#18042A] text-3xl mb-3 ${bricolage.className}`}>
                                {title}
                                {/* We Are Not Your Average “Consultants” */}
                            </h1>
                        </div>
                        <div id="blog-text-content">
                            <p className={`text-[#8A9197]  md:text-lg/[180%] md:w-[50%] ${inter.className}`}>
                                {content}
                                {/* We reduce complexity by eliminating corporate formalities. We implement a clear-cut and simple approach to increasing the return on ad spending. Our team hand-picks clients so we can offer more leads and focus on your success. We reduce complexity by eliminating corporate formalities. We implement a clear-cut and simple approach to increasing the return on ad spending. Our team hand-picks clients so we can offer more leads and focus on your success. */}
                            </p>
                        </div>
                    </div>
                </div>
                {/* <div id="view-section" className="bg-[#F3F3F3] px-8 lg:px-20">
                    <div id="heading-image" className="w-full flex flex-col justify-center items-center pb-20">
                        <img alt="blog image" src="/assets/Team/Paul.png" className="min-w-full lg:min-w-[75%] max-h-[500px] aspect-auto" />
                    </div>
                    <div id="blog-text" className="lg:px-32 flex flex-col pb-20">
                        <div id="blog-text-heading">
                            <h1 className={`font-semibold text-[#18042A] text-3xl mb-3 ${bricolage.className}`}>We Are Not Your Average “Consultants”</h1>
                        </div>
                        <div id="blog-text-content">
                            <p className={`text-[#8A9197]  md:text-lg/[180%] md:w-[50%] ${inter.className}`}>
                                We reduce complexity by eliminating corporate formalities. We implement a clear-cut and simple approach to increasing the return on ad spending. Our team hand-picks clients so we can offer more leads and focus on your success. We reduce complexity by eliminating corporate formalities. We implement a clear-cut and simple approach to increasing the return on ad spending. Our team hand-picks clients so we can offer more leads and focus on your success.
                            </p>
                        </div>
                    </div>
                </div> */}
            </div>
            <Footer />
        </>
    )
}

export const getStaticPaths: GetStaticPaths = async () => {
    const posts = await prisma.blog_posts.findMany({
        select: { slug: true },
    });

    interface BlogPostPath {
        params: {
            slug: string;
        };
    }

    const paths: BlogPostPath[] = posts.map((post: { slug: string }) => ({
        params: { slug: post.slug },
    }));

    return { paths, fallback: 'blocking' };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
    const slug = params?.slug as string;

    const post = await prisma.blog_posts.findUnique({
        where: { slug },
        include: { authors: true },
    });

    if (!post) {
        return { notFound: true };
    }

    return {
        props: {
            title: post.title,
            content: post.content,
            imageUrl: post.imageUrl,
            author: { name: post.author.name },
            publishedDate: post.publishedDate.toISOString(),
        },
        revalidate: 60, // ISR: re-generate every 60s
    };
};


export default BlogViewPage;
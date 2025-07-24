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
import { FooterSection } from "@/components/FooterSection/MainComponent";
import { Modal } from "@/components/Modal";
import Main from "@/components/ServicesSection/Main";



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

const BlogPage: React.FC = () => {

    const [isModalOpen, setIsModalOpen] = useState(false);

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
                <title>Vierra | Blog</title>
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
                <div className="bg-[#E3DDE9] py-20">
                    <main className="relative px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
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
                            className="max-w-2xl"
                        >
                            <motion.h1
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    visible: {
                                        opacity: 1,
                                        y: 0,
                                        transition: {
                                            staggerChildren: 0.05,
                                            ease: "easeOut",
                                        },
                                    },
                                }}
                                className={`text-5xl md:text-6xl font-bold leading-tight mb-6 text-black ${bricolage.className}`}
                            >
                                {Array.from("Vierra Marketing Blog").map(
                                    (letter, index) => (
                                        <motion.span
                                            key={index}
                                            variants={{
                                                hidden: { opacity: 0, y: 20 },
                                                visible: { opacity: 1, y: 0 },
                                            }}
                                        >
                                            {letter}
                                        </motion.span>
                                    )
                                )}
                            </motion.h1>

                            <motion.p
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    visible: { opacity: 1, y: 0 },
                                }}
                                className={`text-[#646A69] text-lg mb-10 ${inter.className}`}
                            >
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                            </motion.p>
                        </motion.div>
                    </main>
                </div>

            </div>
        </>
    )
}
export default BlogPage;
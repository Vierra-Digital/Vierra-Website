import { Bricolage_Grotesque, Inter } from "next/font/google";
import Head from 'next/head';
import Script from 'next/script';
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import Footer from "@/components/FooterSection/Footer";
import SocialShareBar from "@/components/Blog/SocialShareBar";
import Link from "next/link";
import { prisma } from '@/lib/prisma';
import { GetStaticPaths, GetStaticProps } from 'next';

type BlogPostProps = {
    title: string;
    description?: string | null;
    content: string;
    author: { name: string };
    publishedDate: string;
    tag?: string | null;
    slug: string;
    relatedPosts: { title: string; slug: string; publishedDate: string; author: { name: string }; tag?: string | null; description?: string | null }[];
};

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });
const inter = Inter({ subsets: ["latin"] });

const formatDate = (dateString: string): string => {
    const dateStr = dateString.split('T')[0]; // Get YYYY-MM-DD part
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
    tag,
    slug,
    relatedPosts
}: BlogPostProps) => {

    const blogUrl = `https://vierradev.com/blog/${slug}`;
    const publishedDateISO = new Date(publishedDate).toISOString();
    const modifiedDateISO = new Date(publishedDate).toISOString();

    return (
        <>
            <Head>
                <title>{`Vierra | ${title}`}</title>
                <meta name="description" content={description || `${title} - Insights and strategies from Vierra to scale revenue and acquire more clients.`} />
                <meta name="keywords" content={tag ? tag.split(',').map(t => t.trim()).join(', ') : 'marketing, lead generation, business growth, digital marketing'} />
                <link rel="canonical" href={blogUrl} />
                
                
                <meta property="og:type" content="article" />
                <meta property="og:title" content={title} />
                <meta property="og:description" content={description || `${title} - Insights and strategies from Vierra.`} />
                <meta property="og:url" content={blogUrl} />
                <meta property="og:site_name" content="Vierra" />
                <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
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
                <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />
            </Head>
            <Script
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
            <Script
                id="schema-org-article"
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BlogPosting",
                        headline: title,
                        description: description || `${title} - Insights and strategies from Vierra.`,
                        image: "https://vierradev.com/assets/meta-banner.png",
                        datePublished: publishedDateISO,
                        dateModified: modifiedDateISO,
                        author: {
                            "@type": "Person",
                            name: author.name,
                        },
                        publisher: {
                            "@type": "Organization",
                            name: "Vierra Digital",
                            logo: {
                                "@type": "ImageObject",
                                url: "https://vierradev.com/assets/meta-banner.png",
                            },
                        },
                        mainEntityOfPage: {
                            "@type": "WebPage",
                            "@id": blogUrl,
                        },
                        keywords: tag || "marketing, lead generation, business growth",
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
                            <div id="header-text-holder" className="my-4 max-w-3xl mb-5">
                                <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold leading-tight lg:mb-6 text-[#EFF3FF] ${bricolage.className}`}>
                                    {title ? title : "Blog not found."}
                                </h1>
                            </div>
                            <div id="blog-description" className="max-w-3xl">
                                <p className={`text-[#C7D2FE] text-base md:text-lg ${inter.className}`}>{description ?? ""}</p>
                            </div>
                            <div id="metadata-row" className="w-full h-auto mt-5 flex flex-wrap md:flex-row items-center gap-3 text-sm md:text-base">
                                <p className={`text-[#E5E7EB] ${bricolage.className}`}>
                                    By{" "}
                                    <Link href={`/blog/author/${encodeURIComponent(author.name)}`} className="hover:text-[#C7D2FE]">
                                        {author.name}
                                    </Link>
                                </p>
                                <div className="h-[4px] w-[4px] bg-[#9BAFC3] rounded-full"></div>
                                <p className={`text-[#E5E7EB] ${bricolage.className}`}>{formatDate(publishedDate)}</p>
                                {tag && (
                                    <>
                                        <div className="h-[4px] w-[4px] bg-[#9BAFC3] rounded-full"></div>
                                        <div className="flex flex-wrap gap-1">
                                            {tag.split(',').map((t, index) => (
                                                <Link key={index} href={`/blog/tag/${encodeURIComponent(t.trim())}`}>
                                                    <span className="bg-purple-600/90 text-white px-3 py-1 rounded-md text-xs md:text-sm font-medium hover:bg-purple-600">
                                                        {t.trim()}
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </main>
                <div id="view-section" className="bg-white px-6 md:px-8 lg:px-20">
                    <div id="blog-text" className="flex flex-col pb-16 md:pb-20 items-center pt-12 md:pt-16 lg:pt-20">
                        <div id="blog-text-content" className="w-full max-w-3xl">
                            <div className={`text-[#1F2937] text-base md:text-lg leading-relaxed ${inter.className}`}>
                                <style jsx global>{`
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
                                `}</style>
                                <div dangerouslySetInnerHTML={{ __html: content }} />
                            </div>
                        </div>
                    </div>
                </div>
                {relatedPosts.length > 0 && (
                    <div className="bg-[#F3F4F6] px-6 md:px-8 lg:px-20">
                        <div className="max-w-5xl mx-auto py-16">
                            <h2 className={`text-2xl md:text-3xl font-semibold text-[#111827] mb-6 ${bricolage.className}`}>Related Posts</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {relatedPosts.map((post) => (
                                    <Link key={post.slug} href={`/blog/${post.slug}`} className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm hover:shadow-md transition-shadow">
                                        <div className={`text-lg font-semibold text-[#111827] ${bricolage.className}`}>{post.title}</div>
                                        <div className="mt-2 text-xs text-[#6B7280] flex items-center gap-2">
                                            <span>By {post.author?.name ?? "Unknown"}</span>
                                            <div className="h-1 w-1 bg-gray-400 rounded-full"></div>
                                            <span>{formatDate(post.publishedDate)}</span>
                                        </div>
                                        <p className={`mt-3 text-sm text-[#475569] ${inter.className}`}>
                                            {post.description || ""}
                                        </p>
                                        {post.tag && (
                                            <div className="mt-3 flex flex-wrap gap-1">
                                                {post.tag.split(',').map((t, index) => (
                                                    <span key={index} className="text-[10px] md:text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                                                        {t.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                <SocialShareBar 
                  url={`${process.env.NODE_ENV === 'production' ? 'https://vierra.com' : 'http://localhost:3000'}/blog/${slug}`}
                  title={title}
                  description={description || undefined}
                />
            </div>
            <Footer />
        </>
    )
}

export const getStaticPaths: GetStaticPaths = async () => {
    try {
    const posts = await prisma.blogPost.findMany({
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
    } catch (error) {
        // Next.js will use fallback mode and generate pages at runtime
        console.warn('Database unavailable during static path generation, using fallback mode:', error);
        return { paths: [], fallback: 'blocking' };
    }
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
    const slug = params?.slug as string;

    try {
    const post = await prisma.blogPost.findUnique({
        where: { slug },
        include: { author: true },
    });

    if (!post) {
        return { notFound: true };
    }

    const tagList = post.tag ? post.tag.split(',').map(t => t.trim()).filter(Boolean) : [];
    const relatedPosts = await prisma.blogPost.findMany({
        where: {
            AND: [
                { slug: { not: post.slug } },
                {
                    OR: [
                        ...(tagList.length ? tagList.map(t => ({ tag: { contains: t, mode: 'insensitive' as const } })) : []),
                        { author: { name: post.author.name } }
                    ]
                }
            ]
        },
        include: { author: true },
        orderBy: { published_date: 'desc' },
        take: 4,
    });

    return {
        props: {
            title: post.title,
            description: (post as any).description ?? null,
            content: post.content,
            author: { name: post.author.name },
            publishedDate: post.published_date.toISOString(),
            tag: post.tag,
            slug: post.slug,
            relatedPosts: relatedPosts.map(p => ({
                title: p.title,
                slug: p.slug,
                publishedDate: p.published_date.toISOString(),
                author: { name: p.author.name },
                tag: p.tag ?? null,
                description: (p as any).description ?? null,
            }))
        },
        revalidate: 60,
    };
    } catch (error) {
        // This allows the build to complete, and the page will be generated at runtime
        console.warn('Database unavailable during static props generation:', error);
        return { notFound: true };
    }
};

export default BlogViewPage;
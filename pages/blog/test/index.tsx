import React, { useEffect, useMemo, useState } from "react"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import Head from "next/head"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/Header"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import Footer from "@/components/FooterSection/Footer"
import type { GetServerSideProps } from "next"
import Link from "next/link"

type BlogPostType = {
  id: number
  title: string
  description?: string | null
  content: string
  published_date: string
  slug: string
  is_test: boolean
  tag?: string | null
  author: { name: string }
}

type Props = { posts: BlogPostType[] }

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const posts = await prisma.blogPost.findMany({
    where: { is_test: true, published_date: { gte: cutoff } },
    orderBy: { published_date: "desc" },
    include: { author: { select: { name: true } } },
  })
  return {
    props: {
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        content: p.content,
        published_date: p.published_date.toISOString(),
        slug: p.slug,
        is_test: Boolean(p.is_test),
        tag: p.tag,
        author: { name: p.author.name },
      })),
    },
  }
}

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })
const tags: string[] = [
  "All Test Posts",
  "Case Studies",
  "Technology",
  "AI & Automation",
  "Finance",
  "Marketing",
  "Sales",
  "Management",
  "Leadership",
]

const stripHtml = (html?: string | null): string => {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

const getExcerpt = (content?: string | null, limit = 260): string => {
  const text = stripHtml(content)
  if (text.length <= limit) return text
  return text.slice(0, limit).trimEnd() + "..."
}

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return ""
  const dateStr = dateString.split("T")[0]
  const [year, month, day] = dateStr.split("-")
  return `${month}/${day}/${year}`
}

export default function TestBlogsPage({ posts }: Props) {
  const [tagSelected, setTagSelected] = useState(0)
  const [tagSelectedName, setTagSelectedName] = useState("All Test Posts")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [list, setList] = useState<BlogPostType[]>(posts)
  const pageSize = 6

  const filtered = useMemo(() => {
    const byTag = (list: BlogPostType[]) => {
      if (tagSelectedName === "All Test Posts") return list
      return list.filter((post) => post.tag && post.tag.split(",").map((t) => t.trim()).includes(tagSelectedName))
    }
    const bySearch = (list: BlogPostType[]) => {
      const q = searchQuery.trim().toLowerCase()
      if (!q) return list
      return list.filter((p) =>
        [p.title, p.description ?? "", stripHtml(p.content), p.author?.name ?? "", p.tag ?? ""]
          .some((v) => v.toLowerCase().includes(q))
      )
    }
    return bySearch(byTag(list))
  }, [list, tagSelectedName, searchQuery])

  useEffect(() => { setCurrentPage(1) }, [tagSelectedName, searchQuery])

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleTagSwitch = (index: number) => {
    setTagSelected(index)
    setTagSelectedName(tags[index])
  }

  const makeLive = async (p: BlogPostType) => {
    try {
      const r = await fetch('/api/blog/admin/post', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: p.id,
          title: p.title,
          description: p.description,
          content: p.content,
          tag: p.tag,
          date: p.published_date.slice(0,10),
          authorName: p.author?.name,
          isTest: false,
        })
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setList(prev => prev.filter(x => x.id !== p.id))
    } catch (e) {
      console.error('make live failed', e)
    }
  }

  return (
    <>
      <Head>
        <title>Vierra | Test Blogs</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-[#18042A] text-white relative overflow-hidden z-0">
        <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: -20 }, visible: { opacity: 1, y: 0 } }}>
          <Header />
        </motion.div>

        <main className="relative px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-10">
          <motion.div className="absolute top-[7%] left-[10%] w-[470px] h-[470px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] -z-20" />
          <motion.div className="absolute -bottom-[32%] -right-[3%] w-[545px] h-[545px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] -z-20" />

          <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.2, ease: "easeOut" } } }}>
            <div id="control-section" className="p-8 w-full lg:p-20">
              <div className="my-4 max-w-2xl mb-5">
                <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold leading-tight lg:mb-6 text-[#EFF3FF] ${bricolage.className}`}>Test Blog Posts</h1>
              </div>
              <div className="w-full h-auto flex flex-col lg:flex-row justify-between">
                <div className={`text-[#9BAFC3] text-base md:text-lg mb-10 max-w-2xl ${inter.className}`}>
                  <p>Temporary posts for review. Links expire after ~24 hours.</p>
                </div>
                <div className="flex w-full lg:w-[556px]">
                  <div className="w-full h-12 md:h-14 rounded-lg bg-white border border-gray-200 flex items-center px-4 gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <Search className="h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search test posts"
                      className={`w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-500 text-sm md:text-base ${inter.className}`}
                    />
                  </div>
                </div>
              </div>
              <div className="w-full h-auto mt-5 flex flex-wrap gap-3">
                {tags.map((tag, index) => (
                  <Button
                    key={index}
                    className={index === tagSelected ? `bg-[#701CC0] hover:bg-[#5a1799] text-[#EFF3FF] border-none px-4 py-2` : `bg-transparent text-[#F3F3F3] border rounded-lg border-[#F3F3F3] hover:text-[#EFF3FF] hover:bg-[#701CC0] hover:border-[#701CC0] px-4 py-2`}
                    onClick={() => handleTagSwitch(index)}
                  >
                    <p className={`text-sm md:text-base ${bricolage.className}`}>{tag}</p>
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        </main>

        <div id="view-section" className="bg-[#F3F3F3] px-8 lg:px-20">
          <div className="max-w-7xl mx-auto py-20">
            <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold leading-tight mb-6 text-[#18042A] ${bricolage.className}`}>Active Test Posts</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {paginated.map((blog) => (
                <div key={blog.id}>
                  <Link href={`/blog/test/${blog.slug}`} passHref>
                    <div className="rounded-2xl bg-white p-5 md:p-6 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer">
                      <h3 className={`text-base md:text-lg font-bold text-[#0F172A] ${bricolage.className}`}>{blog.title}</h3>
                      <div className="mt-1 text-[11px] md:text-xs text-[#334155] flex items-center gap-2">
                        <span>{blog.published_date ? formatDate(blog.published_date) : ""}</span>
                        <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-[10px]">Test</span>
                      </div>
                      <p className={`mt-3 text-sm md:text-base text-[#475569] ${inter.className}`}>{blog.description || getExcerpt(blog.content)}</p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {blog.tag ? (
                          blog.tag.split(",").map((tag, i) => (
                            <span key={i} className="text-[10px] md:text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">{tag.trim()}</span>
                          ))
                        ) : (
                          <span className="text-[10px] md:text-xs font-semibold text-purple-600">Blog</span>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[#701CC0] font-semibold text-sm md:text-base">View</span>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-2">
                    <button onClick={() => makeLive(blog)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700">Make Live</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-10">
              <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm md:text-base shadow-[0px_4px_15.9px_0px_#701CC061] hover:bg-[#5f17a5] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#701CC0]/50">Previous</button>
              <span className="text-[#9BAFC3] text-sm md:text-base">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm md:text-base shadow-[0px_4px_15.9px_0px_#701CC061] hover:bg-[#5f17a5] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#701CC0]/50">Next</button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}



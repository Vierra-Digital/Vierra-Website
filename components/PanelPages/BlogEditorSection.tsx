import React, { useEffect, useMemo, useRef, useState } from "react"
import { Inter } from "next/font/google"
import { FiPlus, FiFileText, FiFilter, FiSearch, FiEdit2, FiTrash2 } from "react-icons/fi"
import ConfirmActionModal from "@/components/ui/ConfirmActionModal"
import RowActionMenu, { RowActionMenuItem } from "@/components/ui/RowActionMenu"
import RichTextEditor from "@/components/ui/RichTextEditor"

const inter = Inter({ subsets: ["latin"] })

type Post = {
  id: number
  title: string
  description?: string | null
  content: string
  tag?: string | null
  published_date: string
  author: { name: string }
}

export default function BlogEditorSection() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<{ id: number; title: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 6
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const [dateSort, setDateSort] = useState<'none' | 'asc' | 'desc'>('none')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [authorFilter, setAuthorFilter] = useState<string>('all')
  const [form, setForm] = useState({
    id: 0,
    title: "",
    description: "",
    content: "",
    tag: "",
    date: "",
    authorName: "",
  })
  const [mode, setMode] = useState<"list" | "edit">("list")
  const [search, setSearch] = useState("")
  const isEditing = useMemo(() => form.id > 0, [form.id])

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const r = await fetch(`/api/blog/posts?page=1&limit=50`)
        const data = await r.json()
        const mapped: Post[] = data.posts
          .map((p: any) => ({
            ...p,
            published_date: new Date(p.published_date).toISOString(),
          }))
        setPosts(mapped)
      } catch (e: any) {
        setError(e?.message ?? "Failed to load posts")
      } finally {
        setLoading(false)
      }
    })()
  }, [])


  useEffect(() => {
    setCurrentPage(1)
  }, [search, dateSort, tagFilter, authorFilter])

  const resetForm = () =>
    setForm({ id: 0, title: "", description: "", content: "", tag: "", date: "", authorName: "" })

  const savePost = async () => {
    try {
      const method = isEditing ? "PUT" : "POST"
      const r = await fetch("/api/blog/admin/post", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing ? { id: form.id } : {}),
          title: form.title,
          description: form.description || null,
          content: form.content,
          date: form.date || null,
          tag: form.tag || null,
          authorName: form.authorName || undefined,
        }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      resetForm()
      const list = await fetch(`/api/blog/posts?page=1&limit=50`).then((x) => x.json())
      setPosts(list.posts)
      setMode("list")
    } catch (e: any) {
      setError(e?.message ?? "Save failed")
    }
  }

  const deletePost = async (id: number) => {
    try {
      const r = await fetch(`/api/blog/admin/post?id=${id}`, { method: "DELETE" })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setPosts((prev) => prev.filter((p) => p.id !== id))
      setDeleteModalOpen(false)
      setPostToDelete(null)
    } catch (e: any) {
      setError(e?.message ?? "Delete failed")
    }
  }

  const openDeleteModal = (post: { id: number; title: string }) => {
    setPostToDelete(post)
    setDeleteModalOpen(true)
  }

  const headerBar = (
    <>
      <div className="w-full flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Blog Editor</h1>
        </div>
        <div className="flex items-center gap-3">
        {mode === "list" && (
          <>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                        <FiSearch className="w-4 h-4 text-[#701CC0] flex-shrink-0" />
                        <label htmlFor="blog-search" className="sr-only">Search Posts</label>
                                                    <input
                            id="blog-search"
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search Posts"
                            className="w-64 md:w-80 text-sm text-[#111827] placeholder:text-[#9CA3AF] bg-transparent outline-none"
                        />
                    </div>
                    <div className="relative" ref={filterRef} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFilterOpen(false) }} tabIndex={-1}>
                                                    <button
                            type="button"
                            onClick={() => setFilterOpen((v) => !v)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#701CC0] transition-colors duration-200 shadow-sm"
                        >
                            <FiFilter className="w-4 h-4" />
                            <span className="text-sm font-medium">Filter</span>
                            <svg 
                                className={`w-4 h-4 transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                                                    </button>
                        {filterOpen && (
                            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-[#E5E7EB] py-4 z-50">
                                <div className="px-5">
                                    <h3 className="text-sm font-semibold text-[#111827] mb-4">Sort & Filter</h3>
                                    
                                    
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Sort By Date</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDateSort("asc")
                                                    setCurrentPage(1)
                                                }}
                                                className={`flex-1 text-xs py-2 px-3 rounded-lg font-medium transition-colors duration-200 ${
                                                    dateSort === "asc"
                                                        ? "bg-[#701CC0] text-white shadow-sm"
                                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                }`}
                                            >
                                                Ascending
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDateSort("desc")
                                                    setCurrentPage(1)
                                                }}
                                                className={`flex-1 text-xs py-2 px-3 rounded-lg font-medium transition-colors duration-200 ${
                                                    dateSort === "desc"
                                                        ? "bg-[#701CC0] text-white shadow-sm"
                                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                }`}
                                            >
                                                Descending
                                            </button>
                                        </div>
                                    </div>

                                    
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Tag</label>
                                        <div className="relative">
                                            <select
                                                value={tagFilter}
                                                onChange={(e) => {
                                                    setTagFilter(e.target.value)
                                                    setCurrentPage(1)
                                                }}
                                                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none"
                                            >
                                                <option value="all">All Tags</option>
                                                {Array.from(new Set(posts.flatMap(p => p.tag ? p.tag.split(',').map(t => t.trim()) : []).filter(Boolean))).map(tag => (
                                                    <option key={tag} value={tag}>{tag}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Author</label>
                                        <div className="relative">
                                            <select
                                                value={authorFilter}
                                                onChange={(e) => {
                                                    setAuthorFilter(e.target.value)
                                                    setCurrentPage(1)
                                                }}
                                                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none"
                                            >
                                                <option value="all">All Authors</option>
                                                {Array.from(new Set(posts.map(p => p.author?.name).filter(Boolean))).map(author => (
                                                    <option key={author} value={author}>{author}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    
                                    <div className="pt-3 border-t border-[#E5E7EB]">
                                        <button
                                            onClick={() => {
                                                setSearch("")
                                                setDateSort("none")
                                                setTagFilter("all")
                                                setAuthorFilter("all")
                                                setCurrentPage(1)
                                                setFilterOpen(false)
                                            }}
                                            className="w-full text-xs py-2 px-3 rounded-lg font-medium text-[#6B7280] bg-gray-50 hover:bg-gray-100 hover:text-[#374151] transition-colors duration-200"
                                        >
                                            Clear All Filters
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                                                    <button
                        onClick={() => { resetForm(); setMode("edit") }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] text-sm font-medium"
                    >
                        <FiPlus className="w-4 h-4" />
                        New Blog
                                                    </button>
          </>
        )}
        {mode === "edit" && (
          <button
            onClick={() => { resetForm(); setMode("list") }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm font-medium text-[#374151] hover:bg-gray-50"
          >
            Back To Posts
          </button>
        )}
        </div>
      </div>
    </>
  )

  const filteredPosts = useMemo(() => {
    let filtered = posts
    const q = search.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter((p) =>
        [p.title, p.description ?? "", p.tag ?? "", p.author?.name ?? ""].some((v) => v.toLowerCase().includes(q))
      )
    }
    if (tagFilter !== 'all') {
      filtered = filtered.filter((p) => p.tag && p.tag.split(',').map(t => t.trim()).includes(tagFilter))
    }
    if (authorFilter !== 'all') {
      filtered = filtered.filter((p) => p.author?.name === authorFilter)
    }
    if (dateSort !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        const dateA = new Date(a.published_date).getTime()
        const dateB = new Date(b.published_date).getTime()
        return dateSort === 'asc' ? dateA - dateB : dateB - dateA
      })
    }

    return filtered
  }, [posts, search, dateSort, tagFilter, authorFilter])

  const totalPages = Math.ceil(filteredPosts.length / pageSize) || 1
  const paginatedPosts = filteredPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const containerPadding = mode === "edit"
    ? "pb-40 md:pb-56 lg:pb-72 xl:pb-96"
    : "pb-32 md:pb-48 lg:pb-64 xl:pb-96"

  return (
    <>
    <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${containerPadding} ${inter.className}`}>
      <div className="flex-1 flex justify-center px-6 pt-2">
        <div className="w-full max-w-6xl flex flex-col h-full">
        {headerBar}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
      )}

      {mode === "list" && (
        loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#701CC0] mx-auto"></div>
              <p className="mt-2 text-sm text-[#6B7280]">Loading Blog Data...</p>
            </div>
          </div>
        ) : paginatedPosts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-10">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#F3E8FF] flex items-center justify-center mb-4">
                <FiFileText className="w-7 h-7 text-[#701CC0]" />
              </div>
              <h3 className="text-lg font-semibold text-[#111827]">No Blog Posts Found</h3>
              <p className="text-sm text-[#6B7280] mt-2 max-w-md">
                Create your first post to start building your content library.
              </p>
              <button
                onClick={() => { resetForm(); setMode("edit") }}
                className="mt-5 inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#4C1D95]"
              >
                <FiPlus className="w-4 h-4 mr-2" />
                New Blog
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Author</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Tags</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wider">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#E5E7EB]">
                    {paginatedPosts.map((p) => (
                      <tr key={p.id} className="hover:bg-purple-50">
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-[#111827]">{p.title}</div>
                          <div className="text-xs text-[#6B7280] mt-1 line-clamp-2">{p.description}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#111827]">
                          {p.author?.name ?? "Unknown"}
                        </td>
                        <td className="px-4 py-4 text-sm text-[#111827]">
                          {(() => {
                            const dateStr = p.published_date.split('T')[0]
                            const [year, month, day] = dateStr.split('-')
                            return `${month}/${day}/${year}`
                          })()}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {p.tag ? (
                            <div className="flex flex-wrap gap-1">
                              {p.tag.split(',').map((tag, index) => (
                                <span key={index} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                  {tag.trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[#9CA3AF]">No tags</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="inline-flex justify-end">
                            <RowActionMenu label="Manage post" menuWidthClassName="w-44">
                              <RowActionMenuItem
                                onClick={() => {
                                  setForm({
                                    id: p.id,
                                    title: p.title,
                                    description: p.description ?? "",
                                    content: p.content,
                                    tag: p.tag ?? "",
                                    date: p.published_date.slice(0, 10),
                                    authorName: p.author?.name ?? "",
                                  })
                                  setMode("edit")
                                }}
                                icon={<FiEdit2 className="w-4 h-4" />}
                                tone="accent"
                              >
                                Edit
                              </RowActionMenuItem>
                              <RowActionMenuItem
                                onClick={() => openDeleteModal({ id: p.id, title: p.title })}
                                icon={<FiTrash2 className="w-4 h-4" />}
                                tone="danger"
                              >
                                Delete
                              </RowActionMenuItem>
                            </RowActionMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {filteredPosts.length > pageSize && (
              <div className="flex items-center justify-center gap-2 mt-4 py-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded border border-[#E5E7EB] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-[#6B7280]">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded border border-[#E5E7EB] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )
      )}

      {mode === "edit" && (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-[#EDE6FB] p-5">
            <div className="text-base md:text-lg font-semibold text-[#111827] mb-4">Post Details</div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-2">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none" placeholder="Blog Title" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-2">Author</label>
                <input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none" placeholder="Blog Author" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-2">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-2">Tags</label>
                <input 
                  value={form.tag} 
                  onChange={(e) => setForm({ ...form, tag: e.target.value })} 
                  className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none" 
                  placeholder="Marketing, SEO, Analytics" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-2">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none" rows={4} placeholder="Short summary shown in cards and under title" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-[#EDE6FB] p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-base md:text-lg font-semibold text-[#111827]">Content</div>
              </div>
              <div className="flex gap-2">
                <button onClick={savePost} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#701CC0] text-white hover:bg-[#4C1D95]">{isEditing ? "Update Blog" : "Create Post"}</button>
                <button onClick={() => { resetForm(); setMode("list") }} className="px-4 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 bg-red-50 hover:bg-red-100">Cancel</button>
              </div>
            </div>
            <RichTextEditor
              value={form.content}
              onChange={(value) => setForm({ ...form, content: value })}
            />
          </div>
        </div>
      )}
        </div>
      </div>
      </div>

      <ConfirmActionModal
        isOpen={deleteModalOpen}
        title="Delete Blog Post"
        message={
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-[#111827]">&ldquo;{postToDelete?.title || ""}&rdquo;</span>? This action is
            permanent and cannot be undone. All associated data will be removed.
          </>
        }
        confirmLabel="Delete Post"
        onConfirm={() => postToDelete && deletePost(postToDelete.id)}
        onCancel={() => {
          setDeleteModalOpen(false)
          setPostToDelete(null)
        }}
      />
    </>
  )
}


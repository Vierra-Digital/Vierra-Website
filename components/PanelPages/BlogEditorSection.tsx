import React, { useEffect, useMemo, useState } from "react"
import { Inter, Bricolage_Grotesque } from "next/font/google"
import { CiSearch } from "react-icons/ci"

const inter = Inter({ subsets: ["latin"] })
const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })

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
  const [, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        const r = await fetch(`/api/blog/posts?page=1&limit=50&sortBy=latest`)
        const data = await r.json()
        setPosts(
          data.posts.map((p: any) => ({
            ...p,
            published_date: new Date(p.published_date).toISOString(),
          }))
        )
      } catch (e: any) {
        setError(e?.message ?? "Failed to load posts")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const resetForm = () =>
    setForm({ id: 0, title: "", description: "", content: "", tag: "", date: "", authorName: "" })

  const savePost = async () => {
    setLoading(true)
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
      // reload
      const list = await fetch(`/api/blog/posts?page=1&limit=50&sortBy=latest`).then((x) => x.json())
      setPosts(list.posts)
      setMode("list")
    } catch (e: any) {
      setError(e?.message ?? "Save failed")
    } finally {
      setLoading(false)
    }
  }

  const deletePost = async (id: number) => {
    if (!confirm("Delete this post?")) return
    setLoading(true)
    try {
      const r = await fetch(`/api/blog/admin/post?id=${id}`, { method: "DELETE" })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setPosts((prev) => prev.filter((p) => p.id !== id))
    } catch (e: any) {
      setError(e?.message ?? "Delete failed")
    } finally {
      setLoading(false)
    }
  }

  const headerBar = (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between mt-6 mb-4 gap-3">
      <h2 className={`text-2xl md:text-3xl font-bold text-[#111827] ${bricolage.className}`}>Blog Editor</h2>
      <div className="flex items-center gap-3">
        {mode === "list" && (
          <>
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition w-64 md:w-80">
              <CiSearch className="w-5 h-5 text-[#701CC0] flex-shrink-0" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search posts"
                className={`flex-1 text-sm placeholder:text-[#9CA3AF] bg-transparent outline-none text-[#111827] ${inter.className}`}
              />
            </div>
            <button onClick={() => { resetForm(); setMode("edit") }} className="px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm shadow-[0px_4px_15.9px_0px_#701CC061] hover:bg-[#5f17a5]">Add New</button>
          </>
        )}
        {mode === "edit" && (
          <button onClick={() => { resetForm(); setMode("list") }} className="px-4 py-2 rounded-lg bg-white border text-sm">Back to List</button>
        )}
      </div>
    </div>
  )

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return posts
    return posts.filter((p) =>
      [p.title, p.description ?? "", p.tag ?? "", p.author?.name ?? ""].some((v) => v.toLowerCase().includes(q))
    )
  }, [search, posts])

  return (
    <div className="w-full pr-4 md:pr-8 pb-16">
      {headerBar}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
      )}

      {mode === "list" && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosts.map((p) => (
              <div key={p.id} className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 hover:bg-white hover:border-[#C7B1FF] hover:shadow-[0_0_0_2px_rgba(112,28,192,0.12)] transition">
                <div className="text-base md:text-lg font-semibold text-[#111827]">{p.title}</div>
                <div className="text-xs text-[#6B7280] mt-1">{new Date(p.published_date).toLocaleDateString()}</div>
                <div className="text-sm text-[#6B7280] mt-2">{p.description}</div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setForm({
                    id: p.id,
                    title: p.title,
                    description: p.description ?? "",
                    content: p.content,
                    tag: p.tag ?? "",
                    date: p.published_date.slice(0,10),
                    authorName: p.author?.name ?? "",
                  }); setMode("edit"); }} className="px-3 py-1 text-xs rounded-lg bg-white border">Edit</button>
                  <button onClick={() => deletePost(p.id)} className="px-3 py-1 text-xs rounded-lg bg-red-50 text-red-700">Delete</button>
                </div>
              </div>
            ))}
            {filteredPosts.length === 0 && (
              <div className="text-sm text-[#6B7280]">No posts found</div>
            )}
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#6B7280] mb-1">Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-md px-3 py-2 text-base text-[#111827] placeholder-[#9CA3AF]" placeholder="Blog Title" />
            </div>
            <div>
              <label className="block text-sm text-[#6B7280] mb-1">Author</label>
              <input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-base text-[#111827] placeholder-[#9CA3AF]" placeholder="Blog Author" />
            </div>
            <div>
              <label className="block text-sm text-[#6B7280] mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border rounded-md px-3 py-2 text-base text-[#111827]" />
            </div>
            <div>
              <label className="block text-sm text-[#6B7280] mb-1">Tag</label>
              <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} className="w-full border rounded-md px-3 py-2 text-base text-[#111827] placeholder-[#9CA3AF]" placeholder="Marketing" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm text-[#6B7280] mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-md px-3 py-2 text-base text-[#111827] placeholder-[#9CA3AF]" rows={3} placeholder="Short summary shown in cards and under title" />
          </div>
          {/* Image URL removed as per request */}
          <div className="mt-4">
            <label className="block text-sm text-[#6B7280] mb-1">Content (HTML supported)</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full border rounded-md px-3 py-2 text-base font-mono text-[#111827] placeholder-[#9CA3AF]" rows={10} placeholder="<p>Your blog content...</p>" />
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={savePost} className="px-4 py-2 rounded-md bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]">{isEditing ? "Update Post" : "Create Post"}</button>
            <button onClick={() => { resetForm(); setMode("list") }} className="px-4 py-2 rounded-md bg-white border text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}


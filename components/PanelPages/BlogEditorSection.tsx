import React, { useEffect, useMemo, useState } from "react"
import { Inter } from "next/font/google"
import { CiSearch } from "react-icons/ci"
import { FiPlus, FiTrash2, FiFileText, FiFilter, FiBold, FiItalic, FiList, FiLink, FiCode, FiUnderline, FiImage, FiVideo, FiCornerUpLeft, FiCornerUpRight } from "react-icons/fi"

const inter = Inter({ subsets: ["latin"] })

const RichTextEditor: React.FC<{
  value: string
  onChange: (value: string) => void
}> = ({ value, onChange }) => {
  const [history, setHistory] = useState<string[]>([value])
  const [historyIndex, setHistoryIndex] = useState(0)

  // Update history when value changes
  useEffect(() => {
    if (value !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(value)
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    }
  }, [value, history, historyIndex])

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      onChange(history[newIndex])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      onChange(history[newIndex])
    }
  }

  const formatText = (format: string) => {
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    let newText = ''

    switch (format) {
      case 'bold':
        newText = `<strong>${selectedText || 'bold text'}</strong>`
        break
      case 'italic':
        newText = `<em>${selectedText || 'italic text'}</em>`
        break
      case 'code':
        newText = `<code>${selectedText || 'code'}</code>`
        break
      case 'link':
        newText = `<a href="url">${selectedText || 'link text'}</a>`
        break
      case 'list':
        const lines = value.split('\n')
        const currentLine = lines.findIndex((_, i) => {
          const lineStart = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0)
          return start >= lineStart && start <= lineStart + lines[i].length
        })
        if (currentLine >= 0) {
          lines[currentLine] = `<li>${lines[currentLine]}</li>`
          newText = lines.join('\n')
        } else {
          newText = value + '\n<li>List item</li>'
        }
        break
      case 'underline':
        newText = `<u>${selectedText || 'underlined text'}</u>`
        break
      case 'image':
        const imgTextarea = document.getElementById('content-editor') as HTMLTextAreaElement
        if (!imgTextarea) return
        const imgStart = imgTextarea.selectionStart
        const imgEnd = imgTextarea.selectionEnd
        const imgTag = '<img src="IMAGE_URL_HERE" alt="alt text" />'
        const imgBefore = value.substring(0, imgStart)
        const imgAfter = value.substring(imgEnd)
        onChange(imgBefore + imgTag + imgAfter)
        setTimeout(() => {
          imgTextarea.focus()
          imgTextarea.setSelectionRange(imgStart + imgTag.length, imgStart + imgTag.length)
        }, 0)
        return
      case 'video':
        const videoTextarea = document.getElementById('content-editor') as HTMLTextAreaElement
        if (!videoTextarea) return
        const videoStart = videoTextarea.selectionStart
        const videoEnd = videoTextarea.selectionEnd
        const videoTag = '<video controls><source src="VIDEO_URL_HERE" type="video/mp4">Your browser does not support the video tag.</video>'
        const videoBefore = value.substring(0, videoStart)
        const videoAfter = value.substring(videoEnd)
        onChange(videoBefore + videoTag + videoAfter)
        setTimeout(() => {
          videoTextarea.focus()
          videoTextarea.setSelectionRange(videoStart + videoTag.length, videoStart + videoTag.length)
        }, 0)
        return
    }

    if (format === 'list') {
      onChange(newText)
    } else {
      const before = value.substring(0, start)
      const after = value.substring(end)
      onChange(before + newText + after)
    }

    // Focus back to textarea
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + newText.length, start + newText.length)
    }, 0)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const files = Array.from(e.dataTransfer.files)
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        const imgTag = `<img src="${url}" alt="${file.name}" />`
        const before = value.substring(0, start)
        const after = value.substring(end)
        onChange(before + imgTag + after)
      } else if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file)
        const videoTag = `<video controls><source src="${url}" type="${file.type}">Your browser does not support the video tag.</video>`
        const before = value.substring(0, start)
        const after = value.substring(end)
        onChange(before + videoTag + after)
      }
    })
  }

  return (
    <div className="border border-[#D1D5DB] rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-[#D1D5DB] px-3 py-2 flex items-center gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={historyIndex <= 0}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Undo"
        >
          <FiCornerUpLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Redo"
        >
          <FiCornerUpRight className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          type="button"
          onClick={() => formatText('bold')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
          title="Bold"
        >
          <FiBold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('italic')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
          title="Italic"
        >
          <FiItalic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('code')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
          title="Code"
        >
          <FiCode className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('link')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
          title="Link"
        >
          <FiLink className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('list')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
          title="List"
        >
          <FiList className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('underline')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
          title="Underline"
        >
          <FiUnderline className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('image')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
          title="Image"
        >
          <FiImage className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('video')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
          title="Video"
        >
          <FiVideo className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div 
        className="min-h-[300px]"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <textarea
          id="content-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-[300px] p-4 bg-white border-0 resize-none outline-none font-mono text-sm text-[#111827]"
          placeholder="Enter your HTML content here... (You can also drag and drop images/videos)"
        />
      </div>
    </div>
  )
}

const ConfirmDeleteModal: React.FC<{
  isOpen: boolean
  postTitle: string
  onConfirm: () => void
  onCancel: () => void
}> = ({ isOpen, postTitle, onConfirm, onCancel }) => {
  if (!isOpen) return null

    return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <FiTrash2 className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-[#111827]">Delete Blog Post</h3>
        </div>
        <p className="text-sm text-[#6B7280] mb-6">
          Are you sure you want to delete <span className="font-semibold text-[#111827]">&ldquo;{postTitle}&rdquo;</span>? 
          This action is permanent and cannot be undone. All associated data will be removed.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
          >
            Delete Post
          </button>
        </div>
      </div>
        </div>
    )
}

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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<{ id: number; title: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 6
  const [filterOpen, setFilterOpen] = useState(false)
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

  useEffect(() => {
    setCurrentPage(1)
  }, [search, dateSort, tagFilter, authorFilter])

  const resetForm = () =>
    setForm({ id: 0, title: "", description: "", content: "", tag: "", date: "", authorName: "" })

  const savePost = async () => {
    setLoading(true)
    try {
      // Convert markdown to HTML
      const convertMarkdownToHtml = (markdown: string): string => {
        const html = markdown
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code>$1</code>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
          .replace(/^- (.*$)/gim, '<li>$1</li>')
          .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')
          .replace(/\n\n/g, '</p><p>')
        
        // Wrap lines that don't start with HTML tags in paragraphs
        const lines = html.split('\n')
        const wrappedLines = lines.map(line => {
          if (line.trim() && !line.match(/^<(h[1-6]|ul|li|p|a|strong|em|code)/)) {
            return `<p>${line}</p>`
          }
          return line
        })
        
        return wrappedLines.join('\n')
      }

      const htmlContent = convertMarkdownToHtml(form.content)

      const method = isEditing ? "PUT" : "POST"
      const r = await fetch("/api/blog/admin/post", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing ? { id: form.id } : {}),
          title: form.title,
          description: form.description || null,
          content: htmlContent,
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
    setLoading(true)
    try {
      const r = await fetch(`/api/blog/admin/post?id=${id}`, { method: "DELETE" })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setPosts((prev) => prev.filter((p) => p.id !== id))
      setDeleteModalOpen(false)
      setPostToDelete(null)
    } catch (e: any) {
      setError(e?.message ?? "Delete failed")
    } finally {
      setLoading(false)
    }
  }

  const openDeleteModal = (post: { id: number; title: string }) => {
    setPostToDelete(post)
    setDeleteModalOpen(true)
  }

  const clearFilters = () => {
    setDateSort('none')
    setTagFilter('all')
    setAuthorFilter('all')
  }

  const headerBar = (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-semibold text-[#111827]">Blog Editor</h1>
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
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5 text-gray-700"
            >
              <FiFilter className="w-4 h-4" />
              Filter
            </button>
            <button onClick={() => { resetForm(); setMode("edit") }} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[#701CC0] hover:bg-[#4C1D95] flex items-center gap-1.5">
              <FiPlus className="w-3.5 h-3.5" />
              New Blog
            </button>
          </>
        )}
        {mode === "edit" && (
          <div></div>
        )}
      </div>
    </div>
  )

  const filteredPosts = useMemo(() => {
    let filtered = posts

    // Search filter
    const q = search.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter((p) =>
        [p.title, p.description ?? "", p.tag ?? "", p.author?.name ?? ""].some((v) => v.toLowerCase().includes(q))
      )
    }

    // Tag filter
    if (tagFilter !== 'all') {
      filtered = filtered.filter((p) => p.tag && p.tag.split(',').map(t => t.trim()).includes(tagFilter))
    }

    // Author filter
    if (authorFilter !== 'all') {
      filtered = filtered.filter((p) => p.author?.name === authorFilter)
    }

    // Date sort
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

  return (
    <div className={`w-full h-full bg-white p-8 pb-32 md:pb-48 lg:pb-64 xl:pb-96 ${inter.className}`}>
      <div className="max-w-7xl mx-auto">
        {headerBar}

      {filterOpen && (
        <div className="mb-4 bg-[#F8F0FF] rounded-2xl shadow-sm border border-[#EDE6FB] p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-[#111827]">Filter Posts</h3>
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Date Sort</label>
              <select
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value as 'none' | 'asc' | 'desc')}
                className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none"
              >
                <option value="none">No Sort</option>
                <option value="asc">Oldest First</option>
                <option value="desc">Newest First</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Tags</label>
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none"
              >
                <option value="all">All Tags</option>
                {Array.from(new Set(posts.flatMap(p => p.tag ? p.tag.split(',').map(t => t.trim()) : []).filter(Boolean))).map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Author</label>
              <select
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none"
              >
                <option value="all">All Authors</option>
                {Array.from(new Set(posts.map(p => p.author?.name).filter(Boolean))).map(author => (
                  <option key={author} value={author || ''}>{author}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
      )}

      {mode === "list" && (
        <div className="bg-[#F8F0FF] rounded-2xl shadow-sm border border-[#EDE6FB] p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedPosts.map((p) => (
              <div key={p.id} className="rounded-xl bg-white p-5 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer">
                <div className="text-base md:text-lg font-medium text-[#111827]">{p.title}</div>
                <div className="text-xs text-[#6B7280] mt-1 flex items-center gap-1">
                  <span>By {p.author?.name ?? "Unknown"}</span>
                  <div className="h-1 w-1 bg-gray-400 rounded-full"></div>
                  <span>{(() => {
                    // Parse date string directly to avoid timezone issues
                    const dateStr = p.published_date.split('T')[0]; // Get YYYY-MM-DD part
                    const [year, month, day] = dateStr.split('-');
                    return `${month}/${day}/${year}`;
                  })()}</span>
                </div>
                <div className="text-sm text-[#6B7280] mt-2">{p.description}</div>
                {p.tag && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.tag.split(',').map((tag, index) => (
                      <span key={index} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => { setForm({
                    id: p.id,
                    title: p.title,
                    description: p.description ?? "",
                    content: p.content,
                    tag: p.tag ?? "",
                    date: p.published_date.slice(0,10),
                    authorName: p.author?.name ?? "",
                  }); setMode("edit"); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#701CC0] hover:bg-[#4C1D95]">Edit</button>
                  <button onClick={() => openDeleteModal({ id: p.id, title: p.title })} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700">Delete</button>
                </div>
              </div>
            ))}
            {paginatedPosts.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-56 h-auto mb-3 flex items-center justify-center">
                  <FiFileText className="w-24 h-24 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mb-3">No blog posts found.</p>
                <button
                  onClick={() => { resetForm(); setMode("edit") }}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#4C1D95]"
                >
                  <FiPlus className="w-4 h-4 mr-2" />
                  New Blog
                </button>
              </div>
            )}
          </div>
          
          {filteredPosts.length > pageSize && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm shadow-[0px_4px_15.9px_0px_#701CC061] hover:bg-[#4C1D95] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#701CC0]/50"
              >
                Previous
              </button>
              <span className="text-[#9BAFC3] text-sm">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm shadow-[0px_4px_15.9px_0px_#701CC061] hover:bg-[#4C1D95] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#701CC0]/50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "edit" && (
        <div className="bg-[#F8F0FF] rounded-2xl shadow-sm border border-[#EDE6FB] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none" placeholder="Blog Title" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Author</label>
              <input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none" placeholder="Blog Author" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-base text-[#111827] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Tags</label>
              <input 
                value={form.tag} 
                onChange={(e) => setForm({ ...form, tag: e.target.value })} 
                className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none" 
                placeholder="Marketing, SEO, Analytics (comma-separated)" 
              />
            </div>
          </div>
          <div className="mt-6">
            <label className="block text-sm font-medium text-[#374151] mb-2">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none" rows={3} placeholder="Short summary shown in cards and under title" />
          </div>
          <div className="mt-6">
            <label className="block text-sm font-medium text-[#374151] mb-2">Content</label>
            <RichTextEditor
              value={form.content}
              onChange={(value) => setForm({ ...form, content: value })}
            />
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={savePost} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#701CC0] text-white hover:bg-[#4C1D95]">{isEditing ? "Update Blog" : "Create Post"}</button>
            <button onClick={() => { resetForm(); setMode("list") }} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700">Cancel</button>
          </div>
        </div>
      )}
      </div>

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        postTitle={postToDelete?.title || ""}
        onConfirm={() => postToDelete && deletePost(postToDelete.id)}
        onCancel={() => {
          setDeleteModalOpen(false)
          setPostToDelete(null)
        }}
      />
    </div>
  )
}


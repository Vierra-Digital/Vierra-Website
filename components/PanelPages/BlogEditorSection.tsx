import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Inter } from "next/font/google"
import { FiPlus, FiTrash2, FiFileText, FiFilter, FiSearch, FiBold, FiItalic, FiLink, FiUnderline, FiImage, FiVideo, FiCornerUpLeft, FiCornerUpRight, FiList } from "react-icons/fi"

const inter = Inter({ subsets: ["latin"] })

const RichTextEditor: React.FC<{
  value: string
  onChange: (value: string) => void
}> = ({ value, onChange }) => {
  const editableRef = useRef<HTMLDivElement | null>(null)
  const isLocalEditRef = useRef<boolean>(false)
  const savedRangeRef = useRef<Range | null>(null)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkText, setLinkText] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState("")

  const setCaretToEnd = (el: HTMLElement) => {
    try {
      const sel = window.getSelection()
      if (!sel) return
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {}
  }

  // Track active formatting states to change icon styles
  const [activeBold, setActiveBold] = useState(false)
  const [activeItalic, setActiveItalic] = useState(false)
  const [activeUnderline, setActiveUnderline] = useState(false)

  useEffect(() => {
    const updateStates = () => {
      try {
        setActiveBold(document.queryCommandState('bold'))
        setActiveItalic(document.queryCommandState('italic'))
        setActiveUnderline(document.queryCommandState('underline'))
      } catch {}
    }
    document.addEventListener('selectionchange', updateStates)
    return () => document.removeEventListener('selectionchange', updateStates)
  }, [])

  // Prevent navigating when clicking links inside the editor
  useEffect(() => {
    const el = editableRef.current
    if (!el) return
    const onClick = (e: any) => {
      const t = e.target as HTMLElement
      if (t && t.tagName === 'A') e.preventDefault()
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [])
  const [history, setHistory] = useState<string[]>([value])
  const [historyIndex, setHistoryIndex] = useState(0)
  // We avoid storing display HTML in React state to prevent rerenders that reset the caret.

  // Transform stored HTML into an editing-friendly display where media become placeholders
  // and links remain as editable underlined text that doesn't navigate.
  const toDisplay = useCallback((html: string): string => {
    if (!html) return ""
    let out = html
    // Images -> (IMAGE): URL
    out = out.replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, (_m, url) => `<span data-type="image" data-url="${url}" class="rte-url" contenteditable="false">(IMAGE): ${url}</span>`)
    // Video -> (VIDEO): URL (take first source)
    out = out.replace(/<video[^>]*>[\s\S]*?<source[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/video>/gi, (_m, url) => `<span data-type="video" data-url="${url}" class="rte-url" contenteditable="false">(VIDEO): ${url}</span>`)
    // Links -> keep text, but store URL on data-url and disable navigation
    out = out.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => `<a href="#" data-url="${href}">${text}</a>`)
    return out
  }, [])

  // Transform display (with placeholders) back to real HTML for saving
  const toHtml = useCallback((display: string): string => {
    if (!display) return ""
    const normalizeUrl = (u: string) => {
      const t = u.trim()
      if (/^(https?:|data:|blob:)/i.test(t)) return t
      if (t.startsWith('//')) return `https:${t}`
      return `https://${t.replace(/^\/+/, '')}`
    }
    const toYoutubeEmbed = (u: string): string | null => {
      const url = normalizeUrl(u)
      try {
        const a = new URL(url)
        if (a.hostname.includes('youtu.be')) {
          const id = a.pathname.replace(/^\//, '')
          if (id) return `https://www.youtube.com/embed/${id}`
        }
        if (a.hostname.includes('youtube.com')) {
          if (a.pathname.startsWith('/watch')) {
            const id = a.searchParams.get('v')
            if (id) return `https://www.youtube.com/embed/${id}`
          }
          if (a.pathname.startsWith('/shorts/')) {
            const id = a.pathname.split('/')[2]
            if (id) return `https://www.youtube.com/embed/${id}`
          }
        }
      } catch {}
      return null
    }
    let out = display
    out = out.replace(/<span[^>]*data-type="image"[^>]*data-url="([^"]+)"[^>]*>.*?<\/span>/gi, (_m, url) => `<img src="${normalizeUrl(url)}" alt="" />`)
    out = out.replace(/<span[^>]*data-type="video"[^>]*data-url="([^"]+)"[^>]*>.*?<\/span>/gi, (_m, url) => {
      const yt = toYoutubeEmbed(url)
      if (yt) return `<iframe width="560" height="315" src="${yt}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
      return `<video controls><source src="${normalizeUrl(url)}" type="video/mp4">Your browser does not support the video tag.<\/video>`
    })
    // Anchors created in the editor
    out = out.replace(/<a[^>]*data-url="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, url, text) => `<a href="${normalizeUrl(url)}" target="_blank" rel="noopener noreferrer">${text}<\/a>`)
    // Legacy placeholder links (if any remain)
    out = out.replace(/<span[^>]*data-type="link"[^>]*data-url="([^"]+)"[^>]*>.*?<\/span>/gi, (_m, url) => `<a href="${normalizeUrl(url)}" target="_blank" rel="noopener noreferrer">${normalizeUrl(url)}<\/a>`)
    return out
  }, [])

  // Keep display in sync with incoming value
  useEffect(() => {
    // When updates come from outside the editor, sync the display.
    if (!isLocalEditRef.current) {
      const disp = toDisplay(value || "")
      if (editableRef.current && editableRef.current.innerHTML !== disp) {
        editableRef.current.innerHTML = disp
        setCaretToEnd(editableRef.current)
      }
    } else {
      // Clear the flag after the render triggered by a local edit
      isLocalEditRef.current = false
    }
    if (value !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(value)
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    }
  }, [value, history, historyIndex, toDisplay])

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

  const insertPlaceholder = (type: 'image' | 'video' | 'link', url: string) => {
    const el = editableRef.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel) return
    const span = document.createElement('span')
    span.setAttribute('data-type', type)
    span.setAttribute('data-url', url)
    span.className = 'rte-url'
    const label = type === 'image' ? '(IMAGE)' : type === 'video' ? '(VIDEO)' : '(LINK)'
    span.textContent = `${label}: ${url}`
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(span)
    range.setStartAfter(span)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    const newDisplay = el.innerHTML
    onChange(toHtml(newDisplay))
  }

  const formatText = (format: string) => {
    const el = editableRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel) return
    switch (format) {
      case 'bold':
        document.execCommand('bold')
        break
      case 'italic':
        // Ensure italic doesn't inherit bold styles
        document.execCommand('italic')
        break
      case 'underline':
        document.execCommand('underline')
        break
      case 'list':
        const selectedText = sel.toString().trim()
        
        if (selectedText) {
          // If text is selected, convert it to a bullet list
          const lines = selectedText.split('\n').filter(line => line.trim())
          const ul = document.createElement('ul')
          
          lines.forEach(line => {
            const li = document.createElement('li')
            li.textContent = line.trim()
            ul.appendChild(li)
          })
          
          // Replace selected text with the list
          const range = sel.getRangeAt(0)
          range.deleteContents()
          range.insertNode(ul)
          
          // Move caret after the list
          const newRange = document.createRange()
          newRange.setStartAfter(ul)
          newRange.collapse(true)
          sel.removeAllRanges()
          sel.addRange(newRange)
        } else {
          // No text selected - check if we're already in a list
          const currentList = sel.anchorNode?.parentElement?.closest('ul, ol')
          if (currentList) {
            // If already in a list, add a new list item
            const newLi = document.createElement('li')
            newLi.innerHTML = '<br>'
            currentList.appendChild(newLi)
            
            // Move caret to the new list item
            const range = document.createRange()
            range.selectNodeContents(newLi)
            range.collapse(false)
            sel.removeAllRanges()
            sel.addRange(range)
          } else {
            // Create a new bullet list at current cursor position
            const ul = document.createElement('ul')
            const li = document.createElement('li')
            li.innerHTML = '<br>'
            ul.appendChild(li)
            
            // Insert the list at cursor position
            const range = sel.getRangeAt(0)
            
            // Check if we're at the end of a line or in the middle of text
            const currentNode = sel.anchorNode
            if (currentNode && currentNode.nodeType === Node.TEXT_NODE && sel.anchorOffset > 0) {
              // We're in the middle of text, split it
              const textNode = currentNode as Text
              const beforeText = textNode.data.substring(0, sel.anchorOffset)
              const afterText = textNode.data.substring(sel.anchorOffset)
              
              // Create text nodes for before and after
              const beforeNode = document.createTextNode(beforeText)
              const afterNode = document.createTextNode(afterText)
              
              // Insert before text, list, then after text
              textNode.parentNode?.insertBefore(beforeNode, textNode)
              textNode.parentNode?.insertBefore(ul, textNode)
              textNode.parentNode?.insertBefore(afterNode, textNode)
              textNode.remove()
            } else {
              // Insert at cursor position
              range.deleteContents()
              range.insertNode(ul)
            }
            
            // Move caret inside the new list item
            const newRange = document.createRange()
            newRange.selectNodeContents(li)
            newRange.collapse(false)
            sel.removeAllRanges()
            sel.addRange(newRange)
          }
        }
        break
      case 'link': {
        const selText = sel.toString()
        savedRangeRef.current = sel.getRangeAt(0).cloneRange()
        setLinkText(selText || "")
        setLinkUrl("")
        setLinkModalOpen(true)
        return
      }
      case 'image': {
        setImageUrl("")
        setImageModalOpen(true)
        return
      }
      case 'video': {
        setVideoUrl("")
        setVideoModalOpen(true)
        return
    }
    }
    const newDisplay = el.innerHTML
    onChange(toHtml(newDisplay))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer.files)
    const el = editableRef.current
    if (!el) return
    el.focus()
    files.forEach(file => {
      const url = URL.createObjectURL(file)
      if (file.type.startsWith('image/')) {
        formatText('image')
        // Replace the last inserted placeholder with object URL
        if (editableRef.current) {
          const spans = editableRef.current.querySelectorAll('span[data-type="image"]')
          const last = spans[spans.length - 1] as HTMLElement
          if (last) {
            last.setAttribute('data-url', url)
            last.textContent = `(IMAGE): ${url}`
            const newDisplay = editableRef.current.innerHTML
            onChange(toHtml(newDisplay))
          }
        }
      } else if (file.type.startsWith('video/')) {
        formatText('video')
        if (editableRef.current) {
          const spans = editableRef.current.querySelectorAll('span[data-type="video"]')
          const last = spans[spans.length - 1] as HTMLElement
          if (last) {
            last.setAttribute('data-url', url)
            last.textContent = `(VIDEO): ${url}`
            const newDisplay = editableRef.current.innerHTML
            onChange(toHtml(newDisplay))
          }
        }
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
          className={`p-1.5 rounded hover:bg-gray-200 ${activeBold ? 'text-gray-400' : 'text-gray-700'}`}
          title="Bold"
        >
          <FiBold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('italic')}
          className={`p-1.5 rounded hover:bg-gray-200 ${activeItalic ? 'text-gray-400' : 'text-gray-700'}`}
          title="Italic"
        >
          <FiItalic className="w-4 h-4" />
        </button>
        {/* Code button removed per request */}
        <button
          type="button"
          onClick={() => formatText('underline')}
          className={`p-1.5 rounded hover:bg-gray-200 ${activeUnderline ? 'text-gray-400' : 'text-gray-700'}`}
          title="Underline"
        >
          <FiUnderline className="w-4 h-4" />
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
          title="Bullet List"
        >
          <FiList className="w-4 h-4" />
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
        className="min-h-[420px] max-h-[60vh] overflow-auto rounded-md"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Visible editor (no raw tags) */}
        <div
          id="rte-visible"
          ref={editableRef}
          contentEditable
          suppressContentEditableWarning
          className="w-full min-h-[420px] p-4 bg-white border-0 outline-none text-sm text-[#111827] prose max-w-none"
          onInput={() => {
            if (!editableRef.current) return
            const newDisplay = editableRef.current.innerHTML
            // Mark this change as local to prevent caret-jumping resets
            isLocalEditRef.current = true
            onChange(toHtml(newDisplay))
          }}
          // Initial content is injected by the effect above; no innerHTML binding here to avoid caret resets.
        />
        {/* Force italic to never appear bold in the visible editor */}
        <style jsx>{`
          #rte-visible em, #rte-visible i { font-weight: 400 !important; font-style: italic; }
          #rte-visible a { 
            color: #2563eb !important; 
            text-decoration: underline !important; 
            font-style: normal !important;
            font-weight: normal !important;
          }
          #rte-visible a:hover { 
            color: #1d4ed8 !important; 
            text-decoration: underline !important; 
          }
          #rte-visible ul { list-style-type: disc; margin-left: 20px; margin-top: 8px; margin-bottom: 8px; }
          #rte-visible ol { list-style-type: decimal; margin-left: 20px; margin-top: 8px; margin-bottom: 8px; }
          #rte-visible li { margin-bottom: 4px; line-height: 1.5; }
        `}</style>
        {/* Hidden field with actual HTML (posted value) */}
        <textarea
          className="absolute -left-[10000px] w-[1px] h-[1px] opacity-0"
          aria-hidden
          tabIndex={-1}
          value={value}
          readOnly
        />
      </div>
      <InsertLinkModal
        isOpen={linkModalOpen}
        linkText={linkText}
        linkUrl={linkUrl}
        onTextChange={setLinkText}
        onUrlChange={setLinkUrl}
        onConfirm={() => {
          if (!editableRef.current || !savedRangeRef.current) { setLinkModalOpen(false); return }
          const sel = window.getSelection(); if (!sel) { setLinkModalOpen(false); return }
          sel.removeAllRanges(); sel.addRange(savedRangeRef.current);
          const a = document.createElement('a')
          a.setAttribute('href', '#')
          a.setAttribute('data-url', linkUrl)
          a.textContent = linkText || linkUrl || 'Link'
          a.style.color = '#2563eb'
          a.style.textDecoration = 'underline'
          a.style.fontStyle = 'normal'
          a.style.fontWeight = 'normal'
          const range = sel.getRangeAt(0)
          range.deleteContents(); range.insertNode(a); range.setStartAfter(a); range.collapse(true)
          sel.removeAllRanges(); sel.addRange(range)
          const newDisplay = editableRef.current.innerHTML
          onChange(toHtml(newDisplay))
          setLinkModalOpen(false)
        }}
        onCancel={() => setLinkModalOpen(false)}
      />
      
      <InsertImageModal
        isOpen={imageModalOpen}
        imageUrl={imageUrl}
        onUrlChange={setImageUrl}
        onConfirm={() => {
          insertPlaceholder('image', imageUrl)
          setImageModalOpen(false)
        }}
        onCancel={() => setImageModalOpen(false)}
      />
      
      <InsertVideoModal
        isOpen={videoModalOpen}
        videoUrl={videoUrl}
        onUrlChange={setVideoUrl}
        onConfirm={() => {
          insertPlaceholder('video', videoUrl)
          setVideoModalOpen(false)
        }}
        onCancel={() => setVideoModalOpen(false)}
      />
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

// Insert Link Modal
const InsertLinkModal: React.FC<{
  isOpen: boolean
  linkText: string
  linkUrl: string
  onTextChange: (text: string) => void
  onUrlChange: (url: string) => void
  onConfirm: () => void
  onCancel: () => void
}> = ({ isOpen, linkText, linkUrl, onTextChange, onUrlChange, onConfirm, onCancel }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <FiLink className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-[#111827]">Insert Link</h3>
        </div>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Link Text</label>
            <input
              type="text"
              value={linkText}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Enter link text"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-[#111827]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">URL</label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-[#111827]"
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!linkText.trim() || !linkUrl.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
          >
            Insert Link
          </button>
        </div>
      </div>
    </div>
  )
}

// Insert Image Modal
const InsertImageModal: React.FC<{
  isOpen: boolean
  imageUrl: string
  onUrlChange: (url: string) => void
  onConfirm: () => void
  onCancel: () => void
}> = ({ isOpen, imageUrl, onUrlChange, onConfirm, onCancel }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <FiImage className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-[#111827]">Insert Image</h3>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#374151] mb-2">Image URL</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-[#111827]"
          />
          <p className="text-xs text-[#6B7280] mt-2">
            Direct links to .jpg, .png, .gif, or .webp files work best. You can also drag and drop image files directly into the editor.
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!imageUrl.trim()}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
          >
            Insert Image
          </button>
        </div>
      </div>
    </div>
  )
}

// Insert Video Modal
const InsertVideoModal: React.FC<{
  isOpen: boolean
  videoUrl: string
  onUrlChange: (url: string) => void
  onConfirm: () => void
  onCancel: () => void
}> = ({ isOpen, videoUrl, onUrlChange, onConfirm, onCancel }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
            <FiVideo className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-xl font-semibold text-[#111827]">Insert Video</h3>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#374151] mb-2">Video URL</label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-[#111827]"
          />
          <p className="text-xs text-[#6B7280] mt-2">
            YouTube links are supported. You can also drag and drop video files directly into the editor.
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!videoUrl.trim()}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
          >
            Insert Video
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
      const list = await fetch(`/api/blog/posts?page=1&limit=50`).then((x) => x.json())
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
                            placeholder="Search posts"
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
                                    <h3 className="text-sm font-semibold text-[#111827] mb-4">Filter & Sort</h3>
                                    
                                    {/* Date Sort */}
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Sort By Date</label>
                                        <div className="relative">
                                            <select
                                                value={dateSort}
                                                onChange={(e) => {
                                                    setDateSort(e.target.value as 'none' | 'asc' | 'desc')
                                                    setCurrentPage(1)
                                                }}
                                                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none"
                                            >
                                                <option value="none">No Sorting</option>
                                                <option value="asc">Ascending</option>
                                                <option value="desc">Descending</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tag Filter */}
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

                                    {/* Author Filter */}
                                    <div>
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
          <div></div>
        )}
                                                </div>
            </div>
    </>
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
    <>
    <div className={`w-full h-full bg-white text-[#111014] flex flex-col pb-32 md:pb-48 lg:pb-64 xl:pb-96 ${inter.className}`}>
      <div className="flex-1 flex justify-center px-6 pt-2">
        <div className="w-full max-w-6xl flex flex-col h-full">
        {headerBar}


      {error && (
        <div className="mb-4 rounded-md bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
      )}

      {mode === "list" && (
        <div className="bg-[#F8F0FF] rounded-2xl shadow-sm border border-[#EDE6FB] p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedPosts.map((p) => (
              <div key={p.id} className="rounded-xl bg-white p-5 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer">
                <div className="text-base md:text-lg font-medium text-[#111827]">{p.title}</div>
                <div className="text-xs text-[#6B7280] mt-1 flex items-center gap-2">
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
      </div>
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
    </>
  )
}


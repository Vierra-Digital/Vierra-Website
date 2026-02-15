import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Inter } from "next/font/google"
import { FiPlus, FiTrash2, FiFileText, FiFilter, FiSearch, FiBold, FiItalic, FiLink, FiUnderline, FiImage, FiVideo, FiCornerUpLeft, FiCornerUpRight, FiList, FiMoreVertical, FiAlignLeft, FiAlignCenter, FiAlignRight } from "react-icons/fi"
import { RiArrowDropDownLine } from "react-icons/ri"

const inter = Inter({ subsets: ["latin"] })

const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 24, 36, 48, 72]

const normalizeUrl = (u: string) => {
  const t = u.trim()
  if (/^(https?:|data:|blob:)/i.test(t)) return t
  if (t.startsWith('//')) return `https:${t}`
  return `https://${t.replace(/^\/+/, '')}`
}

const RichTextEditor: React.FC<{
  value: string
  onChange: (value: string) => void
}> = ({ value, onChange }) => {
  const editableRef = useRef<HTMLDivElement | null>(null)
  const isLocalEditRef = useRef<boolean>(false)
  const savedRangeRef = useRef<Range | null>(null)
  const selectedEmbedRef = useRef<HTMLElement | null>(null)
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
  const [activeAlign, setActiveAlign] = useState<"left" | "center" | "right" | "none">("none")
  const [selectedFont, setSelectedFont] = useState("Inter")
  const [selectedFontSize, setSelectedFontSize] = useState("12")
  const [selectedTextColor, setSelectedTextColor] = useState("#111827")
  const [selectedHighlightColor, setSelectedHighlightColor] = useState("#fff3a3")
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false)
  const fontSizeMenuRef = useRef<HTMLDivElement | null>(null)
  const fontSizeMap: Record<string, string> = {
    "8": "1",
    "9": "1",
    "10": "2",
    "11": "2",
    "12": "3",
    "14": "4",
    "16": "4",
    "18": "5",
    "24": "6",
    "36": "7",
    "48": "7",
    "72": "7",
  }
  const fontSizeOptions = FONT_SIZE_OPTIONS
  const allowFontSize = (size: string) => {
    if (!size) return false
    const n = parseInt(size, 10)
    return Number.isFinite(n) && n >= 8 && n <= 72
  }
  const applyFontSize = (size: string) => {
    if (!allowFontSize(size)) return
    setSelectedFontSize(size)
    formatText("fontSize", size)
  }

  const normalizeFontName = (family: string) => {
    const f = family.toLowerCase()
    if (f.includes("inter")) return "Inter"
    if (f.includes("arial")) return "Arial"
    if (f.includes("georgia")) return "Georgia"
    if (f.includes("times new roman")) return "Times New Roman"
    if (f.includes("courier new")) return "Courier New"
    return "Inter"
  }

  const getFontFromSelection = useCallback(() => {
    try {
      const cmd = document.queryCommandValue("fontName")
      if (typeof cmd === "string" && cmd.trim()) {
        return normalizeFontName(cmd)
      }
    } catch {}
    try {
      const el = editableRef.current
      const sel = window.getSelection()
      if (!el || !sel || !sel.anchorNode) return null
      const node: HTMLElement | null =
        sel.anchorNode.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as HTMLElement)
          : sel.anchorNode.parentElement
      if (!node || !el.contains(node)) return null
      const fontTag = node.closest("font")
      const face = fontTag?.getAttribute("face")
      if (face) return normalizeFontName(face)
      const family = window.getComputedStyle(node).fontFamily || ""
      return normalizeFontName(family)
    } catch {
      return null
    }
  }, [])

  const restoreSelection = () => {
    try {
      const sel = window.getSelection()
      const range = savedRangeRef.current
      if (!sel || !range) return
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {}
  }

  const getFontSizeFromSelection = useCallback(() => {
    try {
      const el = editableRef.current
      const sel = window.getSelection()
      if (!el || !sel || !sel.anchorNode) return null
      const node: HTMLElement | null =
        sel.anchorNode.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as HTMLElement)
          : sel.anchorNode.parentElement
      if (!node || !el.contains(node)) return null
      const size = window.getComputedStyle(node).fontSize || ""
      const px = parseFloat(size)
      if (!px || Number.isNaN(px)) return null
      const closest = FONT_SIZE_OPTIONS.reduce((prev, curr) =>
        Math.abs(curr - px) < Math.abs(prev - px) ? curr : prev
      )
      return String(closest)
    } catch {
      return null
    }
  }, [])

  const getColorFromSelection = () => {
    try {
      const el = editableRef.current
      const sel = window.getSelection()
      if (!el || !sel || !sel.anchorNode) return null
      const node: HTMLElement | null =
        sel.anchorNode.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as HTMLElement)
          : sel.anchorNode.parentElement
      if (!node || !el.contains(node)) return null
      const color = window.getComputedStyle(node).color || ""
      if (!color) return null
      const match = color.match(/\d+/g)
      if (!match || match.length < 3) return null
      const toHex = (n: number) => n.toString(16).padStart(2, "0")
      const [r, g, b] = match.slice(0, 3).map((v) => Math.min(255, Math.max(0, parseInt(v, 10))))
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    } catch {
      return null
    }
  }

  const getHighlightFromSelection = () => {
    try {
      const el = editableRef.current
      const sel = window.getSelection()
      if (!el || !sel || !sel.anchorNode) return null
      const node: HTMLElement | null =
        sel.anchorNode.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as HTMLElement)
          : sel.anchorNode.parentElement
      if (!node || !el.contains(node)) return null
      const bg = window.getComputedStyle(node).backgroundColor || ""
      if (!bg || bg === "transparent") return null
      const match = bg.match(/\d+/g)
      if (!match || match.length < 3) return null
      const toHex = (n: number) => n.toString(16).padStart(2, "0")
      const [r, g, b] = match.slice(0, 3).map((v) => Math.min(255, Math.max(0, parseInt(v, 10))))
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    } catch {
      return null
    }
  }

  useEffect(() => {
    const updateStates = () => {
      try {
        setActiveBold(document.queryCommandState('bold'))
        setActiveItalic(document.queryCommandState('italic'))
        setActiveUnderline(document.queryCommandState('underline'))
        if (document.queryCommandState("justifyCenter")) {
          setActiveAlign("center")
        } else if (document.queryCommandState("justifyRight")) {
          setActiveAlign("right")
        } else if (document.queryCommandState("justifyLeft")) {
          setActiveAlign("left")
        } else {
          setActiveAlign("none")
        }
      } catch {}
      try {
        const el = editableRef.current
        const sel = window.getSelection()
        if (el && sel && sel.rangeCount > 0 && sel.anchorNode && el.contains(sel.anchorNode)) {
          savedRangeRef.current = sel.getRangeAt(0).cloneRange()
        }
      } catch {}
      const detected = getFontFromSelection()
      if (detected) setSelectedFont(detected)
      const detectedSize = getFontSizeFromSelection()
      if (detectedSize) setSelectedFontSize(detectedSize)
      const detectedColor = getColorFromSelection()
      if (detectedColor) setSelectedTextColor(detectedColor)
      const detectedHighlight = getHighlightFromSelection()
      if (detectedHighlight) setSelectedHighlightColor(detectedHighlight)
    }
    document.addEventListener('selectionchange', updateStates)
      return () => document.removeEventListener('selectionchange', updateStates)
  }, [getFontFromSelection, getFontSizeFromSelection])

  // Resize state
  const isResizingRef = useRef(false)
  const resizeStartRef = useRef<{ x: number; width: number; isLeftSide: boolean } | null>(null)
  const handleResizeStartRef = useRef<((e: MouseEvent, embed: HTMLElement) => void) | null>(null)

  // Find embed element from a click target
  const findEmbed = useCallback((target: HTMLElement): HTMLElement | null => {
    if (!target) return null
    if (target.classList?.contains('rte-embed')) {
      return target
    }
    if (target.classList?.contains('rte-media') || target.tagName === 'IMG' || target.tagName === 'IFRAME' || target.tagName === 'VIDEO') {
      return target.closest('.rte-embed') as HTMLElement | null
    }
    // Check for resize handle
    if (target.classList?.contains('rte-resize-handle')) {
      return target.closest('.rte-embed') as HTMLElement | null
    }
    return target.closest('.rte-embed') as HTMLElement | null
  }, [])

  // Select an embed element and add resize handles
  const selectEmbed = useCallback((embed: HTMLElement) => {
    // Clear previous selection
    if (selectedEmbedRef.current && selectedEmbedRef.current !== embed) {
      selectedEmbedRef.current.removeAttribute("data-selected")
      // Remove old resize handles
      selectedEmbedRef.current.querySelectorAll('.rte-resize-handle').forEach(h => h.remove())
    }
    // Set new selection
    embed.setAttribute("data-selected", "true")
    selectedEmbedRef.current = embed
    // Update alignment state
    const align = embed.getAttribute("data-align")
    if (align === "center" || align === "right" || align === "left") {
      setActiveAlign(align)
    } else {
      setActiveAlign("left")
    }
    
    // Add resize handles on all 4 corners if this is an image
    const isImage = embed.getAttribute("data-type") === "image"
    if (isImage && !embed.querySelector('.rte-resize-handle')) {
      const corners = ['nw', 'ne', 'sw', 'se']
      corners.forEach(corner => {
        const handle = document.createElement('div')
        handle.className = `rte-resize-handle rte-resize-handle-${corner}`
        handle.setAttribute('contenteditable', 'false')
        handle.setAttribute('data-corner', corner)
        embed.appendChild(handle)
      })
    }
  }, [])

  // Clear embed selection
  const clearEmbedSelection = useCallback(() => {
    if (selectedEmbedRef.current) {
      selectedEmbedRef.current.removeAttribute("data-selected")
      // Remove resize handles
      selectedEmbedRef.current.querySelectorAll('.rte-resize-handle').forEach(h => h.remove())
      selectedEmbedRef.current = null
      setActiveAlign("none")
    }
  }, [])

  // Handle resize - stored in ref to avoid stale closures in useEffect
  handleResizeStartRef.current = (e: MouseEvent, embed: HTMLElement) => {
    e.preventDefault()
    e.stopPropagation()
    isResizingRef.current = true
    const media = embed.querySelector('.rte-media') as HTMLImageElement
    const currentWidth = media?.naturalWidth ? media.offsetWidth : (media?.offsetWidth || 300)
    const handle = e.target as HTMLElement
    const corner = handle.getAttribute('data-corner') || 'se'
    // For left-side handles, dragging left increases width (inverted)
    const isLeftSide = corner === 'nw' || corner === 'sw'
    const startData = { x: e.clientX, width: currentWidth, isLeftSide }
    resizeStartRef.current = startData
    
    const handleResizeMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current || !resizeStartRef.current || !selectedEmbedRef.current) return
      let delta = moveEvent.clientX - resizeStartRef.current.x
      // Invert delta for left-side handles
      if (resizeStartRef.current.isLeftSide) {
        delta = -delta
      }
      const newWidth = Math.max(50, Math.min(800, resizeStartRef.current.width + delta))
      const mediaEl = selectedEmbedRef.current.querySelector('.rte-media') as HTMLElement
      if (mediaEl) {
        // Only set width - height will auto-adjust to maintain aspect ratio
        mediaEl.style.width = `${newWidth}px`
        mediaEl.style.height = 'auto'
      }
      selectedEmbedRef.current.setAttribute('data-width', String(newWidth))
    }
    
    const handleResizeEnd = () => {
      isResizingRef.current = false
      resizeStartRef.current = null
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
      // Trigger input event to save the change (this calls toHtml via onInput handler)
      if (editableRef.current) {
        editableRef.current.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
  }

  // Handle clicks on the editor - select embeds or clear selection
  useEffect(() => {
    const el = editableRef.current
    if (!el) return
    
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t) return
      
      // Check if clicking on a resize handle
      if (t.classList?.contains('rte-resize-handle')) {
        const embed = t.closest('.rte-embed') as HTMLElement
        if (embed && handleResizeStartRef.current) {
          handleResizeStartRef.current(e, embed)
          return
        }
      }
      
      const embed = findEmbed(t)
      if (embed && el.contains(embed)) {
        e.preventDefault()
        e.stopPropagation()
        selectEmbed(embed)
        // Force a repaint to ensure CSS is applied
        void embed.offsetHeight
      }
    }
    
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t) return
      
      // Prevent link navigation in editor
      if (t.tagName === 'A') {
        e.preventDefault()
      }
      
      // If clicking outside an embed, clear selection
      const embed = findEmbed(t)
      if (!embed && selectedEmbedRef.current) {
        clearEmbedSelection()
      }
    }
    
    el.addEventListener('mousedown', onMouseDown, true)
    el.addEventListener('click', onClick, true)
    return () => {
      el.removeEventListener('mousedown', onMouseDown, true)
      el.removeEventListener('click', onClick, true)
    }
  }, [findEmbed, selectEmbed, clearEmbedSelection])
  const [history, setHistory] = useState<string[]>([value])
  const [historyIndex, setHistoryIndex] = useState(0)
  // We avoid storing display HTML in React state to prevent rerenders that reset the caret.

  const toYoutubeEmbed = useCallback((u: string): string | null => {
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
  }, [])
  const buildVideoEmbedHtml = useCallback((u: string) => {
    const yt = toYoutubeEmbed(u)
    if (yt) {
      return `<iframe class="rte-media" src="${yt}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    }
    return `<video class="rte-media" controls src="${normalizeUrl(u)}">Your browser does not support the video tag.</video>`
  }, [toYoutubeEmbed])
  const buildImageEmbedHtml = (u: string) => `<img class="rte-media" src="${normalizeUrl(u)}" alt="" />`

  // Transform stored HTML into an editing-friendly display
  const toDisplay = useCallback((html: string): string => {
    if (!html) return ""
    let out = html
    // Strip editor-only rte-media class from saved HTML so images get properly wrapped
    out = out.replace(/(<img[^>]*)\s*class="[^"]*rte-media[^"]*"/gi, '$1')
    // First, handle wrapped media (with alignment divs from saved HTML)
    out = out.replace(/<div[^>]*style="[^"]*text-align:(left|center|right)[^"]*"[^>]*>[\s\S]*?<img([^>]*)>[\s\S]*?<\/div>/gi, (match, align, imgAttrs) => {
      const srcMatch = imgAttrs.match(/src="([^"]+)"/)
      const widthMatch = imgAttrs.match(/style="[^"]*width:\s*(\d+)px/)
      const url = srcMatch ? srcMatch[1] : ''
      if (!url) return match
      const width = widthMatch ? widthMatch[1] : ''
      const widthAttr = width ? ` data-width="${width}"` : ''
      const widthStyle = width ? ` style="width:${width}px;"` : ''
      const embed = `<img class="rte-media" src="${normalizeUrl(url)}" alt=""${widthStyle} />`
      return `<div data-type="image" data-url="${url}" data-align="${align}"${widthAttr} class="rte-embed" contenteditable="false">${embed}</div>`
    })
    out = out.replace(/<div[^>]*style="[^"]*text-align:(left|center|right)[^"]*"[^>]*>[\s\S]*?<(iframe|video)[^>]*>[\s\S]*?<\/(iframe|video)>[\s\S]*?<\/div>/gi, (_m, align) => {
      const srcMatch = _m.match(/src="([^"]+)"/)
      if (srcMatch) {
        const url = srcMatch[1]
        const embed = buildVideoEmbedHtml(url)
        return `<div data-type="video" data-url="${url}" data-align="${align}" class="rte-embed" contenteditable="false">${embed}</div>`
      }
      return _m
    })
    // Convert remaining raw img/iframe/video tags that aren't already wrapped in rte-embed
    // Skip img tags that already have rte-media class (those are inside embeds)
    out = out.replace(/<img([^>]*)>/gi, (match, attrs) => {
      // Skip if already has rte-media class (already inside an embed)
      if (attrs.includes('rte-media')) return match
      const srcMatch = attrs.match(/src="([^"]+)"/)
      const widthMatch = attrs.match(/width:\s*(\d+)px/)
      const url = srcMatch ? srcMatch[1] : ''
      if (!url) return match
      const width = widthMatch ? widthMatch[1] : ''
      const widthAttr = width ? ` data-width="${width}"` : ''
      const widthStyle = width ? ` style="width:${width}px;"` : ''
      const embed = `<img class="rte-media" src="${normalizeUrl(url)}" alt=""${widthStyle} />`
      return `<div data-type="image" data-url="${url}"${widthAttr} class="rte-embed" contenteditable="false">${embed}</div>`
    })
    // Video -> embedded preview (only if not already wrapped)
    out = out.replace(/<iframe([^>]*)>[\s\S]*?<\/iframe>/gi, (match, attrs) => {
      if (attrs.includes('rte-media')) return match
      const srcMatch = attrs.match(/src="([^"]+)"/)
      const url = srcMatch ? srcMatch[1] : ''
      if (!url) return match
      const embed = buildVideoEmbedHtml(url)
      return `<div data-type="video" data-url="${url}" class="rte-embed" contenteditable="false">${embed}</div>`
    })
    out = out.replace(/<video([^>]*)>[\s\S]*?<\/video>/gi, (match, attrs) => {
      if (attrs.includes('rte-media')) return match
      const srcMatch = attrs.match(/src="([^"]+)"/)
      const url = srcMatch ? srcMatch[1] : ''
      if (!url) return match
      const embed = buildVideoEmbedHtml(url)
      return `<div data-type="video" data-url="${url}" class="rte-embed" contenteditable="false">${embed}</div>`
    })
    out = out.replace(/<video[^>]*>[\s\S]*?<source[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/video>/gi, (_m, url) => {
      const embed = buildVideoEmbedHtml(url)
      return `<div data-type="video" data-url="${url}" class="rte-embed" contenteditable="false">${embed}</div>`
    })
    // Links -> keep text and store URL on data-url
    out = out.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
      const url = normalizeUrl(href)
      return `<a href="${url}" data-url="${url}" class="rte-link not-prose" title="${url}" style="color:#2563eb;text-decoration:underline;">${text}</a>`
    })
    return out
  }, [buildVideoEmbedHtml])

  // Transform display (with placeholders) back to real HTML for saving
  const toHtml = useCallback((display: string): string => {
    if (!display) return ""
    let out = display
    // Remove resize handles before saving
    out = out.replace(/<div[^>]*class="rte-resize-handle[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    // Image embeds - match any div with rte-embed class and data-type="image" (regardless of attribute order)
    out = out.replace(/<div[^>]*\bclass="[^"]*rte-embed[^"]*"[^>]*>[\s\S]*?<\/div>/gi, (match) => {
      // Check if this is an image embed
      if (!match.includes('data-type="image"')) {
        // Check if it's a video embed
        if (match.includes('data-type="video"')) {
          const urlMatch = match.match(/data-url="([^"]+)"/)
          const alignMatch = match.match(/data-align="([^"]+)"/)
          const url = urlMatch ? urlMatch[1] : ''
          const align = alignMatch ? alignMatch[1] : ''
          if (!url) return match
          // Build inline styles for alignment
          let mediaStyles = 'display:block;'
          if (align === 'center') {
            mediaStyles += 'margin-left:auto;margin-right:auto;'
          } else if (align === 'right') {
            mediaStyles += 'margin-left:auto;margin-right:0;'
          } else if (align === 'left') {
            mediaStyles += 'margin-left:0;margin-right:auto;'
          }
          const yt = toYoutubeEmbed(url)
          let media: string
          if (yt) {
            media = `<iframe src="${yt}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="${mediaStyles}max-width:640px;width:100%;height:360px;"></iframe>`
          } else {
            media = `<video controls src="${normalizeUrl(url)}" style="${mediaStyles}max-width:640px;width:100%;">Your browser does not support the video tag.</video>`
          }
          if (align && (align === 'left' || align === 'center' || align === 'right')) {
            return `<div style="text-align:${align};">${media}</div>`
          }
          return media
        }
        return match
      }
      const urlMatch = match.match(/data-url="([^"]+)"/)
      const alignMatch = match.match(/data-align="([^"]+)"/)
      const widthMatch = match.match(/data-width="([^"]+)"/)
      const url = urlMatch ? urlMatch[1] : ''
      const align = alignMatch ? alignMatch[1] : ''
      const width = widthMatch ? widthMatch[1] : ''
      if (!url) return match
      // Build inline styles for the image
      let imgStyles = 'display:block;'
      if (width) imgStyles += `width:${width}px;`
      // Add margin styles based on alignment
      if (align === 'center') {
        imgStyles += 'margin-left:auto;margin-right:auto;'
      } else if (align === 'right') {
        imgStyles += 'margin-left:auto;margin-right:0;'
      } else if (align === 'left') {
        imgStyles += 'margin-left:0;margin-right:auto;'
      }
      const media = `<img src="${normalizeUrl(url)}" alt="" style="${imgStyles}" />`
      // Wrap in a div with text-align for additional alignment support
      if (align && (align === 'left' || align === 'center' || align === 'right')) {
        return `<div style="text-align:${align};">${media}</div>`
      }
      return media
    })
    // Anchors created in the editor
    out = out.replace(/<a[^>]*data-url="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, url, text) => `<a href="${normalizeUrl(url)}" target="_blank" rel="noopener noreferrer">${text}<\/a>`)
    // Legacy placeholder links (if any remain)
    out = out.replace(/<span[^>]*data-type="link"[^>]*data-url="([^"]+)"[^>]*>.*?<\/span>/gi, (_m, url) => `<a href="${normalizeUrl(url)}" target="_blank" rel="noopener noreferrer">${normalizeUrl(url)}<\/a>`)
    return out
  }, [toYoutubeEmbed])

  const setupEmbedHandlers = useCallback((embed: HTMLElement) => {
    if (embed.hasAttribute('data-initialized')) return
    
    embed.setAttribute('data-initialized', 'true')
    embed.setAttribute('draggable', 'true')
    
    const handleDragStart = (e: DragEvent) => {
      embed.setAttribute('data-dragging', 'true')
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/html', embed.outerHTML)
      }
    }
    const handleDragEnd = () => {
      embed.removeAttribute('data-dragging')
    }
    
    embed.addEventListener('dragstart', handleDragStart)
    embed.addEventListener('dragend', handleDragEnd)
  }, [])

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

  // Track the last value we synced to avoid redundant innerHTML resets
  const lastSyncedValueRef = useRef<string>('')

  // Keep display in sync with incoming value
  useEffect(() => {
    // When updates come from outside the editor, sync the display.
    if (!isLocalEditRef.current) {
      // Only reset innerHTML if the value actually changed from what we last synced
      if (value !== lastSyncedValueRef.current) {
        const disp = toDisplay(value || "")
        if (editableRef.current) {
          editableRef.current.innerHTML = disp
          setCaretToEnd(editableRef.current)
        }
        lastSyncedValueRef.current = value
      }
    } else {
      // Clear the flag after the render triggered by a local edit
      isLocalEditRef.current = false
      lastSyncedValueRef.current = value
    }
    if (value !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(value)
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    }
    
    // Make embeds draggable and selectable
    const el = editableRef.current
    if (el) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const embeds = el.querySelectorAll('.rte-embed:not([data-initialized])')
        embeds.forEach((embed) => {
          setupEmbedHandlers(embed as HTMLElement)
        })
      })
    }
  }, [value, history, historyIndex, toDisplay, setupEmbedHandlers])

  // Upload an image file to the server and return its permanent URL
  const uploadBlogImage = async (file: File): Promise<string | null> => {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const resp = await fetch('/api/blog/admin/uploadImage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: base64, mimeType: file.type, filename: file.name }),
      })
      if (!resp.ok) {
        console.error('Image upload failed:', resp.status)
        return null
      }
      const data = await resp.json()
      return data.url
    } catch (err) {
      console.error('Image upload error:', err)
      return null
    }
  }

  const insertPlaceholder = (type: 'image' | 'video', url: string) => {
    const el = editableRef.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel) return
    if (type === "video") {
      const range = savedRangeRef.current || (sel.rangeCount > 0 ? sel.getRangeAt(0) : null)
      const embed = document.createElement("div")
      embed.setAttribute("data-type", "video")
      embed.setAttribute("data-url", url)
      embed.setAttribute("contenteditable", "false")
      embed.className = "rte-embed"
      embed.innerHTML = buildVideoEmbedHtml(url)
      setupEmbedHandlers(embed)
      if (range) {
        range.deleteContents()
        range.insertNode(embed)
        range.setStartAfter(embed)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      } else {
        el.appendChild(embed)
      }
      // Mark as local edit to prevent useEffect from resetting content
      isLocalEditRef.current = true
      const newDisplay = el.innerHTML
      onChange(toHtml(newDisplay))
      return
    }
    if (type === "image") {
      const range = savedRangeRef.current || (sel.rangeCount > 0 ? sel.getRangeAt(0) : null)
      const embed = document.createElement("div")
      embed.setAttribute("data-type", "image")
      embed.setAttribute("data-url", url)
      embed.setAttribute("contenteditable", "false")
      embed.className = "rte-embed"
      embed.innerHTML = buildImageEmbedHtml(url)
      setupEmbedHandlers(embed)
      if (range) {
        range.deleteContents()
        range.insertNode(embed)
        range.setStartAfter(embed)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      } else {
        el.appendChild(embed)
      }
      // Mark as local edit to prevent useEffect from resetting content
      isLocalEditRef.current = true
      const newDisplay = el.innerHTML
      onChange(toHtml(newDisplay))
      return
    }
  }

  const formatText = (format: string, value?: string) => {
    const el = editableRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel) return
    switch (format) {
      case 'font':
        if (sel.isCollapsed) {
          const range = document.createRange()
          range.selectNodeContents(el)
          sel.removeAllRanges()
          sel.addRange(range)
          document.execCommand('fontName', false, value || selectedFont)
          range.collapse(false)
          sel.removeAllRanges()
          sel.addRange(range)
        } else {
          document.execCommand('fontName', false, value || selectedFont)
        }
        break
      case 'fontSize': {
        const sizePx = value || "12"
        const sizeCmd = fontSizeMap[sizePx] || "3"
        restoreSelection()
        if (sel.isCollapsed) {
          const range = document.createRange()
          range.selectNodeContents(el)
          sel.removeAllRanges()
          sel.addRange(range)
          document.execCommand('fontSize', false, sizeCmd)
          range.collapse(false)
          sel.removeAllRanges()
          sel.addRange(range)
        } else {
          document.execCommand('fontSize', false, sizeCmd)
        }
        const fontEls = el.querySelectorAll("font[size]")
        fontEls.forEach((fontEl) => {
          fontEl.removeAttribute("size")
          fontEl.setAttribute("style", `font-size: ${sizePx}px;`)
        })
        setSelectedFontSize(sizePx)
        break
      }
      case 'textColor':
        restoreSelection()
        document.execCommand('foreColor', false, value || selectedTextColor)
        break
      case 'highlight':
        restoreSelection()
        document.execCommand('hiliteColor', false, value || selectedHighlightColor)
        break
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
      case 'alignLeft':
      case 'alignCenter':
      case 'alignRight':
        {
          const alignValue = format === 'alignLeft' ? 'left' : format === 'alignCenter' ? 'center' : 'right'
          const embed = selectedEmbedRef.current
          if (embed && embed.classList.contains('rte-embed')) {
            // Set alignment on embed
            embed.setAttribute('data-align', alignValue)
            // Force repaint
            void embed.offsetHeight
            // Update state
            setActiveAlign(alignValue)
            // Keep selection
            embed.setAttribute('data-selected', 'true')
            // Sync HTML - mark as local edit to prevent reset
            isLocalEditRef.current = true
            const newDisplay = el.innerHTML
            onChange(toHtml(newDisplay))
            return
          } else {
            // No embed selected, use text alignment
            const cmd = format === 'alignLeft' ? 'justifyLeft' : format === 'alignCenter' ? 'justifyCenter' : 'justifyRight'
            document.execCommand(cmd)
          }
        }
        break
      case 'list':
        restoreSelection()
        if (el) el.focus()
        {
          const selectedText = sel.toString()
          const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null
          
          if (selectedText.trim() || (range && selectedText.includes('\n'))) {
            // Handle multi-line selection (including empty lines)
            const lines = selectedText.split(/\r?\n/)
            const ul = document.createElement('ul')
            ul.style.listStyleType = 'disc'
            ul.style.paddingLeft = '24px'
            ul.style.margin = '8px 0'
            
            lines.forEach((line) => {
              const trimmed = line.trim()
              const li = document.createElement('li')
              li.style.display = 'list-item'
              if (trimmed) {
                li.textContent = trimmed
              } else {
                li.innerHTML = '<br>'
              }
              ul.appendChild(li)
            })
            
            if (range) {
              range.deleteContents()
              range.insertNode(ul)
              const newRange = document.createRange()
              newRange.setStartAfter(ul.lastChild as Node)
              newRange.collapse(true)
              sel.removeAllRanges()
              sel.addRange(newRange)
            } else if (el) {
              el.appendChild(ul)
            }
            const newDisplay = el.innerHTML
            onChange(toHtml(newDisplay))
            return
          } else {
            // Handle single line or empty line
            if (range && range.collapsed && !selectedText.trim()) {
              // Empty line - create list directly
              const ul = document.createElement('ul')
              ul.style.listStyleType = 'disc'
              ul.style.paddingLeft = '24px'
              ul.style.margin = '8px 0'
              const li = document.createElement('li')
              li.style.display = 'list-item'
              li.innerHTML = '<br>'
              ul.appendChild(li)
              
              // Check if we're in an empty paragraph or at start/end
              const container = range.startContainer
              const parent = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as HTMLElement
              
              if (parent && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
                // Replace empty paragraph/div with list
                if (!parent.textContent?.trim() && parent.children.length === 0) {
                  parent.parentNode?.replaceChild(ul, parent)
                } else {
                  // Insert before or after based on position
                  if (range.startOffset === 0 && !parent.textContent?.trim()) {
                    parent.parentNode?.insertBefore(ul, parent)
                  } else {
                    range.insertNode(ul)
                  }
                }
              } else {
                range.insertNode(ul)
              }
              
              const newRange = document.createRange()
              newRange.setStart(li, 0)
              newRange.collapse(true)
              sel.removeAllRanges()
              sel.addRange(newRange)
              
              const newDisplay = el.innerHTML
              onChange(toHtml(newDisplay))
              return
            }
            
            // Try execCommand first for non-empty selections
            const before = el?.innerHTML || ""
            const ok = document.execCommand('insertUnorderedList')
            const after = el?.innerHTML || ""
            
            if (!ok || before === after) {
              // Fallback: create list manually
              const ul = document.createElement('ul')
              ul.style.listStyleType = 'disc'
              ul.style.paddingLeft = '24px'
              ul.style.margin = '8px 0'
              const li = document.createElement('li')
              li.style.display = 'list-item'
              
              if (range) {
                const contents = range.extractContents()
                if (contents.textContent?.trim() || contents.childNodes.length > 0) {
                  li.appendChild(contents)
                } else {
                  li.innerHTML = '<br>'
                }
                ul.appendChild(li)
                range.insertNode(ul)
                const newRange = document.createRange()
                newRange.setStart(li, 0)
                newRange.collapse(true)
                sel.removeAllRanges()
                sel.addRange(newRange)
              } else if (el) {
                li.innerHTML = '<br>'
                ul.appendChild(li)
                el.appendChild(ul)
                const newRange = document.createRange()
                newRange.setStart(li, 0)
                newRange.collapse(true)
                const sel = window.getSelection()
                if (sel) {
                  sel.removeAllRanges()
                  sel.addRange(newRange)
                }
              }
              const newDisplay = el.innerHTML
              onChange(toHtml(newDisplay))
              return
            }
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

  const cycleAlignment = () => {
    const current = activeAlign === "none" ? "left" : activeAlign
    const next = current === "left" ? "center" : current === "center" ? "right" : "left"
    const command = next === "left" ? "alignLeft" : next === "center" ? "alignCenter" : "alignRight"
    
    // If there's a selected embed, don't call el.focus() which would clear selection
    if (selectedEmbedRef.current) {
      const embed = selectedEmbedRef.current
      embed.setAttribute('data-align', next)
      void embed.offsetHeight
      setActiveAlign(next)
      embed.setAttribute('data-selected', 'true')
      const el = editableRef.current
      if (el) {
        // Mark as local edit to prevent useEffect from resetting content
        isLocalEditRef.current = true
        onChange(toHtml(el.innerHTML))
      }
    } else {
      formatText(command)
      setActiveAlign(next)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = editableRef.current
    if (!el) return
    const target = e.target as HTMLElement
    if (target.closest('.rte-embed[data-dragging="true"]')) {
      return
    }
    const dropTarget = target.closest('.rte-embed') || target
    if (dropTarget && dropTarget !== el) {
      const rect = dropTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      if (y < rect.height / 2) {
        dropTarget.setAttribute('data-drop-before', 'true')
        dropTarget.removeAttribute('data-drop-after')
      } else {
        dropTarget.setAttribute('data-drop-after', 'true')
        dropTarget.removeAttribute('data-drop-before')
      }
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = editableRef.current
    if (!el) return
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      el.focus()
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          // Upload first, then insert with permanent URL
          const permanentUrl = await uploadBlogImage(file)
          if (permanentUrl) {
            insertPlaceholder('image', permanentUrl)
          }
        } else if (file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file)
          insertPlaceholder('video', url)
        }
      }
      return
    }
    
    const draggedHtml = e.dataTransfer.getData('text/html')
    if (draggedHtml) {
      const temp = document.createElement('div')
      temp.innerHTML = draggedHtml
      const draggedEmbed = temp.querySelector('.rte-embed') as HTMLElement
      if (draggedEmbed) {
        const existingEmbed = el.querySelector('.rte-embed[data-dragging="true"]') as HTMLElement
        const target = (e.target as HTMLElement).closest('.rte-embed') as HTMLElement
        if (existingEmbed && target && existingEmbed !== target) {
          const range = document.createRange()
          const sel = window.getSelection()
          const newEmbed = draggedEmbed.cloneNode(true) as HTMLElement
          newEmbed.removeAttribute('data-initialized')
          newEmbed.removeAttribute('data-dragging')
          setupEmbedHandlers(newEmbed)
          if (target.hasAttribute('data-drop-before')) {
            range.setStartBefore(target)
            range.insertNode(newEmbed)
          } else {
            range.setStartAfter(target)
            range.insertNode(newEmbed)
          }
          existingEmbed.remove()
          target.removeAttribute('data-drop-before')
          target.removeAttribute('data-drop-after')
          if (sel) {
            range.setStartAfter(newEmbed)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
          }
          // Mark as local edit to prevent useEffect from resetting content
          isLocalEditRef.current = true
          const newDisplay = el.innerHTML
          onChange(toHtml(newDisplay))
        }
      }
    }
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
        <div className="relative">
          <select
            value={selectedFont}
            onChange={(event) => {
              const nextFont = event.target.value
              setSelectedFont(nextFont)
              formatText('font', nextFont)
            }}
            className="text-sm border border-gray-300 rounded-md bg-white pl-2 pr-8 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#701CC0] appearance-none"
            title="Font"
          >
            <option value="Inter">Inter</option>
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Verdana">Verdana</option>
            <option value="Tahoma">Tahoma</option>
            <option value="Trebuchet MS">Trebuchet MS</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Garamond">Garamond</option>
            <option value="Courier New">Courier New</option>
            <option value="Lucida Console">Lucida Console</option>
            <option value="Monaco">Monaco</option>
          </select>
          <RiArrowDropDownLine className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
        </div>
        <div
          className="relative group"
          ref={fontSizeMenuRef}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setFontSizeMenuOpen(false)
            }
          }}
          tabIndex={-1}
        >
          <input
            value={selectedFontSize}
            onChange={(event) => {
              const raw = event.target.value
              const cleaned = raw.replace(/[^\d]/g, "").slice(0, 2)
              setSelectedFontSize(cleaned)
            }}
            onFocus={() => setFontSizeMenuOpen(true)}
            onClick={() => setFontSizeMenuOpen(true)}
            onBlur={() => {
              if (!selectedFontSize) {
                setSelectedFontSize("12")
                return
              }
              applyFontSize(selectedFontSize)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                applyFontSize(selectedFontSize)
                setFontSizeMenuOpen(false)
                ;(event.currentTarget as HTMLInputElement).blur()
              }
            }}
            className="text-sm w-12 border border-gray-300 rounded-md bg-white pl-2 pr-5 py-1 text-gray-700 text-center focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
            title="Text size"
            inputMode="numeric"
            maxLength={2}
          />
          <button
            type="button"
            onClick={() => setFontSizeMenuOpen((v) => !v)}
            className="absolute right-0 top-0 h-full px-1 text-gray-500 hover:text-gray-700"
            aria-label="Toggle font size menu"
          >
            <RiArrowDropDownLine className={`w-5 h-5 transition-transform ${fontSizeMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {fontSizeMenuOpen && (
            <div className="absolute left-0 mt-1 w-14 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 z-50 max-h-40 overflow-auto">
              {fontSizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    applyFontSize(String(size))
                    setFontSizeMenuOpen(false)
                  }}
                  className={`w-full px-2 py-1 text-xs text-center hover:bg-gray-50 ${
                    selectedFontSize === String(size) ? "text-[#701CC0] font-semibold" : "text-[#374151]"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>
        <label
          className="relative flex items-center justify-center w-8 h-8 rounded border border-transparent hover:bg-gray-200 cursor-pointer"
          title="Text color"
          onMouseDown={() => {
            const sel = window.getSelection()
            if (sel && sel.rangeCount > 0) {
              savedRangeRef.current = sel.getRangeAt(0).cloneRange()
            }
          }}
        >
          <span className="text-xs font-semibold text-gray-700 leading-none">
            A
          </span>
          <span
            className="absolute translate-y-3 w-4 h-1 rounded-sm"
            style={{ backgroundColor: selectedTextColor }}
          />
          <input
            type="color"
            value={selectedTextColor}
            onChange={(event) => {
              const nextColor = event.target.value
              setSelectedTextColor(nextColor)
              formatText('textColor', nextColor)
            }}
            className="sr-only"
          />
        </label>
        <label
          className="relative flex items-center justify-center w-8 h-8 rounded border border-transparent hover:bg-gray-200 cursor-pointer"
          title="Highlight color"
          onMouseDown={() => {
            const sel = window.getSelection()
            if (sel && sel.rangeCount > 0) {
              savedRangeRef.current = sel.getRangeAt(0).cloneRange()
            }
          }}
        >
          <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21h6" />
            <path d="M6 15l8-8 3 3-8 8H6v-3z" />
            <path d="M14 7l3 3" />
          </svg>
          <span
            className="absolute translate-y-3 w-4 h-1 rounded-sm"
            style={{ backgroundColor: selectedHighlightColor }}
          />
          <span
            className="absolute translate-y-1.5 w-4 h-2 rounded-sm opacity-40"
            style={{ backgroundColor: selectedHighlightColor }}
          />
          <input
            type="color"
            value={selectedHighlightColor}
            onChange={(event) => {
              const nextColor = event.target.value
              setSelectedHighlightColor(nextColor)
              formatText('highlight', nextColor)
            }}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          onClick={() => formatText('bold')}
          className={`p-1.5 rounded border transition-colors ${
            activeBold
              ? 'bg-[#701CC0]/15 border-[#701CC0]/60 text-[#3b0d6b]'
              : 'border-transparent text-gray-700 hover:bg-gray-200'
          }`}
          title="Bold"
        >
          <FiBold className={`w-4 h-4 ${activeBold ? 'scale-110' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => formatText('italic')}
          className={`p-1.5 rounded border transition-colors ${
            activeItalic
              ? 'bg-[#701CC0]/15 border-[#701CC0]/60 text-[#3b0d6b]'
              : 'border-transparent text-gray-700 hover:bg-gray-200'
          }`}
          title="Italic"
        >
          <FiItalic className={`w-4 h-4 ${activeItalic ? 'scale-110' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => formatText('underline')}
          className={`p-1.5 rounded border transition-colors ${
            activeUnderline
              ? 'bg-[#701CC0]/15 border-[#701CC0]/60 text-[#3b0d6b]'
              : 'border-transparent text-gray-700 hover:bg-gray-200'
          }`}
          title="Underline"
        >
          <FiUnderline className={`w-4 h-4 ${activeUnderline ? 'scale-110' : ''}`} />
        </button>
        <button
          type="button"
          onClick={cycleAlignment}
          className={`p-1.5 rounded border transition-colors ${
            activeAlign !== "none"
              ? 'bg-[#701CC0]/15 border-[#701CC0]/60 text-[#3b0d6b]'
              : 'border-transparent text-gray-700 hover:bg-gray-200'
          }`}
          title="Cycle Alignment"
        >
          {activeAlign === "center" ? (
            <FiAlignCenter className="w-4 h-4" />
          ) : activeAlign === "right" ? (
            <FiAlignRight className="w-4 h-4" />
          ) : (
            <FiAlignLeft className="w-4 h-4" />
          )}
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
          onClick={() => formatText('link')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
          title="Link"
        >
          <FiLink className="w-4 h-4" />
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
        className="min-h-[420px] max-h-[80vh] overflow-auto rounded-md resize-y"
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
          onKeyDown={(e) => {
            // Don't clear selection for navigation keys
            const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Shift', 'Control', 'Alt', 'Meta']
            if (navKeys.includes(e.key)) return
            
            if (selectedEmbedRef.current) {
              selectedEmbedRef.current.removeAttribute("data-selected")
              selectedEmbedRef.current = null
              setActiveAlign("none")
            }
          }}
          onInput={() => {
            if (!editableRef.current) return
            const newDisplay = editableRef.current.innerHTML
            // Mark this change as local to prevent caret-jumping resets
            isLocalEditRef.current = true
            onChange(toHtml(newDisplay))
            // Re-initialize embeds after content change
            requestAnimationFrame(() => {
              const embeds = editableRef.current?.querySelectorAll('.rte-embed:not([data-initialized])')
              embeds?.forEach((embed) => {
                setupEmbedHandlers(embed as HTMLElement)
              })
            })
          }}
          // Initial content is injected by the effect above; no innerHTML binding here to avoid caret resets.
        />
        {/* Force italic to never appear bold in the visible editor */}
        <style jsx global>{`
          #rte-visible em, #rte-visible i { font-weight: 400 !important; font-style: italic; }
          #rte-visible a, #rte-visible .rte-link { 
            color: #2563eb !important; 
            text-decoration: underline !important; 
            font-style: normal !important;
            font-weight: normal !important;
            position: relative;
            pointer-events: auto;
          }
          #rte-visible .rte-link:hover::after {
            content: attr(data-url);
            position: absolute;
            left: 0;
            top: 100%;
            margin-top: 6px;
            background: rgba(17, 24, 39, 0.9);
            color: #fff;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11px;
            line-height: 1.2;
            white-space: nowrap;
            z-index: 10;
          }
          #rte-visible a:hover { 
            color: #1d4ed8 !important; 
            text-decoration: underline !important; 
          }
          #rte-visible ul { 
            list-style-type: disc !important; 
            list-style-position: outside !important;
            padding-left: 24px !important; 
            margin: 8px 0 !important; 
          }
          #rte-visible ol { 
            list-style-type: decimal !important; 
            list-style-position: outside !important;
            padding-left: 24px !important; 
            margin: 8px 0 !important; 
          }
          #rte-visible li { 
            display: list-item !important; 
            margin-bottom: 4px; 
            line-height: 1.5; 
            list-style-type: inherit !important;
          }
          #rte-visible li::marker { 
            color: #111827 !important; 
            font-weight: normal !important;
          }
          #rte-visible .rte-embed { 
            display: block !important;
            margin: 12px 0 !important; 
            width: 100% !important;
            cursor: move !important;
            position: relative !important;
          }
          #rte-visible .rte-embed[data-dragging="true"] {
            opacity: 0.5 !important;
          }
          #rte-visible .rte-embed[data-drop-before="true"]::before {
            content: '' !important;
            display: block !important;
            height: 2px !important;
            background: #701CC0 !important;
            margin-bottom: -2px !important;
          }
          #rte-visible .rte-embed[data-drop-after="true"]::after {
            content: '' !important;
            display: block !important;
            height: 2px !important;
            background: #701CC0 !important;
            margin-top: -2px !important;
          }
          #rte-visible .rte-embed .rte-media { 
            display: block !important; 
            pointer-events: none !important;
            height: auto !important;
          }
          #rte-visible .rte-embed iframe.rte-media { max-width: 640px !important; height: 360px !important; border: 0 !important; }
          #rte-visible .rte-embed video.rte-media { max-width: 640px !important; max-height: 360px !important; }
          #rte-visible .rte-embed img.rte-media { max-width: 100% !important; border-radius: 8px !important; }
          /* Alignment styles */
          #rte-visible .rte-embed[data-align="left"] { text-align: left !important; }
          #rte-visible .rte-embed[data-align="center"] { text-align: center !important; }
          #rte-visible .rte-embed[data-align="right"] { text-align: right !important; }
          #rte-visible .rte-embed[data-align="left"] .rte-media { margin-left: 0 !important; margin-right: auto !important; }
          #rte-visible .rte-embed[data-align="center"] .rte-media { margin-left: auto !important; margin-right: auto !important; }
          #rte-visible .rte-embed[data-align="right"] .rte-media { margin-left: auto !important; margin-right: 0 !important; }
          #rte-visible .rte-embed[data-selected="true"] {
            outline: 3px solid #701CC0 !important;
            outline-offset: 4px !important;
            border-radius: 8px !important;
            box-shadow: 0 0 0 6px rgba(112, 28, 192, 0.15) !important;
          }
          #rte-visible .rte-resize-handle {
            position: absolute !important;
            width: 10px !important;
            height: 10px !important;
            background: #701CC0 !important;
            border: 2px solid white !important;
            border-radius: 2px !important;
            z-index: 10 !important;
            pointer-events: auto !important;
          }
          #rte-visible .rte-resize-handle-nw {
            left: -5px !important;
            top: -5px !important;
            cursor: nw-resize !important;
          }
          #rte-visible .rte-resize-handle-ne {
            right: -5px !important;
            top: -5px !important;
            cursor: ne-resize !important;
          }
          #rte-visible .rte-resize-handle-sw {
            left: -5px !important;
            bottom: -5px !important;
            cursor: sw-resize !important;
          }
          #rte-visible .rte-resize-handle-se {
            right: -5px !important;
            bottom: -5px !important;
            cursor: se-resize !important;
          }
          #rte-visible .rte-embed:not([data-selected="true"]) .rte-resize-handle {
            display: none !important;
          }
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
          const candidate = /^(https?:)?\/\//i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`
          try {
            const url = new URL(candidate)
            if (url.protocol !== "http:" && url.protocol !== "https:") return
          } catch {
            return
          }
          const sel = window.getSelection(); if (!sel) { setLinkModalOpen(false); return }
          sel.removeAllRanges(); sel.addRange(savedRangeRef.current);
          const a = document.createElement('a')
          const url = normalizeUrl(linkUrl)
          a.setAttribute('href', url)
          a.setAttribute('data-url', url)
          a.setAttribute('title', url)
          a.className = "rte-link not-prose"
          const fallbackText = sel.toString()
          const text = (linkText || fallbackText || linkUrl || "Link").trim()
          a.textContent = text || url
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
          setImageUrl('')
        }}
        onFileUpload={async (file) => {
          setImageModalOpen(false)
          const permanentUrl = await uploadBlogImage(file)
          if (permanentUrl) {
            insertPlaceholder('image', permanentUrl)
          }
        }}
        onCancel={() => { setImageModalOpen(false); setImageUrl('') }}
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
  const isValidLink = (() => {
    const raw = linkUrl.trim()
    if (!raw) return false
    try {
      const candidate = /^(https?:)?\/\//i.test(raw) ? raw : `https://${raw}`
      const url = new URL(candidate)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  })()

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
            disabled={!linkText.trim() || !isValidLink}
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
  onFileUpload: (file: File) => void
  onCancel: () => void
}> = ({ isOpen, imageUrl, onUrlChange, onConfirm, onFileUpload, onCancel }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
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
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#374151] mb-2">Upload from device</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setUploading(true)
                onFileUpload(file)
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full px-3 py-3 border-2 border-dashed border-[#D1D5DB] rounded-lg hover:border-green-400 hover:bg-green-50 text-sm text-[#6B7280] font-medium transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Click to select an image file'}
          </button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[#E5E7EB]" />
          <span className="text-xs text-[#9CA3AF] font-medium">OR</span>
          <div className="flex-1 h-px bg-[#E5E7EB]" />
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<{ id: number; title: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 6
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const [actionMenuOpen, setActionMenuOpen] = useState<number | null>(null)
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; right: number; showAbove: boolean } | null>(null)
  const actionMenuRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const actionMenuButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({})
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
    const handleClickOutside = (event: MouseEvent) => {
      Object.entries(actionMenuRefs.current).forEach(([id, ref]) => {
        if (ref && !ref.contains(event.target as Node)) {
          if (actionMenuOpen === Number(id)) {
            setActionMenuOpen(null)
            setActionMenuPosition(null)
          }
        }
      })
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [actionMenuOpen])

  useEffect(() => {
    if (actionMenuOpen) {
      const button = actionMenuButtonRefs.current[actionMenuOpen]
      if (button) {
        const rect = button.getBoundingClientRect()
        const dropdownHeight = 120
        const viewportHeight = window.innerHeight
        const viewportMiddle = viewportHeight / 2
        const showAbove = rect.top > viewportMiddle

        setActionMenuPosition({
          top: showAbove ? rect.top - dropdownHeight - 2 : rect.bottom + 2,
          right: window.innerWidth - rect.right,
          showAbove,
        })
      }
    } else {
      setActionMenuPosition(null)
    }
  }, [actionMenuOpen])

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
                                    <h3 className="text-sm font-semibold text-[#111827] mb-4">Sort & Filter</h3>
                                    
                                    {/* Date Sort */}
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
                                    
                                    {/* Clear Button */}
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
                        <div
                          className="relative inline-flex justify-end"
                          ref={(el) => { actionMenuRefs.current[p.id] = el }}
                        >
                          <button
                            type="button"
                            onClick={() => setActionMenuOpen(actionMenuOpen === p.id ? null : p.id)}
                            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                            aria-label="Manage post"
                            ref={(el) => { actionMenuButtonRefs.current[p.id] = el }}
                          >
                            <FiMoreVertical className="w-4 h-4 text-[#6B7280]" />
                          </button>
                          {actionMenuOpen === p.id && actionMenuPosition && (
                            <div
                              className="fixed w-40 bg-white rounded-lg shadow-xl border border-[#E5E7EB] py-1 z-[100]"
                              style={{
                                top: `${actionMenuPosition.top}px`,
                                right: `${actionMenuPosition.right}px`,
                              }}
                            >
                              <button
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
                                  setActionMenuOpen(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-[#374151]"
                              >
                                Edit
                              </button>
                              <div className="border-t border-[#E5E7EB] my-1" />
                              <button
                                onClick={() => {
                                  openDeleteModal({ id: p.id, title: p.title })
                                  setActionMenuOpen(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredPosts.length > pageSize && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-[#E5E7EB]">
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
          </div>
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


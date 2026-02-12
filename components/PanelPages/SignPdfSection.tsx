import React, { useState, useRef, MouseEvent, useEffect } from "react"
import PdfUploader from "@/components/ui/PdfUploader"
import { Inter } from "next/font/google"
import { Document, Page, pdfjs } from "react-pdf"
import { FiPenTool, FiCalendar, FiType, FiTrash2, FiChevronLeft, FiChevronRight, FiLink, FiCopy, FiFolderPlus, FiCheck } from "react-icons/fi"
import { FaRegFilePdf } from "react-icons/fa6"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
import type { PdfField } from "@/lib/sessionStore"

type StaffOption = { id: number; name: string | null; role: string }
type ClientOption = { id: string; name: string }

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`
}

const inter = Inter({ subsets: ["latin"] })

type ToolType = "signature" | "date" | "text" | null

const BOX_SIZES: Record<Exclude<ToolType, null>, { width: number; height: number }> = {
  signature: { width: 150, height: 50 },
  date: { width: 120, height: 24 },
  text: { width: 150, height: 28 },
}

const PDF_LOAD_TIMEOUT = 30000

const SignPdfSection: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [fields, setFields] = useState<PdfField[]>([])
  const [selectedTool, setSelectedTool] = useState<ToolType>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [pageDimensions, setPageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const [linkCopied, setLinkCopied] = useState<boolean>(false)
  const [fieldIdCounter, setFieldIdCounter] = useState(0)
  const [textFieldValues, setTextFieldValues] = useState<Record<string, string>>({})
  const [generatedTokenId, setGeneratedTokenId] = useState<string | null>(null)
  const [generatedFileName, setGeneratedFileName] = useState<string>("")
  const [recipientType, setRecipientType] = useState<"staff" | "client">("staff")
  const [recipientId, setRecipientId] = useState<string>("")
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([])
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const r = await fetch("/api/admin/users")
        if (r.ok) {
          const data = await r.json()
          setStaffOptions(
            (data || []).filter((u: { role?: string }) => u.role === "staff" || u.role === "admin")
          )
        }
      } catch {
        setStaffOptions([])
      }
    }
    const fetchClients = async () => {
      try {
        const r = await fetch("/api/admin/clients")
        if (r.ok) {
          const data = await r.json()
          setClientOptions((data || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
        }
      } catch {
        setClientOptions([])
      }
    }
    fetchStaff()
    fetchClients()
  }, [])

  const clearLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }
  }

  useEffect(() => {
    if (isPdfLoading) {
      clearLoadTimeout()
      loadTimeoutRef.current = setTimeout(() => {
        setError(
          "PDF loading timed out. The file might be too large, corrupted, or there could be network issues."
        )
        setIsPdfLoading(false)
      }, PDF_LOAD_TIMEOUT)
    } else {
      clearLoadTimeout()
    }
    return () => {
      clearLoadTimeout()
    }
  }, [isPdfLoading])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    clearLoadTimeout()
    setNumPages(numPages)
    setCurrentPage(1)
    setFields([])
    setSelectedTool(null)
    setGeneratedLink(null)
    setError(null)
    setPageDimensions(null)
    setIsPdfLoading(false)
  }

  const handlePdfLoadError = (err: Error) => {
    clearLoadTimeout()
    console.error("PDF Load Error:", err)
    let message = `Failed to load PDF: ${err.message}`
    if (err.name === "WorkerException") {
      message +=
        " The PDF worker failed. Please check your network connection or try reloading the page."
    } else if (err.message.includes("PasswordException")) {
      message = "Failed to load PDF: The document is password protected."
    } else if (err.message.includes("InvalidPDFException")) {
      message =
        "Failed to load PDF: The file appears to be invalid or corrupted."
    }
    setError(message)
    setIsPdfLoading(false)
  }

  const onPageLoadSuccess = (page: { width: number; height: number }) => {
    setPageDimensions({ width: page.width, height: page.height })
  }

  const handleFileSelect = (file: File) => {
    setPdfFile(file)
    setNumPages(null)
    setFields([])
    setSelectedTool(null)
    setTextFieldValues({})
    setGeneratedLink(null)
    setError(null)
    setPageDimensions(null)
    setIsPdfLoading(true)
    setLinkCopied(false)
  }

  const handlePageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!pageRef.current || !pageDimensions || !selectedTool) return
    const rect = pageRef.current.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top
    const { width: boxW, height: boxH } = BOX_SIZES[selectedTool]
    const boxLeft = Math.max(0, clickX - boxW / 2)
    const boxTop = Math.max(0, clickY - boxH / 2)
    const finalBoxLeft = Math.min(boxLeft, rect.width - boxW)
    const finalBoxTop = Math.min(boxTop, rect.height - boxH)
    const xRatio = finalBoxLeft / rect.width
    const yRatio = finalBoxTop / rect.height
    const newField: PdfField = {
      type: selectedTool,
      page: currentPage,
      xRatio,
      yRatio,
      width: boxW,
      height: boxH,
      id: `f-${fieldIdCounter}`,
    }
    setFieldIdCounter((c) => c + 1)
    setFields((prev) => [...prev, newField])
    setGeneratedLink(null)
    setError(null)
    setLinkCopied(false)
  }

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
    setTextFieldValues((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setGeneratedLink(null)
  }

  const handleGenerateLink = async () => {
    const hasSignature = fields.some((f) => f.type === "signature")
    if (!pdfFile || fields.length === 0 || !hasSignature) {
      setError("Upload a PDF, add at least one signature box from the toolbar, and place it on the page.")
      return
    }
    setIsLoading(true)
    setError(null)
    setGeneratedLink(null)
    setLinkCopied(false)

    const formData = new FormData()
    formData.append("pdf", pdfFile)
    formData.append("fields", JSON.stringify(fields))

    try {
      const response = await fetch("/api/generateSignLink", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        )
      }
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError)
        throw new Error("Server returned invalid response. Please try again.")
      }

      if (!data || !data.link) {
        throw new Error("Invalid server response (missing link)")
      }

      const fullLink = `${window.location.origin}${data.link}`
      const tokenId = data.link.replace(/^\/sign\//, "") || null
      setGeneratedLink(fullLink)
      setGeneratedTokenId(tokenId)
      setGeneratedFileName(pdfFile.name || "document.pdf")
      setRecipientId("")
      setSaveStatus("idle")
      setSaveError(null)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate signing link."
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = () => {
    if (!generatedLink) return
    navigator.clipboard.writeText(generatedLink).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  const handleSaveToFiles = async () => {
    if (!generatedTokenId || !recipientId) {
      setSaveError("Please select a staff member or client.")
      return
    }
    setSaveStatus("loading")
    setSaveError(null)
    try {
      const r = await fetch("/api/admin/saveToFiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: generatedTokenId,
          fileName: generatedFileName,
          recipientType,
          recipientId: recipientType === "staff" ? Number(recipientId) : recipientId,
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        throw new Error(data.message || "Failed to save")
      }
      setSaveStatus("success")
    } catch (e) {
      setSaveStatus("error")
      setSaveError(e instanceof Error ? e.message : "Failed to save to files.")
    }
  }

  const handleStartOver = () => {
    setPdfFile(null)
    setNumPages(null)
    setFields([])
    setSelectedTool(null)
    setGeneratedLink(null)
    setGeneratedTokenId(null)
    setGeneratedFileName("")
    setError(null)
    setLinkCopied(false)
  }

  const goToPrevPage = () => setCurrentPage((prev) => Math.max(1, prev - 1))
  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(numPages!, prev + 1))

  return (
    <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
      <div className="flex-1 flex justify-center px-6 pt-2 overflow-y-auto">
        <div className="w-full max-w-6xl flex flex-col h-full">
          <div className="w-full flex justify-between items-center mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">
                PDF Signer
              </h1>
            </div>
          </div>

          {!pdfFile ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full -mt-[20vh]">
              <div className="w-20 h-20 rounded-full bg-[#F3E8FF] flex items-center justify-center mb-4">
                <FaRegFilePdf className="w-10 h-10 text-[#701CC0]" />
              </div>
              <p className="text-sm text-[#6B7280] mb-4 text-center">Upload a PDF to create a signing link.</p>
              <div className="w-full max-w-md">
                <PdfUploader onFileSelect={handleFileSelect} />
              </div>
            </div>
          ) : generatedLink ? (
            <div className="w-full flex flex-col items-center max-w-xl mx-auto pb-12 pt-4">
              <div className="w-full bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#F3E8FF] flex items-center justify-center flex-shrink-0">
                      <FiLink className="w-6 h-6 text-[#701CC0]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#111827]">Link Generated</h3>
                      <p className="text-sm text-[#6B7280]">Share this link with the signer.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      className="flex-1 p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-[#111827] text-sm focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0]"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 bg-[#701CC0] text-white rounded-lg font-medium hover:bg-[#5F18B0] text-sm transition flex-shrink-0 ${inter.className}`}
                    >
                      <FiCopy className="w-4 h-4" />
                      Copy
                    </button>
                  </div>
                  {linkCopied && (
                    <p className="text-[#059669] text-sm mt-2 font-medium">Copied To Clipboard</p>
                  )}
                </div>
              </div>

              <div className="w-full mt-6 bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#F3E8FF] flex items-center justify-center flex-shrink-0">
                      <FiFolderPlus className="w-6 h-6 text-[#701CC0]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#111827]">Save To Files</h3>
                      <p className="text-sm text-[#6B7280]">Store this PDF for a staff member or client.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <label className="text-sm font-medium text-[#374151]">Save To:</label>
                        <select
                          value={recipientType}
                          onChange={(e) => {
                            setRecipientType(e.target.value as "staff" | "client")
                            setRecipientId("")
                            setSaveStatus("idle")
                            setSaveError(null)
                          }}
                          className="p-2.5 pl-3 pr-12 border border-[#E5E7EB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0]"
                        >
                          <option value="staff">Staff</option>
                          <option value="client">Client</option>
                        </select>
                      </div>
                      <select
                        value={recipientId}
                        onChange={(e) => {
                          setRecipientId(e.target.value)
                          setSaveStatus("idle")
                          setSaveError(null)
                        }}
                        className="flex-1 min-w-[200px] p-2.5 pl-3 pr-12 border border-[#E5E7EB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0]"
                      >
                        <option value="">Select {recipientType === "staff" ? "staff" : "client"}...</option>
                        {recipientType === "staff"
                          ? staffOptions.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name || s.role || `User ${s.id}`}
                              </option>
                            ))
                          : clientOptions.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                      </select>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={handleSaveToFiles}
                        disabled={saveStatus === "loading" || !recipientId}
                        className={`px-4 py-2.5 bg-[#701CC0] text-white rounded-lg font-medium hover:bg-[#5F18B0] disabled:opacity-50 disabled:cursor-not-allowed text-sm transition ${inter.className}`}
                      >
                        {saveStatus === "loading" ? "Saving..." : "Save To Files"}
                      </button>
                    </div>
                    {saveStatus === "error" && saveError && (
                      <p className="text-red-500 text-sm">{saveError}</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartOver}
                className="mt-8 inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-[#701CC0] text-[#701CC0] rounded-lg font-medium text-sm hover:bg-[#F3E8FF] hover:border-[#5F18B0] hover:text-[#5F18B0] transition"
              >
                <FaRegFilePdf className="w-4 h-4" />
                Create Another Link
              </button>

              {saveStatus === "success" && (
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
                  role="dialog"
                  aria-modal="true"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setSaveStatus("idle")
                  }}
                >
                  <div
                    className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                        <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                            <FiCheck className="h-6 w-6" />
                          </span>
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold text-[#111827] mb-2">Saved Successfully!</h3>
                      <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
                        The PDF has been saved to the selected files.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSaveStatus("idle")}
                        className="w-full rounded-lg px-4 py-2 bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full flex flex-col pb-12">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <span className="text-sm text-[#6B7280]">{pdfFile.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setPdfFile(null)
                    setNumPages(null)
                    setFields([])
                    setSelectedTool(null)
                    setGeneratedLink(null)
                    setError(null)
                  }}
                  className="text-sm text-[#701CC0] hover:text-[#5F18B0] font-medium"
                >
                  Change File
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg">
                <span className="text-sm font-medium text-[#374151] mr-2">Add:</span>
                <button
                  type="button"
                  onClick={() => setSelectedTool(selectedTool === "signature" ? null : "signature")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${inter.className} ${
                    selectedTool === "signature"
                      ? "bg-[#701CC0] text-white"
                      : "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6]"
                  }`}
                >
                  <FiPenTool className="w-4 h-4" />
                  Signature
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTool(selectedTool === "date" ? null : "date")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${inter.className} ${
                    selectedTool === "date"
                      ? "bg-[#701CC0] text-white"
                      : "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6]"
                  }`}
                >
                  <FiCalendar className="w-4 h-4" />
                  Date
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTool(selectedTool === "text" ? null : "text")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${inter.className} ${
                    selectedTool === "text"
                      ? "bg-[#701CC0] text-white"
                      : "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6]"
                  }`}
                >
                  <FiType className="w-4 h-4" />
                  Text Box
                </button>
                {selectedTool && (
                  <span className="text-xs text-[#6B7280] ml-2">
                    Click on the PDF to place the {selectedTool} field.
                  </span>
                )}
              </div>
              <div className="pdf-container border border-[#E5E7EB] mb-6 relative bg-[#F9FAFB] w-full rounded-lg overflow-hidden flex justify-center">
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={handlePdfLoadError}
                  loading={
                    isPdfLoading ? (
                      <div className="text-[#374151] p-4 text-center">
                        Loading PDF...
                      </div>
                    ) : null
                  }
                >
                  {!isPdfLoading &&
                    !error?.startsWith("Failed to load PDF") && (
                      <div
                          ref={pageRef}
                          onClick={handlePageClick}
                          style={{
                            position: "relative",
                            cursor: selectedTool ? "crosshair" : "default",
                            display: "inline-block",
                          }}
                        >
                          <Page
                            pageNumber={currentPage}
                            renderTextLayer={false}
                            onLoadSuccess={onPageLoadSuccess}
                            onRenderError={(err) =>
                              setError(
                                `Failed to render page ${currentPage}: ${err.message}`
                              )
                            }
                          />
                          {pageRef.current &&
                            fields
                              .filter((f) => f.page === currentPage)
                              .map((f) => (
                                <div
                                  key={f.id}
                                  style={{
                                    position: "absolute",
                                    left: `${f.xRatio * pageRef.current!.clientWidth}px`,
                                    top: `${f.yRatio * pageRef.current!.clientHeight}px`,
                                    width: `${f.width}px`,
                                    height: `${f.height}px`,
                                    border: "2px dashed #701CC0",
                                    backgroundColor:
                                      f.type === "signature"
                                        ? "rgba(112, 28, 192, 0.2)"
                                        : f.type === "date"
                                          ? "rgba(34, 197, 94, 0.2)"
                                          : "rgba(59, 130, 246, 0.2)",
                                    boxSizing: "border-box",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "10px",
                                    color: "#374151",
                                    overflow: "hidden",
                                  }}
                                  className="group"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="opacity-70 font-bold">
                                    {f.type === "signature"
                                      ? "Sign"
                                      : f.type === "date"
                                        ? new Date().toLocaleDateString()
                                        : textFieldValues[f.id ?? ""] || "Text"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (f.id) removeField(f.id)
                                    }}
                                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded flex items-center justify-center hover:bg-red-600 transition shadow-sm z-10"
                                    aria-label="Remove"
                                  >
                                    <FiTrash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                        </div>
                      )}
                </Document>
              </div>

              {error &&
                (error.startsWith("Failed to load PDF") ||
                  error.startsWith("Failed to render page") ||
                  error.startsWith("PDF loading timed out")) && (
                  <p className="text-red-500 my-4 text-center font-semibold">
                    {error}
                  </p>
                )}

              {!isPdfLoading &&
                numPages &&
                !error?.startsWith("Failed to load PDF") && (
                  <>
                    {numPages > 1 && (
                      <div className="flex items-center justify-center gap-3 mb-4 p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg">
                        <button
                          onClick={goToPrevPage}
                          disabled={currentPage <= 1}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-[#E5E7EB] bg-white text-[#374151] hover:border-[#701CC0] hover:text-[#701CC0] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#E5E7EB] disabled:hover:text-[#374151] transition ${inter.className}`}
                        >
                          <FiChevronLeft className="w-4 h-4" />
                          Prev
                        </button>
                        <span className="text-sm text-[#6B7280] min-w-[7rem] text-center">
                          {currentPage} / {numPages}
                        </span>
                        <button
                          onClick={goToNextPage}
                          disabled={currentPage >= numPages}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-[#E5E7EB] bg-white text-[#374151] hover:border-[#701CC0] hover:text-[#701CC0] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#E5E7EB] disabled:hover:text-[#374151] transition ${inter.className}`}
                        >
                          Next
                          <FiChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleGenerateLink}
                      disabled={isLoading || fields.length === 0 || !fields.some((f) => f.type === "signature")}
                      className={`px-6 py-3 bg-[#701CC0] text-white rounded-lg font-medium hover:bg-[#5F18B0] disabled:opacity-50 disabled:cursor-not-allowed transition ${inter.className}`}
                    >
                      {isLoading ? "Generating..." : "Generate Link"}
                    </button>

                    {error &&
                      !error.startsWith("Failed to load PDF") &&
                      !error.startsWith("Failed to render page") &&
                      !error.startsWith("PDF loading timed out") && (
                        <p className="text-red-500 mt-4 text-center">{error}</p>
                      )}
                  </>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SignPdfSection

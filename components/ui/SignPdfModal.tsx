import React, { useState, useRef, MouseEvent, useEffect } from "react"
import PdfUploader from "@/components/ui/PdfUploader"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import { Document, Page, pdfjs } from "react-pdf"
import Image from "next/image"
import { X } from "lucide-react"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

interface SignatureCoords {
  page: number
  xRatio: number
  yRatio: number
  width: number
  height: number
}

interface SignPdfModalProps {
  isOpen: boolean
  onClose: () => void
}

const SIGNATURE_BOX_WIDTH = 150
const SIGNATURE_BOX_HEIGHT = 50
const PDF_LOAD_TIMEOUT = 30000

const SignPdfModal: React.FC<SignPdfModalProps> = ({ isOpen, onClose }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [signatureCoords, setSignatureCoords] =
    useState<SignatureCoords | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [pageDimensions, setPageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const [linkCopied, setLinkCopied] = useState<boolean>(false)
  const pageRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  useEffect(() => {
    if (!isOpen) {
      setPdfFile(null)
      setNumPages(null)
      setCurrentPage(1)
      setSignatureCoords(null)
      setGeneratedLink(null)
      setIsLoading(false)
      setIsPdfLoading(false)
      setError(null)
      setPageDimensions(null)
      setLinkCopied(false)
      clearLoadTimeout()
    }
  }, [isOpen])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    clearLoadTimeout()
    setNumPages(numPages)
    setCurrentPage(1)
    setSignatureCoords(null)
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
    setSignatureCoords(null)
    setGeneratedLink(null)
    setError(null)
    setPageDimensions(null)
    setIsPdfLoading(true)
    setLinkCopied(false)
  }

  const handlePageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!pageRef.current || !pageDimensions) return
    const rect = pageRef.current.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top
    const boxLeft = Math.max(0, clickX - SIGNATURE_BOX_WIDTH / 2)
    const boxTop = Math.max(0, clickY - SIGNATURE_BOX_HEIGHT / 2)
    const finalBoxLeft = Math.min(boxLeft, rect.width - SIGNATURE_BOX_WIDTH)
    const finalBoxTop = Math.min(boxTop, rect.height - SIGNATURE_BOX_HEIGHT)
    const xRatio = finalBoxLeft / rect.width
    const yRatio = finalBoxTop / rect.height
    setSignatureCoords({
      page: currentPage,
      xRatio: xRatio,
      yRatio: yRatio,
      width: SIGNATURE_BOX_WIDTH,
      height: SIGNATURE_BOX_HEIGHT,
    })
    setGeneratedLink(null)
    setError(null)
    setLinkCopied(false)
  }

  const handleGenerateLink = async () => {
    if (!pdfFile || !signatureCoords) {
      setError("Upload a PDF and click on the page to select a signature spot.")
      return
    }
    setIsLoading(true)
    setError(null)
    setGeneratedLink(null)
    setLinkCopied(false)

    const formData = new FormData()
    formData.append("pdf", pdfFile)
    formData.append("coords", JSON.stringify(signatureCoords))

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
      // Try to safely parse the JSON response
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        throw new Error("Server returned invalid response. Please try again.");
      }
      
      // Validate that we got a link in the response
      if (!data || !data.link) {
        throw new Error("Invalid server response (missing link)");
      }
      
      const fullLink = `${window.location.origin}${data.link}`
      setGeneratedLink(fullLink)
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

  const goToPrevPage = () => setCurrentPage((prev) => Math.max(1, prev - 1))
  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(numPages!, prev + 1))

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm"
      onClick={handleOutsideClick}
    >
      <div
        ref={modalRef}
        className={`relative bg-[#18042A]/90 border border-[#701CC0]/50 backdrop-blur-md rounded-lg p-6 w-full max-w-4xl max-h-[90vh] shadow-lg text-white flex flex-col overflow-hidden ${inter.className}`}
      >
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors z-10"
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={24} />
        </button>

        <div className="flex justify-center mb-4 pt-2">
          <Image
            src="/assets/vierra-logo.png"
            alt="Vierra Logo"
            width={120}
            height={40}
            className="w-auto h-10"
          />
        </div>
        <h2
          className={`text-2xl font-bold mb-5 text-center ${bricolage.className}`}
        >
          Preparing The PDF
        </h2>

        <div className="flex-grow overflow-y-auto px-2 pb-4">
          {!pdfFile ? (
            <div className="w-full max-w-lg mx-auto mt-4">
              <PdfUploader onFileSelect={handleFileSelect} />
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              <p className="mb-2 text-sm">Selected File: {pdfFile.name}</p>
              <p className="mb-4 text-sm text-gray-300">
                Click on the PDF page below to place the signature box.
              </p>
              <div className="pdf-container border border-gray-500 mb-4 relative bg-white w-full">
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={handlePdfLoadError}
                  loading={
                    isPdfLoading ? (
                      <div className="text-black p-4 text-center">
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
                          cursor: "crosshair",
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
                        {signatureCoords &&
                          signatureCoords.page === currentPage &&
                          pageRef.current && (
                            <div
                              style={{
                                position: "absolute",
                                left: `${
                                  signatureCoords.xRatio *
                                  pageRef.current.clientWidth
                                }px`,
                                top: `${
                                  signatureCoords.yRatio *
                                  pageRef.current.clientHeight
                                }px`,
                                width: `${signatureCoords.width}px`,
                                height: `${signatureCoords.height}px`,
                                border: "2px dashed #701CC0",
                                backgroundColor: "rgba(112, 28, 192, 0.2)",
                                pointerEvents: "none",
                                boxSizing: "border-box",
                              }}
                            />
                          )}
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
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <button
                          onClick={goToPrevPage}
                          disabled={currentPage <= 1}
                          className={`px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-all duration-300 hover:scale-105 hover:bg-[#8F42FF] disabled:opacity-50 disabled:cursor-not-allowed ${inter.className}`}
                        >
                          Prev
                        </button>
                        <span className="text-white">{`Page ${currentPage} of ${numPages}`}</span>
                        <button
                          onClick={goToNextPage}
                          disabled={currentPage >= numPages}
                          className={`px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-all duration-300 hover:scale-105 hover:bg-[#8F42FF] disabled:opacity-50 disabled:cursor-not-allowed ${inter.className}`}
                        >
                          Next
                        </button>
                      </div>
                    )}

                    {signatureCoords && (
                      <p className="mb-4 text-sm text-green-400">
                        The signature spot has been selected on page{" "}
                        {signatureCoords.page}. Click on the PDF again to
                        change.
                      </p>
                    )}

                    <button
                      onClick={handleGenerateLink}
                      disabled={isLoading || !signatureCoords}
                      className={`px-6 py-3 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-all duration-300 hover:scale-105 hover:bg-[#8F42FF] disabled:opacity-50 disabled:cursor-not-allowed ${inter.className}`}
                    >
                      {isLoading ? "Generating..." : "Generate Link"}
                    </button>

                    {error &&
                      !error.startsWith("Failed to load PDF") &&
                      !error.startsWith("Failed to render page") &&
                      !error.startsWith("PDF loading timed out") && (
                        <p className="text-red-500 mt-4 text-center">{error}</p>
                      )}

                    {generatedLink && (
                      <div className="mt-6 p-4 bg-[#2a0f4a]/70 border border-[#701CC0]/60 rounded-lg w-full max-w-lg text-center shadow-md">
                        <p className="text-white mb-2 font-semibold">
                          Link Generated:
                        </p>
                        <input
                          type="text"
                          readOnly
                          value={generatedLink}
                          className="w-full p-2 bg-[#18042A] border border-[#701CC0]/50 rounded text-white mb-3 text-center focus:outline-none focus:ring-2 focus:ring-[#8F42FF]"
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          onClick={handleCopyLink}
                          className={`px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-all duration-300 hover:scale-105 hover:bg-[#8F42FF] text-sm ${inter.className}`}
                        >
                          Copy Link
                        </button>
                        {linkCopied && (
                          <p className="text-green-400 text-xs mt-2 transition-opacity duration-300">
                            Copied To Clipboard!
                          </p>
                        )}
                      </div>
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

export default SignPdfModal

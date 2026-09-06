import React, { useState, useMemo, useRef } from "react"
import { inter } from "@/lib/fonts";
import { FiFolder, FiTrash2, FiDownload, FiLock, FiUpload, FiFilter, FiChevronDown, FiRefreshCw } from "react-icons/fi"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ConfirmActionModal from "@/components/ui/ConfirmActionModal"
import {
  PanelButton,
  PanelDataTable,
  PanelEmptyCell,
  PanelHeader,
  PanelPage,
  PanelClearFilters,
  PanelPopover,
  PanelSearch,
  PanelSelect,
} from "@/components/panel/PanelTable"
import { useFetch } from "@/hooks/useFetch"
import { deletePanelFile, loadPanelFiles, uploadPanelFile, type PanelFile } from "@/lib/panel/files"


const getNameWithoutExtension = (name: string) =>
  name.replace(/\.[^/.]+$/, "") || name

type FilesSectionProps = {
  readOnly?: boolean
  fileFilter?: string
  allowDelete?: boolean
  showOwnerInReadOnly?: boolean
}

// Scope the entire request and action state to this client. Late responses from the
// previous client cannot populate the next client's list or deletion dialog.
const FilesSection: React.FC<FilesSectionProps> = (props) => (
  <FilesContent key={props.fileFilter || "me"} {...props} />
)

const FilesContent: React.FC<FilesSectionProps> = ({
  readOnly = false,
  fileFilter,
  allowDelete = false,
  showOwnerInReadOnly = false,
}) => {
  const canUpload = !readOnly || allowDelete
  const canDelete = !readOnly || allowDelete
  const showOwnerColumn = !readOnly || showOwnerInReadOnly

  const [search, setSearch] = useState("")
  const [fileType, setFileType] = useState("")
  const [owner, setOwner] = useState("")
  const [sort, setSort] = useState("name")
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  // Twenty-five a page, matching the other panel tables.
  const pageSize = 25
  const [fileToDelete, setFileToDelete] = useState<PanelFile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deletePending = useRef(false)
  const [deleteError, setDeleteError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const uploadPending = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const refreshButtonRef = useRef<HTMLButtonElement>(null)
  const {
    data: filesData,
    setData: setFiles,
    loading,
    error,
    run: fetchFiles,
  } = useFetch<PanelFile[]>(() => loadPanelFiles(fileFilter), { immediate: true })

  const files = useMemo(() => filesData ?? [], [filesData])

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase()
    return files.filter(f => f.name.toLowerCase().includes(q) && (!fileType || f.fileType === fileType) && (!owner || f.owner === owner)).sort((a, b) => sort === "type" ? a.fileType.localeCompare(b.fileType) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name))
  }, [files, search, fileType, owner, sort])
  const hasFilters = Boolean(search.trim() || fileType || owner)
  const clearFilters = () => { setSearch(""); setFileType(""); setOwner(""); setSort("name"); setCurrentPage(0); }

  // Clamped rather than reset from an effect (see ClientsSection's identical comment): searching
  // to a shorter list could leave currentPage past the end, and slicing beyond the array renders
  // an empty table with nothing to explain it.
  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / pageSize))
  const page = Math.min(currentPage, totalPages - 1)
  const paginatedFiles = filteredFiles.slice(page * pageSize, (page + 1) * pageSize)

  const handleUploadClick = () => { if (!uploadPending.current) fileInputRef.current?.click() }

  const runUpload = async (file: File) => {
    if (uploadPending.current) return
    uploadPending.current = true
    setUploading(true)
    setUploadError("")
    try {
      await uploadPanelFile(file, fileFilter)
      await fetchFiles()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload this file. Try again.")
    } finally {
      uploadPending.current = false
      setUploading(false)
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) await runUpload(file)
  }

  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canUpload || !e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    dragCounter.current += 1
    setIsDragging(true)
  }
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canUpload || !e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
  }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canUpload) return
    e.preventDefault()
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) setIsDragging(false)
  }
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (!canUpload) return
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await runUpload(file)
  }

  const handleConfirmDelete = async () => {
    if (!fileToDelete || deletePending.current || loading) return
    deletePending.current = true
    setDeleting(true)
    setDeleteError("")
    try {
      await deletePanelFile(fileToDelete.id)
      setFiles((prev) => (prev ?? []).filter((f) => f.id !== fileToDelete.id))
      setFileToDelete(null)
      requestAnimationFrame(() => refreshButtonRef.current?.focus())
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete this file. Try again.")
    } finally {
      deletePending.current = false
      setDeleting(false)
    }
  }

  const handleDownload = (file: PanelFile) => {
    if (file.signingTokenId) {
      window.open(
        `/api/admin/file/${encodeURIComponent(file.name)}?tokenId=${encodeURIComponent(file.signingTokenId)}`,
        "_blank", "noopener,noreferrer"
      )
    } else if (file.hasContent) {
      window.open(
        `/api/admin/file/${encodeURIComponent(file.name)}?id=${encodeURIComponent(file.id)}`,
        "_blank", "noopener,noreferrer"
      )
    }
  }

  return (
    <div className={inter.className}>
      <PanelPage>
        <PanelHeader title="Files">
          <PanelSearch
            id="files-search"
            label="Search files"
            placeholder="Search by file name"
            value={search}
            onChange={(value) => {
              setSearch(value)
              setCurrentPage(0)
            }}
          />
          <div className="relative">
            <PanelButton
              onClick={() => setShowFilters((v) => !v)}
              icon={<FiFilter className="h-4 w-4" />}
            >
              Filter
              <FiChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </PanelButton>
            {showFilters && (
              <PanelPopover>
                <h3 className="mb-3 text-[13px] font-semibold text-[#111827]">Sort &amp; Filter</h3>
                <PanelSelect
                  label="Sort By"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "name", label: "Name A–Z" },
                    { value: "type", label: "File Type" },
                  ]}
                />
                <PanelSelect
                  label="Type"
                  value={fileType}
                  onChange={(value) => {
                    setFileType(value)
                    setCurrentPage(0)
                  }}
                  options={[
                    { value: "", label: "All Types" },
                    ...Array.from(new Set(files.map((f) => f.fileType)))
                      .sort()
                      .map((type) => ({ value: type, label: type })),
                  ]}
                />
                {showOwnerColumn && (
                  <PanelSelect
                    label="Owner"
                    value={owner}
                    onChange={(value) => {
                      setOwner(value)
                      setCurrentPage(0)
                    }}
                    options={[
                      { value: "", label: "All Owners" },
                      ...Array.from(new Set(files.map((f) => f.owner).filter((v): v is string => Boolean(v))))
                        .sort()
                        .map((value) => ({ value, label: value })),
                    ]}
                  />
                )}
                <PanelClearFilters
                  onClick={() => {
                    clearFilters()
                    setShowFilters(false)
                  }}
                />
              </PanelPopover>
            )}
          </div>
          <PanelButton
            onClick={() => void fetchFiles()}
            disabled={loading || deleting}
            icon={<FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </PanelButton>
          {canUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelected}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <PanelButton
                variant="primary"
                onClick={handleUploadClick}
                disabled={uploading}
                icon={<FiUpload className="h-4 w-4" />}
              >
                {uploading ? "Uploading…" : "Upload File"}
              </PanelButton>
            </>
          )}
        </PanelHeader>

        {uploadError && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {uploadError}
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            {filesData !== null && <p className="mt-1">Showing previously loaded files.</p>}
            <button
              type="button"
              disabled={loading || deleting}
              onClick={() => void fetchFiles()}
              className="mt-2 rounded font-medium underline disabled:opacity-50"
            >
              Retry loading files
            </button>
          </div>
        )}

        {/* Drop anywhere over the table, not just on a target — the whole list is the affordance. */}
        <div
          className={`relative rounded-2xl ${isDragging ? "outline outline-2 outline-dashed outline-[#701CC0] outline-offset-4" : ""}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => void handleDrop(e)}
        >
          {isDragging && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#701CC0]/5">
              <p className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#701CC0] shadow-sm">
                Drop to upload
              </p>
            </div>
          )}
          <PanelDataTable<PanelFile>
            rows={filteredFiles}
            getRowKey={(file) => file.id}
            loading={loading && filesData === null}
            loadingLabel={<LoadingSpinner label="Loading File Data..." />}
            page={page}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            emptyTitle={hasFilters ? "No Files Found" : "No Files Yet"}
            emptyMessage={
              hasFilters
                ? "No files match your search."
                : "Documents saved to this workspace will appear here."
            }
            emptyImage={
              <div className="relative flex h-14 w-14 items-center justify-center">
                <div className="files-empty-ping absolute inset-0 rounded-full bg-[#E9D5FF]" />
                <div className="files-empty-icon relative flex h-14 w-14 items-center justify-center rounded-full bg-[#F3E8FF]">
                  <FiFolder className="w-7 h-7 text-[#701CC0]" />
                </div>
              </div>
            }
            emptyImageGapClassName="mb-3"
            emptyAction={
              hasFilters ? (
                <PanelButton onClick={clearFilters}>Clear All Filters</PanelButton>
              ) : null
            }
            columns={[
              {
                key: "name",
                header: "Name",
                cell: (file) => (
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        file.signingTokenId &&
                        window.open(
                          `/files/preview?tokenId=${encodeURIComponent(file.signingTokenId)}&name=${encodeURIComponent(file.name)}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      disabled={!file.signingTokenId}
                      aria-label={`Preview ${file.name} (opens in a new tab)`}
                      className="max-w-full truncate text-left font-medium text-[#111827] transition-colors hover:text-[#701CC0] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-[#111827]"
                    >
                      {getNameWithoutExtension(file.name)}
                    </button>
                    {!file.hasContent && (
                      <p className="text-[11.5px] text-[#9CA3AF]">Preview and download unavailable</p>
                    )}
                    {file.hasContent && !file.signingTokenId && (
                      <p className="text-[11.5px] text-[#9CA3AF]">Preview unavailable — download only</p>
                    )}
                  </div>
                ),
              },
              { key: "date", header: "Date", cell: (file) => file.date },
              { key: "type", header: "File Type", cell: (file) => file.fileType },
              ...(showOwnerColumn
                ? [{ key: "owner", header: "Owner", cell: (file: PanelFile) => file.owner ?? <PanelEmptyCell /> }]
                : []),
              {
                key: "manage",
                header: canDelete ? "Manage" : "Actions",
                align: "right" as const,
                cell: (file) => (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(file)}
                      disabled={!file.hasContent}
                      aria-label={`Download ${file.name}`}
                      className="rounded-md p-1.5 text-[#374151] transition-colors hover:bg-[#F5F3F9] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FiDownload className="w-4 h-4" />
                    </button>
                    {canDelete && !file.isDeletionProtected && (
                      <button
                        type="button"
                        disabled={loading || deleting}
                        onClick={() => {
                          setDeleteError("")
                          setFileToDelete(file)
                        }}
                        aria-label={`Delete ${file.name}`}
                        className="rounded-md p-1.5 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && file.isDeletionProtected && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md bg-[#F3F1F8] px-2 py-1 text-[11px] text-[#6B7280]"
                        title="This file is protected and cannot be deleted."
                      >
                        <FiLock className="w-3 h-3" />
                        Protected
                      </span>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>

        {canDelete && (
          <ConfirmActionModal
            isOpen={!!fileToDelete}
            title="Delete File"
            message={
              <>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-[#111827]">{fileToDelete?.name || ""}</span>? This
                action is permanent and cannot be undone.
              </>
            }
            confirmLabel="Delete File"
            busy={deleting}
            busyLabel="Deleting…"
            error={deleteError}
            onConfirm={handleConfirmDelete}
            onCancel={() => {
              if (!deletePending.current) {
                setFileToDelete(null)
                setDeleteError("")
              }
            }}
          />
        )}
      </PanelPage>

      <style jsx>{`
        .files-empty-ping {
          animation: filesEmptyPulse 1.8s ease-out infinite;
        }

        .files-empty-icon {
          animation: filesEmptyFloat 2.4s ease-in-out infinite;
        }

        @keyframes filesEmptyPulse {
          0% {
            transform: scale(0.75);
            opacity: 0.85;
          }
          70% {
            transform: scale(1.35);
            opacity: 0;
          }
          100% {
            transform: scale(1.35);
            opacity: 0;
          }
        }

        @keyframes filesEmptyFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
      `}</style>
    </div>
  )
}

export default FilesSection

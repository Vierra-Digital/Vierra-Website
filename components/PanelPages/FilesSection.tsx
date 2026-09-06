import React, { useState, useMemo, useRef, useEffect } from "react"
import { inter } from "@/lib/fonts";
import { FiFolder, FiTrash2, FiDownload, FiLock, FiFilter, FiChevronDown } from "react-icons/fi"
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
import { deletePanelFile, loadPanelFiles, type PanelFile } from "@/lib/panel/files"


const getNameWithoutExtension = (name: string) =>
  name.replace(/\.[^/.]+$/, "") || name

type FilesSectionProps = {
  readOnly?: boolean
  fileFilter?: string
  allowDelete?: boolean
  showOwnerInReadOnly?: boolean
  /**
   * Bumped by the panel each time Files becomes the visible section. The section stays mounted
   * behind display:none, so without this the list a reader comes back to is the one they left —
   * which is wrong the moment a PDF is filed here from the signer.
   */
  refreshTrigger?: number
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
  refreshTrigger = 0,
}) => {
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
  const filterRef = useRef<HTMLDivElement>(null)
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
  const clearFilters = () => { setSearch(""); setFileType(""); setOwner(""); setSort("name"); setCurrentPage(0); }

  // Clamped rather than reset from an effect (see ClientsSection's identical comment): searching
  // to a shorter list could leave currentPage past the end, and slicing beyond the array renders
  // an empty table with nothing to explain it.
  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / pageSize))
  const page = Math.min(currentPage, totalPages - 1)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false)
      }
    }
    if (showFilters) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showFilters])

  // Refetch when the panel says this section has been opened again.
  useEffect(() => {
    if (refreshTrigger > 0) void fetchFiles()
    // fetchFiles is stable for a given fileFilter; refreshTrigger is the only intended cause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  const handleConfirmDelete = async () => {
    if (!fileToDelete || deletePending.current || loading) return
    deletePending.current = true
    setDeleting(true)
    setDeleteError("")
    try {
      await deletePanelFile(fileToDelete.id)
      setFiles((prev) => (prev ?? []).filter((f) => f.id !== fileToDelete.id))
      setFileToDelete(null)
      requestAnimationFrame(() => document.getElementById("files-search")?.focus())
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
          <div className="relative" ref={filterRef}>
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
        </PanelHeader>

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

          <PanelDataTable<PanelFile>
            rows={filteredFiles}
            getRowKey={(file) => file.id}
            loading={loading && filesData === null}
            loadingLabel={<LoadingSpinner label="Loading File Data..." />}
            page={page}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            emptyTitle="No Files Found"
            emptyMessage="No files match your search."
            emptyImage={
              <div className="relative flex h-14 w-14 items-center justify-center">
                <div className="files-empty-ping absolute inset-0 rounded-full bg-[#E9D5FF]" />
                <div className="files-empty-icon relative flex h-14 w-14 items-center justify-center rounded-full bg-[#F3E8FF]">
                  <FiFolder className="w-7 h-7 text-[#701CC0]" />
                </div>
              </div>
            }
            emptyImageGapClassName="mb-3"
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

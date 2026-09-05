import React, { useState, useMemo, useRef } from "react"
import { inter } from "@/lib/fonts";
import { FiFolder, FiTrash2, FiDownload, FiLock } from "react-icons/fi"
import PanelSearchInput from "@/components/ui/PanelSearchInput"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import PanelSectionHeader from "@/components/ui/PanelSectionHeader"
import ConfirmActionModal from "@/components/ui/ConfirmActionModal"
import { useFetch } from "@/hooks/useFetch"
import { deletePanelFile, loadPanelFiles, type PanelFile } from "@/lib/panel/files"


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
  const [search, setSearch] = useState("")
  const [fileType, setFileType] = useState("")
  const [owner, setOwner] = useState("")
  const [sort, setSort] = useState("name")
  const [fileToDelete, setFileToDelete] = useState<PanelFile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deletePending = useRef(false)
  const [deleteError, setDeleteError] = useState("")
  const [notice, setNotice] = useState("")
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
  const clearFilters = () => { setSearch(""); setFileType(""); setOwner(""); setSort("name"); }

  const handleConfirmDelete = async () => {
    if (!fileToDelete || deletePending.current || loading) return
    deletePending.current = true
    setDeleting(true)
    setDeleteError("")
    setNotice("")
    try {
      await deletePanelFile(fileToDelete.id)
      setFiles((prev) => (prev ?? []).filter((f) => f.id !== fileToDelete.id))
      setNotice(`Deleted ${fileToDelete.name}.`)
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
    }
  }

  const canDelete = !readOnly || allowDelete
  const showOwnerColumn = !readOnly || showOwnerInReadOnly

  return (
    <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
      <div className="flex-1 flex justify-center px-6 pt-2 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1680px] flex flex-col h-full">
          <PanelSectionHeader
            title="Files"
            actions={
              <PanelSearchInput
                id="files-search"
                value={search}
                onChange={setSearch}
                placeholder="Search by File Name"
                label="Search files"
              />
            }
          />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B7280]">
            <p>{filesData !== null ? `${filteredFiles.length} of ${files.length} files` : "Files"}</p>
            <button ref={refreshButtonRef} type="button" disabled={loading || deleting} onClick={() => { setNotice(""); void fetchFiles(); }} className="rounded-md border border-[#E5E7EB] px-3 py-2 text-[#374151] hover:bg-gray-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#701CC0]">
              {loading ? "Refreshing…" : "Refresh files"}
            </button>
          </div>
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <label>Type <select value={fileType} onChange={e => setFileType(e.target.value)} className="rounded border p-2"><option value="">All types</option>{Array.from(new Set(files.map(f => f.fileType))).sort().map(type => <option key={type}>{type}</option>)}</select></label>
            {showOwnerColumn && <label>Owner <select value={owner} onChange={e => setOwner(e.target.value)} className="rounded border p-2"><option value="">All owners</option>{Array.from(new Set(files.map(f => f.owner).filter((value): value is string => Boolean(value)))).sort().map(value => <option key={value}>{value}</option>)}</select></label>}
            <label>Sort <select value={sort} onChange={e => setSort(e.target.value)} className="rounded border p-2"><option value="name">Name A?Z</option><option value="type">File type</option></select></label>
            {hasFilters && <button onClick={clearFilters} className="underline">Clear filters</button>}
          </div>
          {notice && <p role="status" className="mb-4 text-sm text-green-700">{notice}</p>}
          {error && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p>{error}</p>
              {filesData !== null && <p className="mt-1">Showing previously loaded files.</p>}
              <button type="button" disabled={loading || deleting} onClick={() => void fetchFiles()} className="mt-2 rounded font-medium underline disabled:opacity-50">Retry loading files</button>
            </div>
          )}
          {loading && filesData === null ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner label="Loading File Data..." />
            </div>
          ) : filesData === null ? null : filteredFiles.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-10">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
                  <div className="files-empty-ping absolute inset-0 rounded-full bg-[#E9D5FF]" />
                  <div className="files-empty-icon relative flex h-14 w-14 items-center justify-center rounded-full bg-[#F3E8FF]">
                    <FiFolder className="w-7 h-7 text-[#701CC0]" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-[#111827]">{hasFilters ? "No matching files" : "No files yet"}</h3>
                <p className="text-sm text-[#6B7280] mt-2 max-w-md">
                  {hasFilters ? "Try another file name or clear your filters." : "Documents saved to this workspace will appear here."}
                </p>
                {hasFilters && <button type="button" onClick={clearFilters} className="mt-3 rounded text-sm font-medium text-[#701CC0] underline">Clear filters</button>}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                        File Type
                      </th>
                      {showOwnerColumn && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                          Owner
                        </th>
                      )}
                      <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                        {canDelete ? "Manage" : "Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#E5E7EB]">
                    {filteredFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-purple-50">
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              file.signingTokenId &&
                              window.open(
                                `/files/preview?tokenId=${encodeURIComponent(file.signingTokenId)}&name=${encodeURIComponent(file.name)}`,
                                "_blank", "noopener,noreferrer"
                              )
                            }
                            disabled={!file.signingTokenId}
                            aria-label={`Preview ${file.name} (opens in a new tab)`}
                            className="text-sm font-medium text-[#111827] hover:text-[#701CC0] hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline disabled:hover:text-[#111827] text-left"
                          >
                            {getNameWithoutExtension(file.name)}
                          </button>
                          {!file.signingTokenId && <p className="mt-1 text-xs text-[#6B7280]">Preview and download unavailable</p>}
                          {file.isDeletionProtected && <p className="mt-1 text-xs text-[#6B7280]">Protected file — cannot be deleted</p>}
                        </td>
                        <td className="px-4 py-4 text-sm text-[#374151]">
                          {file.date}
                        </td>
                        <td className="px-4 py-4 text-sm text-[#374151]">
                          {file.fileType}
                        </td>
                        {showOwnerColumn && (
                          <td className="px-4 py-4 text-sm text-[#374151]">
                            {file.owner ?? "—"}
                          </td>
                        )}
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleDownload(file)}
                              disabled={!file.signingTokenId}
                              className="p-1.5 rounded-md hover:bg-gray-100 text-[#374151] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label={`Download ${file.name}`}
                            >
                              <FiDownload className="w-4 h-4" />
                            </button>
                            {canDelete && !file.isDeletionProtected && (
                              <button
                                type="button"
                                disabled={loading || deleting}
                                onClick={() => { setDeleteError(""); setFileToDelete(file); }}
                                className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors"
                                aria-label={`Delete ${file.name}`}
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && file.isDeletionProtected && (
                              <span
                                className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] px-2 py-1 text-[11px] text-[#6B7280]"
                                title="This file is protected and cannot be deleted."
                              >
                                <FiLock className="w-3 h-3" />
                                Protected
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {canDelete && (
            <ConfirmActionModal
              isOpen={!!fileToDelete}
              title="Delete File"
              message={
                <>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-[#111827]">
                    {fileToDelete?.name || ""}
                  </span>
                  ? This action is permanent and cannot be undone.
                </>
              }
              confirmLabel="Delete File"
              busy={deleting}
              busyLabel="Deleting…"
              error={deleteError}
              onConfirm={handleConfirmDelete}
              onCancel={() => { if (!deletePending.current) { setFileToDelete(null); setDeleteError(""); } }}
            />
          )}
        </div>
      </div>
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

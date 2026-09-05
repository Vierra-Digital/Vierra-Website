import React, { useState, useMemo, useEffect, useRef } from "react"
import { inter } from "@/lib/fonts";
import { FiFolder, FiTrash2, FiDownload, FiLock } from "react-icons/fi"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import {
  PanelCard,
  PanelEmptyCell,
  PanelHeader,
  PanelPage,
  PanelSearch,
  PanelTable,
  PanelTbody,
  PanelTd,
  PanelTh,
  PanelThead,
  PanelTr,
} from "@/components/panel/PanelTable"
import ConfirmActionModal from "@/components/ui/ConfirmActionModal"
import { useFetch } from "@/hooks/useFetch"


const getNameWithoutExtension = (name: string) =>
  name.replace(/\.[^/.]+$/, "") || name

interface FileItem {
  id: string
  name: string
  date: string
  fileType: string
  signingTokenId?: string
  owner?: string
  isDeletionProtected?: boolean
}

const FilesSection: React.FC<{
  readOnly?: boolean
  fileFilter?: string
  allowDelete?: boolean
  showOwnerInReadOnly?: boolean
}> = ({
  readOnly = false,
  fileFilter,
  allowDelete = false,
  showOwnerInReadOnly = false,
}) => {
  const [search, setSearch] = useState("")
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null)
  const {
    data: filesData,
    setData: setFiles,
    loading,
    run: fetchFiles,
  } = useFetch<FileItem[]>(async () => {
    try {
      const url = fileFilter ? `/api/admin/files?filter=${encodeURIComponent(fileFilter)}` : "/api/admin/files"
      const r = await fetch(url)
      if (r.ok) {
        const data = await r.json()
        return (data || []) as FileItem[]
      }
      return []
    } catch {
      return []
    }
  }, { immediate: true })

  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    fetchFiles()
  }, [fileFilter, fetchFiles])

  const files = useMemo(() => filesData ?? [], [filesData])

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files
    const q = search.trim().toLowerCase()
    return files.filter((f) => f.name.toLowerCase().includes(q))
  }, [files, search])

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return
    try {
      const r = await fetch(`/api/admin/deleteFile?id=${encodeURIComponent(fileToDelete.id)}`, {
        method: "DELETE",
      })
      if (r.ok) {
        setFiles((prev) => (prev ?? []).filter((f) => f.id !== fileToDelete.id))
      }
    } catch {
      console.error("Failed to delete")
    } finally {
      setFileToDelete(null)
    }
  }

  const handleDownload = (file: FileItem) => {
    if (file.signingTokenId) {
      window.open(
        `/api/admin/file/${encodeURIComponent(file.name)}?tokenId=${encodeURIComponent(file.signingTokenId)}`,
        "_blank"
      )
    }
  }

  const canDelete = !readOnly || allowDelete
  const showOwnerColumn = !readOnly || showOwnerInReadOnly

  return (
    <div className={inter.className}>
      <PanelPage>
          <PanelHeader title="Files">
            <PanelSearch
              id="files-search"
              label="Search files"
              placeholder="Search by file name"
              value={search}
              onChange={setSearch}
            />
          </PanelHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner label="Loading File Data..." />
            </div>
          ) : filteredFiles.length === 0 ? (
            <PanelCard>
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
                  <div className="files-empty-ping absolute inset-0 rounded-full bg-[#E9D5FF]" />
                  <div className="files-empty-icon relative flex h-14 w-14 items-center justify-center rounded-full bg-[#F3E8FF]">
                    <FiFolder className="w-7 h-7 text-[#701CC0]" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-[#111827]">No Files Found</h3>
                <p className="text-sm text-[#6B7280] mt-2 max-w-md">
                  {search ? "No files match your search." : "Files you upload will appear here."}
                </p>
              </div>
            </PanelCard>
          ) : (
            <PanelCard>
              <PanelTable>
                  <PanelThead>
                    <PanelTh>Name</PanelTh>
                    <PanelTh>Date</PanelTh>
                    <PanelTh>File Type</PanelTh>
                    {showOwnerColumn && <PanelTh>Owner</PanelTh>}
                    <PanelTh className="!text-right">{canDelete ? "Manage" : "Actions"}</PanelTh>
                  </PanelThead>
                  <PanelTbody>
                    {filteredFiles.map((file) => (
                      <PanelTr key={file.id}>
                        <PanelTd>
                          <button
                            type="button"
                            onClick={() =>
                              file.signingTokenId &&
                              window.open(
                                `/files/preview?tokenId=${encodeURIComponent(file.signingTokenId)}&name=${encodeURIComponent(file.name)}`,
                                "_blank"
                              )
                            }
                            disabled={!file.signingTokenId}
                            className="max-w-full truncate text-left font-medium text-[#111827] transition-colors hover:text-[#701CC0] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-[#111827]"
                          >
                            {getNameWithoutExtension(file.name)}
                          </button>
                        </PanelTd>
                        <PanelTd>{file.date}</PanelTd>
                        <PanelTd>{file.fileType}</PanelTd>
                        {showOwnerColumn && <PanelTd>{file.owner ?? <PanelEmptyCell />}</PanelTd>}
                        <PanelTd className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleDownload(file)}
                              disabled={!file.signingTokenId}
                              className="p-1.5 rounded-md hover:bg-gray-100 text-[#374151] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Download"
                            >
                              <FiDownload className="w-4 h-4" />
                            </button>
                            {canDelete && !file.isDeletionProtected && (
                              <button
                                type="button"
                                onClick={() => setFileToDelete(file)}
                                className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors"
                                aria-label="Delete"
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
                        </PanelTd>
                      </PanelTr>
                    ))}
                  </PanelTbody>
              </PanelTable>
            </PanelCard>
          )}

          {canDelete && (
            <ConfirmActionModal
              isOpen={!!fileToDelete}
              title="Delete File"
              message={
                <>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-[#111827]">
                    {fileToDelete ? getNameWithoutExtension(fileToDelete.name) : ""}
                  </span>
                  ? This action is permanent and cannot be undone.
                </>
              }
              confirmLabel="Delete File"
              onConfirm={handleConfirmDelete}
              onCancel={() => setFileToDelete(null)}
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

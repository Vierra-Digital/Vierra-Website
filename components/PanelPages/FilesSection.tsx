import React, { useState, useMemo, useEffect } from "react"
import { Inter } from "next/font/google"
import { FiFolder, FiSearch, FiTrash2, FiDownload } from "react-icons/fi"

const inter = Inter({ subsets: ["latin"] })

const getNameWithoutExtension = (name: string) =>
  name.replace(/\.[^/.]+$/, "") || name

const ConfirmDeleteFileModal: React.FC<{
  isOpen: boolean
  fileName: string
  onConfirm: () => void
  onCancel: () => void
}> = ({ isOpen, fileName, onConfirm, onCancel }) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <FiTrash2 className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-[#111827]">Delete File</h3>
        </div>
        <p className="text-sm text-[#6B7280] mb-6">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-[#111827]">{fileName}</span>? This
          action is permanent and cannot be undone.
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
            Delete File
          </button>
        </div>
      </div>
    </div>
  )
}

interface FileItem {
  id: string
  name: string
  date: string
  fileType: string
  signingTokenId?: string
  owner?: string
}

const FilesSection: React.FC = () => {
  const [search, setSearch] = useState("")
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null)

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const r = await fetch("/api/admin/files")
        if (r.ok) {
          const data = await r.json()
          setFiles(data || [])
        }
      } catch {
        setFiles([])
      } finally {
        setLoading(false)
      }
    }
    fetchFiles()
  }, [])

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
        setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id))
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
        `/api/admin/downloadFile?tokenId=${encodeURIComponent(file.signingTokenId)}&name=${encodeURIComponent(file.name)}`,
        "_blank"
      )
    }
  }

  return (
    <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
      <div className="flex-1 flex justify-center px-6 pt-2 overflow-y-auto">
        <div className="w-full max-w-6xl flex flex-col h-full">
          <div className="w-full flex justify-between items-center mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">
                Files
              </h1>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition">
              <FiSearch className="w-4 h-4 text-[#701CC0] flex-shrink-0" />
              <label htmlFor="files-search" className="sr-only">
                Search files
              </label>
              <input
                id="files-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name"
                className="w-64 md:w-80 text-sm text-[#111827] placeholder:text-[#9CA3AF] bg-transparent outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-10 text-center text-[#6B7280]">
              Loading...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-10">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-[#F3E8FF] flex items-center justify-center mb-4">
                  <FiFolder className="w-7 h-7 text-[#701CC0]" />
                </div>
                <h3 className="text-lg font-semibold text-[#111827]">No Files Found</h3>
                <p className="text-sm text-[#6B7280] mt-2 max-w-md">
                  Files you upload will appear here.
                </p>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                        Owner
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                        Manage
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
                                "_blank"
                              )
                            }
                            disabled={!file.signingTokenId}
                            className="text-sm font-medium text-[#111827] hover:text-[#701CC0] hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline disabled:hover:text-[#111827] text-left"
                          >
                            {getNameWithoutExtension(file.name)}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#374151]">
                          {file.date}
                        </td>
                        <td className="px-4 py-4 text-sm text-[#374151]">
                          {file.fileType}
                        </td>
                        <td className="px-4 py-4 text-sm text-[#374151]">
                          {file.owner ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-right">
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
                            <button
                              type="button"
                              onClick={() => setFileToDelete(file)}
                              className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors"
                              aria-label="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ConfirmDeleteFileModal
            isOpen={!!fileToDelete}
            fileName={fileToDelete ? getNameWithoutExtension(fileToDelete.name) : ""}
            onConfirm={handleConfirmDelete}
            onCancel={() => setFileToDelete(null)}
          />
        </div>
      </div>
    </div>
  )
}

export default FilesSection

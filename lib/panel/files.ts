export interface PanelFile {
  id: string;
  name: string;
  date: string;
  fileType: string;
  signingTokenId?: string | null;
  /** Whether this file has bytes retrievable at all (signing-flow token or storage_key). */
  hasContent?: boolean;
  owner?: string;
  isDeletionProtected?: boolean;
}

/** A failed or malformed response must never become an empty file list. */
export async function loadPanelFiles(fileFilter?: string): Promise<PanelFile[]> {
  const url = fileFilter ? `/api/admin/files?filter=${encodeURIComponent(fileFilter)}` : "/api/admin/files";
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error();
    const data: unknown = await response.json();
    if (!Array.isArray(data) || !data.every((file) =>
      file && typeof file === "object" &&
      typeof file.id === "string" && typeof file.name === "string" &&
      typeof file.date === "string" && typeof file.fileType === "string"
    )) throw new Error();
    return data;
  } catch {
    throw new Error("Could not load files. Try again.");
  }
}

/**
 * Uploads a file straight to storage via a signed URL (see /api/admin/uploadFileUrl), then
 * confirms it into a `stored_files` row (/api/admin/uploadFile) — same two-step shape as the
 * blog editor's image upload, so the bytes never pass through a serverless function.
 */
export async function uploadPanelFile(file: File, clientId?: string): Promise<void> {
  const signResp = await fetch("/api/admin/uploadFileUrl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name }),
  });
  if (!signResp.ok) {
    const body = await signResp.json().catch(() => ({}));
    throw new Error(body?.message || "Could not start the upload.");
  }
  const { signedUrl, storageKey } = await signResp.json();
  if (!signedUrl || !storageKey) {
    throw new Error("Could not start the upload.");
  }

  const put = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) {
    throw new Error("Upload failed. Try again.");
  }

  const confirmResp = await fetch("/api/admin/uploadFile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storageKey, filename: file.name, clientId }),
  });
  if (!confirmResp.ok) {
    const body = await confirmResp.json().catch(() => ({}));
    throw new Error(body?.message || "Could not save the uploaded file.");
  }
}

export async function deletePanelFile(id: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/deleteFile?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    throw new Error("Could not confirm deletion. Close this dialog and refresh the list before trying again.");
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("This file is no longer available. Close this dialog and refresh the list.");
    }
    if (response.status === 403) {
      throw new Error("This file is protected or you no longer have permission to delete it.");
    }
    throw new Error("Could not confirm deletion. Close this dialog and refresh the list before trying again.");
  }
  const result: unknown = await response.json().catch(() => null);
  if (!result || typeof result !== "object" || !("success" in result) || result.success !== true) {
    throw new Error("Could not confirm deletion. Close this dialog and refresh the list before trying again.");
  }
}

export interface PanelFile {
  id: string;
  name: string;
  date: string;
  fileType: string;
  signingTokenId?: string | null;
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

/**
 * Shared allowlist for the Files tab's generic upload path. Extension-based (not the browser's
 * `file.type`, which is an unreliable sniffing guess and often empty for common types like .csv) —
 * both the signed-upload-URL route and the upload-confirm route import this so a file can't be
 * mistakenly minted a storage key under one set of rules and recorded under another.
 */
const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  zip: "application/zip",
};

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

/** The `file_type` value to store (e.g. "pdf"), or null when the extension isn't allowed. */
export function getUploadFileType(filename: string): string | null {
  const ext = extensionOf(filename);
  return ext && CONTENT_TYPES[ext] ? ext : null;
}

/** The storage object's Content-Type for an already-validated filename. */
export function getUploadContentType(filename: string): string {
  return contentTypeForExtension(extensionOf(filename));
}

/** Content-Type for a `stored_files.file_type` value (an extension, e.g. "docx"). */
export function contentTypeForExtension(fileType: string): string {
  return CONTENT_TYPES[fileType.toLowerCase()] || "application/octet-stream";
}

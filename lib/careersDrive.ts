import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";
import { resolveGoogleWebClientCredentials } from "@/lib/api/oauth";
import { getJobRole } from "@/lib/careers";

/**
 * Server-only helper for uploading career applications into the per-role Google
 * Drive folder that the recruiting routine reads from.
 *
 * Auth mirrors the GA4 client: the shared Google OAuth web client
 * (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) plus a Drive-scoped refresh token.
 * The account that minted the refresh token must have edit access to the target
 * folders. Required scope: https://www.googleapis.com/auth/drive
 *
 * Folder resolution, in order:
 *   1. CAREERS_DRIVE_FOLDERS — a JSON map of role slug -> the exact Drive folder
 *      id to upload into (the role's resume subfolder).
 *      e.g. {"junior-software-engineer":"1AbC...","ui-ux-designer":"1XyZ..."}
 *      This is the most reliable option — run `npm run connect-drive` to print it.
 *   2. CAREERS_DRIVE_ROOT_FOLDER_ID — the "Overhead" parent. The resolver walks
 *      root -> role subfolder (matched by role title/slug) -> resume subfolder
 *      (a child folder matching /resume|cv/i). Missing folders are created. Name
 *      matching is normalized so it reuses your existing folders instead of
 *      duplicating them.
 * A slug present in (1) always wins. If neither is configured, uploads are
 * disabled and the API route reports it.
 */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

function trimEnv(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function getRefreshToken() {
  return trimEnv(process.env.CAREERS_DRIVE_REFRESH_TOKEN);
}

export function isCareersDriveConfigured(): boolean {
  const { clientId, clientSecret } = resolveGoogleWebClientCredentials();
  const hasAuth = !!(clientId && clientSecret && getRefreshToken());
  const hasTarget =
    !!trimEnv(process.env.CAREERS_DRIVE_FOLDERS) ||
    !!trimEnv(process.env.CAREERS_DRIVE_ROOT_FOLDER_ID);
  return hasAuth && hasTarget;
}

function getDrive(): drive_v3.Drive {
  const { clientId, clientSecret } = resolveGoogleWebClientCredentials();
  const refreshToken = getRefreshToken();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Careers Drive auth is not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CAREERS_DRIVE_REFRESH_TOKEN)"
    );
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken, scope: DRIVE_SCOPE });
  return google.drive({ version: "v3", auth: oauth2 });
}

function parseFolderMap(): Record<string, string> {
  const raw = trimEnv(process.env.CAREERS_DRIVE_FOLDERS);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
  } catch {
    // fall through — a malformed map shouldn't take down the whole route
  }
  return {};
}

/** Lowercase alphanumerics only — for tolerant folder-name matching. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** List non-trashed child folders of a parent. */
async function listChildFolders(
  drive: drive_v3.Drive,
  parentId: string
): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const list = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of list.data.files || []) {
      if (f.id && f.name) out.push({ id: f.id, name: f.name });
    }
    pageToken = list.data.nextPageToken || undefined;
  } while (pageToken);
  return out;
}

async function createFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string> {
  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Failed to create folder "${name}"`);
  return created.data.id;
}

/** Find the role's subfolder under the Overhead root by title/slug; create if absent. */
async function resolveRoleSubfolder(
  drive: drive_v3.Drive,
  rootId: string,
  slug: string
): Promise<string> {
  const role = getJobRole(slug);
  const title = role ? role.title : slug;
  const candidates = [normalize(title), normalize(slug)];
  const children = await listChildFolders(drive, rootId);
  const match = children.find((c) => candidates.includes(normalize(c.name)));
  if (match) return match.id;
  return createFolder(drive, rootId, title);
}

/** Find the resume subfolder inside a role folder; create "Resumes" if absent. */
async function resolveResumeSubfolder(
  drive: drive_v3.Drive,
  roleFolderId: string
): Promise<string> {
  const children = await listChildFolders(drive, roleFolderId);
  const byName = children.find((c) => /resum|cv/i.test(c.name));
  if (byName) return byName.id;
  // If the role folder has exactly one subfolder, treat it as the resume folder.
  if (children.length === 1) return children[0].id;
  return createFolder(drive, roleFolderId, "Resumes");
}

/** Resolve the destination Drive folder id for a given role slug. */
async function resolveRoleFolderId(drive: drive_v3.Drive, slug: string): Promise<string> {
  const mapped = parseFolderMap()[slug];
  if (mapped) return mapped;

  const root = trimEnv(process.env.CAREERS_DRIVE_ROOT_FOLDER_ID);
  if (root) {
    const roleFolderId = await resolveRoleSubfolder(drive, root, slug);
    return resolveResumeSubfolder(drive, roleFolderId);
  }

  throw new Error(
    `No Drive folder configured for role "${slug}" (set CAREERS_DRIVE_FOLDERS or CAREERS_DRIVE_ROOT_FOLDER_ID)`
  );
}

export interface UploadFileInput {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface UploadResult {
  id: string;
  name: string;
}

/** Upload one file into the resolved per-role folder. */
async function uploadOne(
  drive: drive_v3.Drive,
  folderId: string,
  file: UploadFileInput,
  description?: string
): Promise<UploadResult> {
  const res = await drive.files.create({
    requestBody: { name: file.filename, parents: [folderId], description },
    media: { mimeType: file.mimeType, body: Readable.from(file.buffer) },
    fields: "id, name",
    supportsAllDrives: true,
  });
  return { id: res.data.id || "", name: res.data.name || file.filename };
}

const DRIVE_UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true";

/** Mint a short-lived OAuth access token for the careers Drive account. */
async function getDriveAccessToken(): Promise<string> {
  const { clientId, clientSecret } = resolveGoogleWebClientCredentials();
  const refreshToken = getRefreshToken();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Careers Drive auth is not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CAREERS_DRIVE_REFRESH_TOKEN)"
    );
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken, scope: DRIVE_SCOPE });
  const { token } = await oauth2.getAccessToken();
  if (!token) throw new Error("Could not obtain a Drive access token");
  return token;
}

/**
 * Open a Google Drive resumable upload and return its session URI. The browser
 * (via our chunk proxy) then streams the file's bytes to this URI in pieces, so
 * an attachment never has to pass through the API function in one request —
 * which is what sidesteps the platform's ~6 MB function payload limit. The
 * session URI carries its own authorization, so it is safe to hand to the
 * proxy without also exposing the access token. Sessions expire after ~1 week
 * if unused.
 */
async function createResumableSession(
  accessToken: string,
  folderId: string,
  file: { name: string; mimeType: string; sizeBytes: number; description?: string }
): Promise<string> {
  const res = await fetch(DRIVE_UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": file.mimeType || "application/octet-stream",
      "X-Upload-Content-Length": String(file.sizeBytes),
    },
    body: JSON.stringify({ name: file.name, parents: [folderId], description: file.description }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Drive resumable init failed (${res.status}): ${detail}`);
  }
  const uploadUrl = res.headers.get("location");
  if (!uploadUrl) throw new Error("Drive resumable init returned no upload URL");
  return uploadUrl;
}

export interface ApplicationUploadTarget {
  /** Client-side field key ("resume" | "coverLetter") echoed back with the URL. */
  field: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ApplicationUploadSession {
  field: string;
  uploadUrl: string;
}

/**
 * Prepare a candidate's application in the role's Drive folder: write the small
 * application-details text file directly (no need to stream it), then open a
 * resumable upload session for each attachment and return their session URIs
 * for the client to stream into. Throws if Drive is unconfigured or the role
 * has no destination folder.
 */
export async function prepareApplicationUpload(params: {
  roleSlug: string;
  targets: ApplicationUploadTarget[];
  detailsFilename: string;
  detailsText: string;
  description?: string;
}): Promise<ApplicationUploadSession[]> {
  const drive = getDrive();
  const folderId = await resolveRoleFolderId(drive, params.roleSlug);

  await uploadOne(
    drive,
    folderId,
    {
      filename: params.detailsFilename,
      mimeType: "text/plain",
      buffer: Buffer.from(params.detailsText, "utf-8"),
    },
    params.description
  );

  const accessToken = await getDriveAccessToken();
  const sessions: ApplicationUploadSession[] = [];
  for (const target of params.targets) {
    const uploadUrl = await createResumableSession(accessToken, folderId, {
      name: target.name,
      mimeType: target.mimeType,
      sizeBytes: target.sizeBytes,
      description: params.description,
    });
    sessions.push({ field: target.field, uploadUrl });
  }
  return sessions;
}

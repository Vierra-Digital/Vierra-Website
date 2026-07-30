import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Thin proxy that streams one chunk of a career application file to its Google
 * Drive resumable-upload session (opened in apply.ts). The browser POSTs the
 * whole flow through here rather than talking to Google directly, so:
 *   - there is no cross-origin request from the browser to Google, and
 *   - no single request approaches the platform's ~6 MB function payload limit,
 *     since the client splits the file into sub-limit chunks.
 * The Drive session URI authorizes the write on its own, so no token is needed
 * (or exposed) here.
 */

export const config = {
  api: {
    // Raw binary body; we forward the bytes verbatim to Google.
    bodyParser: false,
  },
};

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * The upload URL is supplied by the (untrusted) client, so restrict it to the
 * exact Google Drive resumable-upload endpoint. This blocks the endpoint from
 * being abused as an open request proxy (SSRF) against arbitrary hosts.
 */
function isAllowedUploadUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      url.hostname === "www.googleapis.com" &&
      url.pathname === "/upload/drive/v3/files"
    );
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const uploadUrl = req.headers["x-upload-url"];
  const contentRange = req.headers["content-range"];
  const contentType = req.headers["x-file-content-type"];

  if (typeof uploadUrl !== "string" || !isAllowedUploadUrl(uploadUrl)) {
    return res.status(400).json({ message: "Invalid upload target." });
  }
  if (typeof contentRange !== "string" || !/^bytes \d+-\d+\/\d+$/.test(contentRange)) {
    return res.status(400).json({ message: "Invalid content range." });
  }

  try {
    const chunk = await readRawBody(req);

    const googleRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Range": contentRange,
        "Content-Type": typeof contentType === "string" && contentType
          ? contentType
          : "application/octet-stream",
      },
      body: new Uint8Array(chunk),
    });

    // 308 = "Resume Incomplete": chunk stored, more expected.
    if (googleRes.status === 308) {
      return res.status(200).json({ status: "incomplete" });
    }
    if (googleRes.status === 200 || googleRes.status === 201) {
      return res.status(200).json({ status: "complete" });
    }

    const detail = await googleRes.text().catch(() => "");
    console.error("careers/apply-chunk upload failed", googleRes.status, detail);
    return res.status(502).json({ message: "Upload failed. Please try again." });
  } catch (e) {
    console.error("careers/apply-chunk error", e);
    return res.status(500).json({ message: "Upload failed. Please try again." });
  }
}

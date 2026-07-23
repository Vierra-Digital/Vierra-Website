import type { NextApiRequest, NextApiResponse } from "next";
import { getJobRole } from "@/lib/careers";
import {
  isCareersDriveConfigured,
  prepareApplicationUpload,
  type ApplicationUploadTarget,
} from "@/lib/careersDrive";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Max submissions per IP per window — generous for a real applicant (who applies
// to a handful of roles at most) but blocks a script hammering the endpoint.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

// Sane abuse guard, not a practical ceiling — real resumes/cover letters are a
// few MB at most. Files are streamed to Drive in chunks (see apply-chunk.ts), so
// this no longer runs into the platform's ~6 MB function payload limit.
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_EXT = ["pdf", "doc", "docx"];

interface FileMeta {
  field: string;
  name: string;
  mimeType: string;
  size: number;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Strip characters Drive/OS dislike, collapse whitespace. */
function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  return ext || "pdf";
}

function readFileMeta(raw: unknown): FileMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const field = asString(r.field);
  const name = asString(r.name);
  const size = typeof r.size === "number" ? r.size : Number(r.size);
  if (!field || !name || !Number.isFinite(size)) return null;
  return { field, name, mimeType: asString(r.mimeType), size: Math.floor(size) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  if (!isCareersDriveConfigured()) {
    return res.status(503).json({
      message:
        "Applications aren't accepting uploads right now. Please email careers@vierradev.com.",
    });
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(`careers-apply:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return res.status(429).json({
      message: "Too many applications submitted from this connection. Please try again later.",
    });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  // Honeypot: a field named to look real ("website") that's hidden from sighted
  // users but visible to form-filling bots. Real applicants never fill it.
  // Respond as if it succeeded (don't tip off the bot) but open no upload and
  // touch no Drive folder — the client, seeing no sessions, uploads nothing.
  if (asString(body.website)) {
    return res.status(200).json({ ok: true });
  }

  const roleSlug = asString(body.roleSlug);
  const fullName = asString(body.fullName);
  const email = asString(body.email);
  const phoneNumber = asString(body.phoneNumber);
  const currentLocation = asString(body.currentLocation);
  const needRelocate = asString(body.needRelocate);
  const usCitizen = asString(body.usCitizen);
  const additionalNotes = asString(body.additionalNotes);

  const role = getJobRole(roleSlug);
  if (!role) {
    return res.status(400).json({ message: "Unknown role." });
  }
  if (!fullName || !email || !EMAIL_REGEX.test(email) || !phoneNumber || !currentLocation) {
    return res.status(400).json({ message: "Missing or invalid required fields." });
  }

  const rawFiles = Array.isArray(body.files) ? body.files : [];
  const files = rawFiles.map(readFileMeta).filter((f): f is FileMeta => f !== null);
  const resume = files.find((f) => f.field === "resume");
  const coverLetter = files.find((f) => f.field === "coverLetter");

  if (!resume || !coverLetter) {
    return res.status(400).json({ message: "Resume and cover letter are both required." });
  }
  for (const file of [resume, coverLetter]) {
    if (!ALLOWED_EXT.includes(extOf(file.name))) {
      return res.status(400).json({ message: "Files must be PDF, DOC, or DOCX." });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: "Each file must be under 25 MB." });
    }
  }

  const applicant = safeName(fullName) || "Applicant";
  const description = [
    `Role: ${role.title}`,
    `Name: ${fullName}`,
    `Email: ${email}`,
    `Phone: ${phoneNumber}`,
    `Location: ${currentLocation}`,
    `Needs relocation: ${needRelocate || "—"}`,
    `US citizen: ${usCitizen || "—"}`,
  ].join(" | ");

  const detailsText =
    `Vierra Application — ${role.title}\n\n` +
    `Name: ${fullName}\n` +
    `Email: ${email}\n` +
    `Phone: ${phoneNumber}\n` +
    `Current location: ${currentLocation}\n` +
    `Needs to relocate: ${needRelocate || "—"}\n` +
    `US citizen: ${usCitizen || "—"}\n\n` +
    `Additional notes:\n${additionalNotes || "(none)"}\n`;

  const targets: ApplicationUploadTarget[] = [
    {
      field: "resume",
      name: `${applicant} - Resume.${extOf(resume.name)}`,
      mimeType: resume.mimeType || "application/pdf",
      sizeBytes: resume.size,
    },
    {
      field: "coverLetter",
      name: `${applicant} - Cover Letter.${extOf(coverLetter.name)}`,
      mimeType: coverLetter.mimeType || "application/pdf",
      sizeBytes: coverLetter.size,
    },
  ];

  try {
    const sessions = await prepareApplicationUpload({
      roleSlug,
      targets,
      detailsFilename: `${applicant} - Application Details.txt`,
      detailsText,
      description,
    });
    return res.status(200).json({ sessions });
  } catch (e) {
    console.error("careers/apply error", e);
    return res.status(500).json({ message: "Failed to submit application. Please try again." });
  }
}

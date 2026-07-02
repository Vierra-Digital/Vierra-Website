import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { type File as FormidableFile } from "formidable";
import fs from "fs";
import { getJobRole } from "@/lib/careers";
import {
  isCareersDriveConfigured,
  uploadApplicationToDrive,
  type UploadFileInput,
} from "@/lib/careersDrive";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Max submissions per IP per window — generous for a real applicant (who applies
// to a handful of roles at most) but blocks a script hammering the endpoint.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_EXT = ["pdf", "doc", "docx"];

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return (value ?? "").trim();
}

/** Strip characters Drive/OS dislike, collapse whitespace. */
function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

function extOf(file: FormidableFile): string {
  const name = file.originalFilename || "";
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  return ext || "pdf";
}

function readBuffer(file: FormidableFile): Buffer {
  return fs.readFileSync(file.filepath);
}

function cleanup(...files: (FormidableFile | undefined)[]) {
  for (const f of files) {
    if (f?.filepath) {
      try {
        fs.unlinkSync(f.filepath);
      } catch {
        // best-effort temp cleanup
      }
    }
  }
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

  const form = formidable({ maxFiles: 2, maxFileSize: MAX_FILE_SIZE, keepExtensions: true });

  let resume: FormidableFile | undefined;
  let coverLetter: FormidableFile | undefined;

  try {
    const [fields, files] = await form.parse(req);

    // Honeypot: a field named to look real ("website") that's hidden from sighted
    // users via CSS but visible to form-filling bots. Real applicants never fill
    // it. Respond as if the submission succeeded (don't tip off the bot) but
    // never touch Drive.
    if (firstValue(fields.website)) {
      cleanup(files.resume?.[0], files.coverLetter?.[0]);
      return res.status(201).json({ success: true });
    }

    const roleSlug = firstValue(fields.roleSlug);
    const fullName = firstValue(fields.fullName);
    const email = firstValue(fields.email);
    const phoneNumber = firstValue(fields.phoneNumber);
    const currentLocation = firstValue(fields.currentLocation);
    const needRelocate = firstValue(fields.needRelocate);
    const usCitizen = firstValue(fields.usCitizen);
    const additionalNotes = firstValue(fields.additionalNotes);

    resume = files.resume?.[0];
    coverLetter = files.coverLetter?.[0];

    const role = getJobRole(roleSlug);
    if (!role) {
      cleanup(resume, coverLetter);
      return res.status(400).json({ message: "Unknown role." });
    }
    if (!fullName || !email || !EMAIL_REGEX.test(email) || !phoneNumber || !currentLocation) {
      cleanup(resume, coverLetter);
      return res.status(400).json({ message: "Missing or invalid required fields." });
    }
    if (!resume || !coverLetter) {
      cleanup(resume, coverLetter);
      return res.status(400).json({ message: "Resume and cover letter are both required." });
    }
    if (!ALLOWED_EXT.includes(extOf(resume)) || !ALLOWED_EXT.includes(extOf(coverLetter))) {
      cleanup(resume, coverLetter);
      return res.status(400).json({ message: "Files must be PDF, DOC, or DOCX." });
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

    const uploads: UploadFileInput[] = [
      {
        filename: `${applicant} - Resume.${extOf(resume)}`,
        mimeType: resume.mimetype || "application/pdf",
        buffer: readBuffer(resume),
      },
      {
        filename: `${applicant} - Cover Letter.${extOf(coverLetter)}`,
        mimeType: coverLetter.mimetype || "application/pdf",
        buffer: readBuffer(coverLetter),
      },
      {
        filename: `${applicant} - Application Details.txt`,
        mimeType: "text/plain",
        buffer: Buffer.from(detailsText, "utf-8"),
      },
    ];

    await uploadApplicationToDrive({ roleSlug, files: uploads, description });

    cleanup(resume, coverLetter);
    return res.status(201).json({ success: true });
  } catch (e) {
    cleanup(resume, coverLetter);
    console.error("careers/apply error", e);
    return res.status(500).json({ message: "Failed to submit application. Please try again." });
  }
}

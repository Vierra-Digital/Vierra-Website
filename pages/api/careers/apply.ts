import type { NextApiRequest, NextApiResponse } from "next";
import { getJobRole } from "@/lib/careers";
import {
  isCareersDriveConfigured,
  prepareApplicationUpload,
  type ApplicationUploadTarget,
} from "@/lib/careersDrive";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { asStr as asString } from "@/lib/api/parsing";
import {
  normalizeCareerApplication,
  validateCareerFileMetadata,
} from "@/lib/careerApplicationValidation";

// Max submissions per IP per window — generous for a real applicant (who applies
// to a handful of roles at most) but blocks a script hammering the endpoint.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

/** Strip characters Drive/OS dislike, collapse whitespace. */
function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  return ext || "pdf";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
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

  const application = normalizeCareerApplication(body);
  if (!application) {
    return res.status(400).json({ message: "Missing or invalid required fields." });
  }

  const role = getJobRole(application.roleSlug);
  if (!role) {
    return res.status(400).json({ message: "Unknown role." });
  }

  if (!isCareersDriveConfigured()) {
    return res.status(503).json({
      message:
        "Applications aren't accepting uploads right now. Please email careers@vierradev.com.",
    });
  }

  const rawFiles = Array.isArray(body.files) ? body.files : [];
  const checkedFiles = rawFiles.map(validateCareerFileMetadata).filter(({ field }) => field === "resume" || field === "coverLetter");
  if (checkedFiles.some(({ issue }) => issue === "unsupported-type")) {
    return res.status(400).json({ message: "Files must be PDF, DOC, or DOCX." });
  }
  if (checkedFiles.some(({ issue }) => issue === "size")) {
    return res.status(400).json({ message: "Each file must be under 25 MB." });
  }
  const files = checkedFiles.map(({ metadata }) => metadata).filter((f) => f !== null);
  const resume = files.find((f) => f.field === "resume");
  const coverLetter = files.find((f) => f.field === "coverLetter");

  if (!resume || !coverLetter) {
    return res.status(400).json({ message: "Resume and cover letter are both required." });
  }
  const applicant = safeName(application.fullName) || "Applicant";
  const description = [
    `Role: ${role.title}`,
    `Name: ${application.fullName}`,
    `Email: ${application.email}`,
    `Phone: ${application.phoneNumber}`,
    `Location: ${application.currentLocation}`,
    `Needs relocation: ${application.needRelocate}`,
    `US citizen: ${application.usCitizen}`,
  ].join(" | ");

  const detailsText =
    `Vierra Application — ${role.title}\n\n` +
    `Name: ${application.fullName}\n` +
    `Email: ${application.email}\n` +
    `Phone: ${application.phoneNumber}\n` +
    `Current location: ${application.currentLocation}\n` +
    `Needs to relocate: ${application.needRelocate}\n` +
    `US citizen: ${application.usCitizen}\n\n` +
    `Additional notes:\n${application.additionalNotes || "(none)"}\n`;

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
      roleSlug: application.roleSlug,
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

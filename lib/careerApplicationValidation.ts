import { asStr } from "@/lib/api/parsing";
import { EMAIL_REGEX } from "@/lib/utils";

export const CAREER_FORM_LIMITS = {
  fullName: 100,
  email: 254,
  phoneNumber: 32,
  currentLocation: 200,
  additionalNotes: 2000,
  roleSlug: 100,
  fileName: 255,
} as const;

const CAREER_APPLICATION_FIELDS = ["resume", "coverLetter"] as const;
const CAREER_FILE_EXTENSIONS = ["pdf", "doc", "docx"] as const;
const CAREER_ENUM_VALUES = ["Yes", "No"] as const;
const MAX_CAREER_FILE_SIZE = 25 * 1024 * 1024;
const ROLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHONE_CHARACTERS = /^[\d\s().+\-]+$/;

export type CareerYesNo = (typeof CAREER_ENUM_VALUES)[number];

export interface CareerApplicationFields {
  roleSlug: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  currentLocation: string;
  needRelocate: CareerYesNo;
  usCitizen: CareerYesNo;
  additionalNotes: string;
}

export interface CareerFileMetadata {
  field: (typeof CAREER_APPLICATION_FIELDS)[number];
  name: string;
  mimeType: string;
  size: number;
}

export type CareerFileMetadataIssue = "invalid" | "unsupported-type" | "size";

export interface CareerFileMetadataValidation {
  field: string;
  metadata: CareerFileMetadata | null;
  issue: CareerFileMetadataIssue | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSingleLine(value: unknown, maxLength: number): string | null {
  const text = asStr(value).replace(/\s+/g, " ");
  if (!text || text.length > maxLength) return null;
  return text;
}

function normalizeOptionalNotes(value: unknown): string | null {
  const text = asStr(value);
  return text.length <= CAREER_FORM_LIMITS.additionalNotes ? text : null;
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const normalized = asStr(value);
  return allowed.includes(normalized as T) ? (normalized as T) : null;
}

/** Trim and lowercase an email address, enforcing a practical RFC-sized limit. */
export function normalizeEmailAddress(value: unknown): string | null {
  const email = asStr(value).toLowerCase();
  if (!email || email.length > CAREER_FORM_LIMITS.email || !EMAIL_REGEX.test(email)) return null;
  return email;
}

/** Format a ten-digit US phone number while accepting common punctuation. */
export function normalizePhoneNumber(value: unknown): string | null {
  const phone = asStr(value);
  if (!phone || phone.length > CAREER_FORM_LIMITS.phoneNumber || !PHONE_CHARACTERS.test(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Normalize a career role slug without accepting path or query syntax. */
export function normalizeRoleSlug(value: unknown): string | null {
  const slug = asStr(value).toLowerCase();
  if (!slug || slug.length > CAREER_FORM_LIMITS.roleSlug || !ROLE_SLUG_PATTERN.test(slug)) return null;
  return slug;
}

/** Normalize and validate the non-file portion of a career application. */
export function normalizeCareerApplication(value: unknown): CareerApplicationFields | null {
  if (!isRecord(value)) return null;

  const roleSlug = normalizeRoleSlug(value.roleSlug);
  const fullName = normalizeSingleLine(value.fullName, CAREER_FORM_LIMITS.fullName);
  const email = normalizeEmailAddress(value.email);
  const phoneNumber = normalizePhoneNumber(value.phoneNumber);
  const currentLocation = normalizeSingleLine(value.currentLocation, CAREER_FORM_LIMITS.currentLocation);
  const needRelocate = normalizeEnum(value.needRelocate, CAREER_ENUM_VALUES);
  const usCitizen = normalizeEnum(value.usCitizen, CAREER_ENUM_VALUES);
  const additionalNotes = normalizeOptionalNotes(value.additionalNotes);

  if (!roleSlug || !fullName || !email || !phoneNumber || !currentLocation || !needRelocate || !usCitizen || additionalNotes === null) {
    return null;
  }

  return { roleSlug, fullName, email, phoneNumber, currentLocation, needRelocate, usCitizen, additionalNotes };
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Validate the small JSON file descriptors used to open Drive upload sessions. */
export function validateCareerFileMetadata(value: unknown): CareerFileMetadataValidation {
  if (!isRecord(value)) return { field: "", metadata: null, issue: "invalid" };

  const field = asStr(value.field);
  const name = asStr(value.name);
  const mimeType = asStr(value.mimeType);
  const sizeValue = typeof value.size === "number" ? value.size : Number(value.size);
  const size = Math.floor(sizeValue);

  if (!field || !CAREER_APPLICATION_FIELDS.includes(field as (typeof CAREER_APPLICATION_FIELDS)[number]) || !name || name.length > CAREER_FORM_LIMITS.fileName || !Number.isFinite(sizeValue)) {
    return { field, metadata: null, issue: "invalid" };
  }
  if (!(CAREER_FILE_EXTENSIONS as readonly string[]).includes(fileExtension(name))) {
    return { field, metadata: null, issue: "unsupported-type" };
  }
  if (size <= 0 || size > MAX_CAREER_FILE_SIZE) {
    return { field, metadata: null, issue: "size" };
  }

  return {
    field,
    metadata: { field: field as (typeof CAREER_APPLICATION_FIELDS)[number], name, mimeType, size },
    issue: null,
  };
}

export function normalizeCareerFileMetadata(value: unknown): CareerFileMetadata | null {
  return validateCareerFileMetadata(value).metadata;
}

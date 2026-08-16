import { describe, expect, it } from "vitest";
import {
  normalizeCareerApplication,
  normalizeCareerFileMetadata,
} from "@/lib/careerApplicationValidation";

const validCareerApplication = {
  roleSlug: "software-engineer-intern",
  fullName: "  Jane Doe  ",
  email: " JANE@Example.COM ",
  phoneNumber: "555.123.4567",
  currentLocation: "  Boston, MA  ",
  needRelocate: "Yes",
  usCitizen: "No",
  additionalNotes: "  I enjoy building reliable software.\n  ",
};

describe("career application normalization", () => {
  it("normalizes a complete career application with the UI's enum values", () => {
    expect(normalizeCareerApplication(validCareerApplication)).toEqual({
      roleSlug: "software-engineer-intern",
      fullName: "Jane Doe",
      email: "jane@example.com",
      phoneNumber: "(555) 123-4567",
      currentLocation: "Boston, MA",
      needRelocate: "Yes",
      usCitizen: "No",
      additionalNotes: "I enjoy building reliable software.",
    });
  });

  it("requires career fields and restricts relocation and citizenship enums", () => {
    expect(normalizeCareerApplication({ ...validCareerApplication, currentLocation: "" })).toBeNull();
    expect(normalizeCareerApplication({ ...validCareerApplication, needRelocate: "Maybe" })).toBeNull();
    expect(normalizeCareerApplication({ ...validCareerApplication, usCitizen: "sometimes" })).toBeNull();
    expect(normalizeCareerApplication({ ...validCareerApplication, email: "bad" })).toBeNull();
    expect(normalizeCareerApplication({ ...validCareerApplication, phoneNumber: "1234" })).toBeNull();
  });

  it("rejects malformed role slugs and oversized career text", () => {
    expect(normalizeCareerApplication({ ...validCareerApplication, roleSlug: "Software Engineer" })).toBeNull();
    expect(normalizeCareerApplication({ ...validCareerApplication, fullName: "x".repeat(101) })).toBeNull();
    expect(normalizeCareerApplication({ ...validCareerApplication, currentLocation: "x".repeat(201) })).toBeNull();
    expect(normalizeCareerApplication({ ...validCareerApplication, additionalNotes: "x".repeat(2001) })).toBeNull();
  });
});

describe("career application file metadata", () => {
  it("accepts supported non-empty resume metadata", () => {
    expect(
      normalizeCareerFileMetadata({
        field: "resume",
        name: "resume.pdf",
        mimeType: "application/pdf",
        size: 1024,
      })
    ).toEqual({
      field: "resume",
      name: "resume.pdf",
      mimeType: "application/pdf",
      size: 1024,
    });
  });

  it("rejects unsupported, empty, oversized, and malformed metadata", () => {
    expect(normalizeCareerFileMetadata({ field: "resume", name: "resume.exe", size: 1024 })).toBeNull();
    expect(normalizeCareerFileMetadata({ field: "resume", name: "resume.pdf", size: 0 })).toBeNull();
    expect(normalizeCareerFileMetadata({ field: "resume", name: "resume.pdf", size: 25 * 1024 * 1024 + 1 })).toBeNull();
    expect(normalizeCareerFileMetadata({ field: "other", name: "resume.pdf", size: 1024 })).toBeNull();
    expect(normalizeCareerFileMetadata({ field: "resume", name: "resume.pdf", size: "not-a-number" })).toBeNull();
  });
});

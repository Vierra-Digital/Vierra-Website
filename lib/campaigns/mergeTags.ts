type MergeTagContact = {
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_business: string | null;
  contact_email: string;
};

/** Substitutes {{firstName}}, {{lastName}}, {{company}}, {{email}} in a template string. */
export function renderMergeTags(template: string, contact: MergeTagContact): string {
  return template
    .replace(/\{\{\s*firstName\s*\}\}/gi, contact.contact_first_name || "")
    .replace(/\{\{\s*lastName\s*\}\}/gi, contact.contact_last_name || "")
    .replace(/\{\{\s*company\s*\}\}/gi, contact.contact_business || "")
    .replace(/\{\{\s*email\s*\}\}/gi, contact.contact_email);
}

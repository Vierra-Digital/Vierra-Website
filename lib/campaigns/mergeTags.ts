import { renderTemplate } from "@/lib/email/templateRender";

type MergeTagContact = {
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_business: string | null;
  contact_email: string;
};

/**
 * Renders a campaign template for a contact: {{firstName}}, {{lastName}}, {{company}},
 * {{email}}, {{fullName}} (with optional fallbacks like {{firstName|there}}) plus spintax
 * {a|b|c}. Spintax is seeded by the contact's email so each recipient's variant is stable.
 */
export function renderMergeTags(template: string, contact: MergeTagContact): string {
  const fullName = [contact.contact_first_name, contact.contact_last_name].filter(Boolean).join(" ");
  return renderTemplate(
    template,
    {
      firstName: contact.contact_first_name,
      lastName: contact.contact_last_name,
      company: contact.contact_business,
      email: contact.contact_email,
      fullName,
    },
    contact.contact_email
  );
}

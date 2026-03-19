export type ContextCategoryId = "business" | "audience" | "operations";

export type ContextFieldType = "text" | "textarea";

export type ContextFieldDefinition = {
  key: string;
  label: string;
  category: ContextCategoryId;
  type: ContextFieldType;
  rows?: number;
};

export const CONTEXT_CATEGORY_LABELS: Record<ContextCategoryId, string> = {
  business: "Business Profile",
  audience: "Audience & Growth",
  operations: "Operations",
};

export const CONTEXT_FIELDS: ContextFieldDefinition[] = [
  {
    key: "website",
    label: "What's your company website or main online presence?",
    category: "business",
    type: "text",
  },
  {
    key: "brandTone",
    label: "Do you have a preferred brand tone/voice (professional, playful, luxury, etc)?",
    category: "business",
    type: "text",
  },
  {
    key: "productService",
    label: "Briefly describe your product or service in one sentence.",
    category: "business",
    type: "textarea",
    rows: 3,
  },
  {
    key: "valueProposition",
    label: "What's your main value proposition or unique selling point (why customers choose you)?",
    category: "business",
    type: "textarea",
    rows: 3,
  },
  {
    key: "targetAudience",
    label: "Who is your target audience (age, location, interests, demographics)?",
    category: "audience",
    type: "textarea",
    rows: 4,
  },
  {
    key: "socialMediaGoals",
    label: "What's your primary desire for social media growth (leads, awareness, event signups, etc)?",
    category: "audience",
    type: "textarea",
    rows: 4,
  },
  {
    key: "leadGeneration",
    label: "Describe your current lead generation funnel and primary offer.",
    category: "audience",
    type: "textarea",
    rows: 4,
  },
  {
    key: "avoidMentions",
    label: "Is there anything we should avoid mentioning (competitors, sensitive terms, compliance restrictions)?",
    category: "operations",
    type: "textarea",
    rows: 3,
  },
  {
    key: "additionalInfo",
    label: "Do you have anything else to add about your company, clients, needs, or questions?",
    category: "operations",
    type: "textarea",
    rows: 4,
  },
];

export const CONTEXT_FIELD_KEYS = new Set(CONTEXT_FIELDS.map((field) => field.key));


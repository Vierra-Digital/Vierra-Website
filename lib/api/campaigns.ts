export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed", "cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const LEAD_STATUSES = [
  "no_response",
  "reply",
  "follow_up",
  "positive_response",
  "not_interested",
  "remove_contact",
  "bad_timing",
  "meeting_booked",
  "positive_response_closed",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const QUEUE_STATUSES = ["queued", "sending", "sent", "failed", "skipped", "completed"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

type CampaignRow = {
  id: string;
  company_id: string;
  account_id: string;
  created_by: string | null;
  name: string;
  status: string;
  audience_filter: unknown;
  audience_synced_at: Date | null;
  send_delay_seconds: number;
  send_jitter_seconds: number;
  daily_send_limit: number;
  enroll_on_signal?: boolean;
  scheduled_start_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  paused_at: Date | null;
  created_at: Date;
  updated_at: Date;
  email_provider_accounts?: { account_email: string } | null;
  _count?: { campaign_contacts?: number; campaign_steps?: number };
};

/** Shapes a Campaign row (snake_case Prisma fields) back to the frontend's camelCase contract. */
export function serializeCampaign(row: CampaignRow) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    accountId: row.account_id,
    accountEmail: row.email_provider_accounts?.account_email ?? null,
    createdBy: row.created_by,
    audienceFilter: row.audience_filter,
    audienceSyncedAt: row.audience_synced_at,
    sendDelaySeconds: row.send_delay_seconds,
    sendJitterSeconds: row.send_jitter_seconds,
    dailySendLimit: row.daily_send_limit,
    enrollOnSignal: row.enroll_on_signal ?? false,
    scheduledStartAt: row.scheduled_start_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    pausedAt: row.paused_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stepCount: row._count?.campaign_steps ?? undefined,
    contactCount: row._count?.campaign_contacts ?? undefined,
  };
}

type CampaignStepRow = {
  id: string;
  campaign_id: string;
  step_order: number;
  name: string | null;
  template_id: string | null;
  subject_override: string | null;
  body_html_override: string | null;
  body_text_override: string | null;
  delay_days: number;
  created_at: Date;
  updated_at: Date;
};

export function serializeCampaignStep(row: CampaignStepRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    stepOrder: row.step_order,
    name: row.name,
    templateId: row.template_id,
    subjectOverride: row.subject_override,
    bodyHtmlOverride: row.body_html_override,
    bodyTextOverride: row.body_text_override,
    delayDays: row.delay_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type CampaignContactRow = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  contact_email: string;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_business: string | null;
  assigned_to: string | null;
  current_step_id: string | null;
  lead_status: string;
  queue_status: string;
  skip_reason: string | null;
  enrolled_at: Date;
  next_send_at: Date | null;
  last_sent_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export function serializeCampaignContact(row: CampaignContactRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    contactId: row.contact_id,
    contactEmail: row.contact_email,
    contactFirstName: row.contact_first_name,
    contactLastName: row.contact_last_name,
    contactBusiness: row.contact_business,
    assignedTo: row.assigned_to,
    currentStepId: row.current_step_id,
    leadStatus: row.lead_status,
    queueStatus: row.queue_status,
    skipReason: row.skip_reason,
    enrolledAt: row.enrolled_at,
    nextSendAt: row.next_send_at,
    lastSentAt: row.last_sent_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type LeadStatusEventRow = {
  id: string;
  campaign_contact_id: string;
  from_status: string | null;
  to_status: string;
  changed_by_user_id: string | null;
  changed_by_rule: string | null;
  note: string | null;
  created_at: Date;
  users?: { name: string | null; email: string } | null;
};

export function serializeLeadStatusEvent(row: LeadStatusEventRow) {
  return {
    id: row.id,
    campaignContactId: row.campaign_contact_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedByUserId: row.changed_by_user_id,
    changedByUserName: row.users?.name ?? row.users?.email ?? null,
    changedByRule: row.changed_by_rule,
    note: row.note,
    createdAt: row.created_at,
  };
}

/** Statuses where the send-queue tick keeps auto-advancing the sequence. Anything else halts it. */
export const ACTIVE_SEND_LEAD_STATUS: LeadStatus = "no_response";

/** RemoveContact categorization pushes the contact's email onto the account owner's DNC list. */
export const REMOVE_CONTACT_STATUS: LeadStatus = "remove_contact";

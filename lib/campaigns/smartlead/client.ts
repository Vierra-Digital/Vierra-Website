/**
 * Smartlead API client — see .claude/schema_v2_campaigns_smartlead_integration.md.
 *
 * CONFIDENCE LEVELS (do not treat this file as verified against Smartlead's real API reference —
 * it was written from public blog/help-center content during design, not a fetched primary API
 * doc or sandbox account; the design doc's §11 open decisions still need a vendor call):
 *   - createCampaign / addLeadsToCampaign: base URL, auth style (api_key query param), and the
 *     leads endpoint shape have at least one concrete documented example behind them.
 *   - setCampaignSequence / updateCampaignStatus / attachEmailAccount: UNVERIFIED GUESSES —
 *     no direct evidence was found for these paths/payloads. Treat every field name and endpoint
 *     path below as a hypothesis to confirm against Smartlead's actual API reference before this
 *     is ever called against a live account.
 *
 * Env: SMARTLEAD_API_KEY (required), SMARTLEAD_BASE_URL (optional override, default below).
 */

const BASE_URL = (process.env.SMARTLEAD_BASE_URL || "https://server.smartlead.ai/api/v1").replace(/\/$/, "");
const API_KEY = process.env.SMARTLEAD_API_KEY || "";

export function smartleadConfigured(): boolean {
  return Boolean(API_KEY);
}

export type SmartleadResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function smartleadRequest<T>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown }
): Promise<SmartleadResult<T>> {
  if (!smartleadConfigured()) {
    return { ok: false, status: 0, message: "Smartlead isn't configured (SMARTLEAD_API_KEY missing)." };
  }
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${sep}api_key=${encodeURIComponent(API_KEY)}`;
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: { "Content-Type": "application/json" },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = await res.json().catch(() => ({}) as unknown);
    if (!res.ok) {
      const message =
        (data as { message?: string; error?: string })?.message ||
        (data as { message?: string; error?: string })?.error ||
        `Smartlead request failed (${res.status})`;
      return { ok: false, status: res.status, message };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : "Smartlead request error." };
  }
}

/**
 * UNVERIFIED — translates this app's {{firstName}}/{{lastName}}/{{company}}/{{email}}/{{fullName}}
 * merge-tag syntax (lib/campaigns/mergeTags.ts) into whatever Smartlead's own sequence templates
 * expect. Assumes Smartlead also uses {{tag}} interpolation keyed to the lead custom-field names
 * sent in SmartleadLead (first_name/last_name/company_name) — this mapping is a guess, not
 * confirmed against their template syntax. Spintax ({a|b|c}) in the source template is passed
 * through unchanged; confirm Smartlead supports the same spintax syntax before relying on it.
 */
export function translateMergeTagsForSmartlead(template: string): string {
  return template
    .replace(/\{\{\s*firstName\s*\}\}/g, "{{first_name}}")
    .replace(/\{\{\s*lastName\s*\}\}/g, "{{last_name}}")
    .replace(/\{\{\s*company\s*\}\}/g, "{{company_name}}")
    .replace(/\{\{\s*email\s*\}\}/g, "{{email}}")
    .replace(/\{\{\s*fullName\s*\}\}/g, "{{first_name}} {{last_name}}");
}

export type SmartleadSequenceStep = {
  seq_number: number;
  subject: string;
  email_body: string;
  /** Days after the previous step (or enrollment, for step 1) — mirrors CampaignStep.delay_days. */
  wait_days: number;
};

/** POST /campaigns — documented example: create-campaign endpoint exists; exact response shape unconfirmed. */
export async function createCampaign(name: string): Promise<SmartleadResult<{ id: string | number }>> {
  return smartleadRequest("/campaigns", { method: "POST", body: { name } });
}

/**
 * UNVERIFIED — no direct documentation found for a sequence-setting endpoint's exact path or
 * payload shape. This mirrors the general "campaigns/{id}/sequences"-style REST pattern used
 * elsewhere in their API, but must be confirmed before use.
 */
export async function setCampaignSequence(
  smartleadCampaignId: string,
  steps: SmartleadSequenceStep[]
): Promise<SmartleadResult<unknown>> {
  return smartleadRequest(`/campaigns/${encodeURIComponent(smartleadCampaignId)}/sequences`, {
    method: "POST",
    body: { sequences: steps },
  });
}

/**
 * UNVERIFIED — attaching a connected mailbox to a campaign. Depends entirely on the still-open
 * §9 question (API-driven vs. Smartlead-dashboard-only mailbox connection) — this call may not
 * be the right mechanism at all. Confirm on a vendor call before relying on this.
 */
export async function attachEmailAccount(
  smartleadCampaignId: string,
  smartleadEmailAccountId: string
): Promise<SmartleadResult<unknown>> {
  return smartleadRequest(`/campaigns/${encodeURIComponent(smartleadCampaignId)}/email-accounts`, {
    method: "POST",
    body: { email_account_ids: [smartleadEmailAccountId] },
  });
}

export type SmartleadLead = {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  custom_fields?: Record<string, string>;
};

export type SmartleadLeadsPushResult = {
  ok: boolean; // false if any batch failed — data still holds whatever earlier batches pushed
  data: { upload_count: number; leads: Array<{ id: string | number; email: string }> };
  message?: string; // set when ok is false
};

/**
 * POST /campaigns/{id}/leads — documented: up to 400 leads/request via a lead_list array.
 * Always returns whatever batches succeeded, even when a later batch fails — a caller that
 * discarded partial results on failure would risk re-pushing (and likely duplicating) leads that
 * already landed in Smartlead on the next retry.
 */
export async function addLeadsToCampaign(
  smartleadCampaignId: string,
  leads: SmartleadLead[]
): Promise<SmartleadLeadsPushResult> {
  const BATCH_SIZE = 400;
  const batches: SmartleadLead[][] = [];
  for (let i = 0; i < leads.length; i += BATCH_SIZE) batches.push(leads.slice(i, i + BATCH_SIZE));

  const merged: SmartleadLeadsPushResult["data"] = { upload_count: 0, leads: [] };
  for (const batch of batches) {
    const result = await smartleadRequest<{ upload_count?: number; leads?: Array<{ id: string | number; email: string }> }>(
      `/campaigns/${encodeURIComponent(smartleadCampaignId)}/leads`,
      { method: "POST", body: { lead_list: batch } }
    );
    if (!result.ok) {
      return { ok: false, data: merged, message: result.message };
    }
    merged.upload_count += result.data.upload_count ?? 0;
    merged.leads.push(...(result.data.leads ?? []));
  }
  return { ok: true, data: merged };
}

/**
 * UNVERIFIED — pausing/cancelling the mirrored campaign when the local Campaign.status
 * transitions. No direct documentation found for this endpoint's path or accepted status values.
 */
export async function updateCampaignStatus(
  smartleadCampaignId: string,
  status: "PAUSED" | "STOPPED"
): Promise<SmartleadResult<unknown>> {
  return smartleadRequest(`/campaigns/${encodeURIComponent(smartleadCampaignId)}/status`, {
    method: "POST",
    body: { status },
  });
}

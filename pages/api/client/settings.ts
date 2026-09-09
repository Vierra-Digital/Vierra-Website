import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

/** Only these four columns may be written, and only with a value of the right shape. */
const THEMES = new Set(["light", "dark", "auto"]);
const LANGUAGES = new Set(["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko"]);

type SettingsPatch = {
  language?: string;
  theme?: string;
  two_factor_enabled?: boolean;
  email_notifications?: boolean;
};

/**
 * Build the update from the body, rejecting anything that is not one of the four settings with a
 * value we recognise. An allowlist rather than a spread: the body reaches Prisma, and a caller
 * that could name any column could rewrite a client's email or company.
 */
function readPatch(body: unknown): { ok: true; data: SettingsPatch } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "A settings object is required." };
  const input = body as Record<string, unknown>;
  const data: SettingsPatch = {};

  if ("language" in input) {
    if (typeof input.language !== "string" || !LANGUAGES.has(input.language)) {
      return { ok: false, message: "Unsupported language." };
    }
    data.language = input.language;
  }
  if ("theme" in input) {
    if (typeof input.theme !== "string" || !THEMES.has(input.theme)) {
      return { ok: false, message: "Unsupported theme." };
    }
    data.theme = input.theme;
  }
  for (const [key, column] of [
    ["twoFactorEnabled", "two_factor_enabled"],
    ["emailNotifications", "email_notifications"],
  ] as const) {
    if (key in input) {
      if (typeof input[key] !== "boolean") return { ok: false, message: `${key} must be true or false.` };
      data[column] = input[key] as boolean;
    }
  }

  if (Object.keys(data).length === 0) return { ok: false, message: "No recognised settings to change." };
  return { ok: true, data };
}

/**
 * A client's own account settings, as stored on their `clients` row.
 *
 * These four columns — language, theme, two_factor_enabled, email_notifications — have existed on
 * the model since it was written but nothing read or wrote them, so the Security and Preferences
 * cards had no source for a client and were hidden outright on the staff-facing view of their
 * settings. A staff member opening a client's Settings therefore saw a Profile card and nothing
 * else, which reads as a broken page rather than a deliberate one.
 *
 * GET reads them; PUT changes them. A Vierra staff member may change a client's settings from the
 * client view, which is what that view is for. Identity is still off limits from there — a client's
 * name, picture and password are theirs, and nothing here touches them.
 *
 * Scoping is the standard client-route pair — a representative always reads their own row, a
 * Vierra staff member names the client company they are looking at.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await requireSession(req, res);
  if (!session) return;
  if (session.kind === "unaffiliated") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const companyId =
    session.kind === "client" ? session.companyId : resolveTargetCompanyId(session, req);
  if (!companyId) return res.status(400).json({ message: "companyId is required" });

  if (req.method === "PUT") {
    const patch = readPatch(req.body);
    if (!patch.ok) return res.status(400).json({ message: patch.message });

    try {
      // Scoped the same way the read is: a representative can only ever change their own row.
      const target =
        session.kind === "client"
          ? await prisma.client.findFirst({ where: { id: session.clientId }, select: { id: true } })
          : await prisma.client.findFirst({ where: { company_id: companyId }, select: { id: true } });
      if (!target) return res.status(404).json({ message: "No client for that company." });

      const updated = await prisma.client.update({
        where: { id: target.id },
        data: { ...patch.data, updated_at: new Date() },
        select: {
          language: true,
          theme: true,
          two_factor_enabled: true,
          email_notifications: true,
        },
      });
      return res.status(200).json({
        emailNotifications: updated.email_notifications,
        twoFactorEnabled: updated.two_factor_enabled,
        theme: updated.theme,
        language: updated.language,
      });
    } catch (e) {
      console.error("client/settings PUT", e);
      return res.status(500).json({ message: "Could not save settings." });
    }
  }

  try {
    const select = {
      user_id: true,
      language: true,
      theme: true,
      two_factor_enabled: true,
      email_notifications: true,
    } as const;

    const client =
      session.kind === "client"
        ? await prisma.client.findFirst({ where: { id: session.clientId }, select })
        : await prisma.client.findFirst({ where: { company_id: companyId }, select });

    if (!client) return res.status(404).json({ message: "No client for that company." });

    /**
     * What this client has connected.
     *
     * Two different scopes, deliberately, because the data is stored under two different owners:
     *
     *   - platform_tokens is per USER, so these are the grants the client made themselves. A
     *     Google account here is one OAuth grant covering both Gmail and Calendar — the calendar
     *     routes read the very same `gmail:` token (see /api/google-calendar/calendars), so
     *     "connected Google account" and "connected calendar" are the same fact, not two.
     *   - email_provider_accounts is per COMPANY: the mailboxes attached to their workspace,
     *     which may have been connected by a staff member rather than by the client.
     *
     * Deliberately NOT reported: a calendar count from the `gcalvis:` rows. Those are visibility
     * preferences written only when someone toggles one, so their absence means "never chose",
     * not "no calendars" — counting them would state something untrue.
     *
     * No token is refreshed here. This is a page a staff member reads; refreshing another
     * person's Google token as a side effect of looking at their settings would be wrong.
     */
    const [tokens, mailboxes] = await Promise.all([
      client.user_id
        ? prisma.platformToken.findMany({
            where: { user_id: client.user_id },
            select: { platform: true, refresh_token: true, expires_at: true, meta: true },
            orderBy: { created_at: "desc" },
          })
        : Promise.resolve([]),
      prisma.emailProviderAccount.findMany({
        where: { company_id: companyId },
        select: { account_email: true, provider_label: true },
        orderBy: { account_email: "asc" },
      }),
    ]);

    const hasPlatform = (name: string) => tokens.some((t) => t.platform === name);
    const google = tokens
      .filter((t) => t.platform.startsWith("gmail:"))
      .map((t) => {
        const meta = (t.meta ?? {}) as { needsReconnect?: boolean };
        return {
          email: t.platform.slice("gmail:".length).toLowerCase(),
          expiresAt: t.expires_at ? t.expires_at.toISOString() : null,
          // Without a refresh token the grant cannot outlive the current access token, so it will
          // need reconnecting whether or not it happens to work this minute.
          needsReconnect: !t.refresh_token || meta.needsReconnect === true,
        };
      });

    // Same field names the profile settings endpoint returns, so the page can consume either
    // without a second shape to handle.
    return res.status(200).json({
      emailNotifications: client.email_notifications,
      twoFactorEnabled: client.two_factor_enabled,
      theme: client.theme,
      language: client.language,
      connections: {
        google,
        linkedin: hasPlatform("linkedin"),
        facebook: hasPlatform("facebook"),
        googleads: hasPlatform("googleads"),
        mailboxes: mailboxes.map((mb) => ({
          email: mb.account_email,
          label: mb.provider_label ?? null,
        })),
      },
    });
  } catch (e) {
    console.error("client/settings", e);
    return res.status(500).json({ message: "Could not load settings." });
  }
}

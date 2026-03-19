import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { fetchGoogleContacts } from "@/lib/gmail/people";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const userId = Number((session.user as any).id);
  const accountEmail = asStr(req.body?.accountEmail).toLowerCase();
  if (!accountEmail) {
    res.status(400).json({ message: "accountEmail is required." });
    return;
  }

  const tokenResult = await getValidGmailAccessToken(userId, accountEmail);
  if (!tokenResult.ok) {
    res.status(tokenResult.reason === "account_not_found" ? 404 : 401).json({ message: tokenResult.message });
    return;
  }

  const syncState = await prisma.gmailContactSyncState.findUnique({
    where: {
      gmail_contact_sync_userId_accountEmail: {
        userId,
        accountEmail,
      },
    },
  });

  const accessToken = tokenResult.accessToken;
  let syncToken = syncState?.nextSyncToken || null;
  let fullSync = false;
  let responseData: Awaited<ReturnType<typeof fetchGoogleContacts>>;
  try {
    responseData = await fetchGoogleContacts(accessToken, syncToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "contacts sync failed";
    if (message.includes("401")) {
      const refreshResult = await getValidGmailAccessToken(userId, accountEmail, { forceRefresh: true });
      if (!refreshResult.ok) {
        res.status(401).json({ message: refreshResult.message });
        return;
      }
      responseData = await fetchGoogleContacts(refreshResult.accessToken, syncToken);
    } else if (message.includes("410")) {
      fullSync = true;
      syncToken = null;
      responseData = await fetchGoogleContacts(accessToken, null);
    } else {
      await prisma.gmailContactSyncState.upsert({
        where: {
          gmail_contact_sync_userId_accountEmail: {
            userId,
            accountEmail,
          },
        },
        create: {
          userId,
          accountEmail,
          lastSyncAt: new Date(),
          lastSyncStatus: "error",
          lastError: message,
        },
        update: {
          lastSyncAt: new Date(),
          lastSyncStatus: "error",
          lastError: message,
        },
      });
      res.status(502).json({ message });
      return;
    }
  }

  let upserted = 0;
  for (const person of responseData.contacts) {
    if (!person.email) continue;
    await prisma.contact.upsert({
      where: {
        userId_accountEmail_email: {
          userId,
          accountEmail,
          email: person.email.toLowerCase(),
        },
      },
      create: {
        userId,
        accountEmail,
        source: "GMAIL",
        firstName: person.firstName || null,
        lastName: person.lastName || null,
        email: person.email.toLowerCase(),
        phone: person.phone || null,
        business: person.business || null,
        website: person.website || null,
        address: person.address || null,
        gmailResourceName: person.resourceName || null,
        gmailEtag: person.etag || null,
      },
      update: {
        source: "GMAIL",
        firstName: person.firstName || null,
        lastName: person.lastName || null,
        phone: person.phone || null,
        business: person.business || null,
        website: person.website || null,
        address: person.address || null,
        gmailResourceName: person.resourceName || null,
        gmailEtag: person.etag || null,
      },
    });
    upserted += 1;
  }

  await prisma.gmailContactSyncState.upsert({
    where: {
      gmail_contact_sync_userId_accountEmail: {
        userId,
        accountEmail,
      },
    },
    create: {
      userId,
      accountEmail,
      nextSyncToken: responseData.nextSyncToken,
      lastSyncAt: new Date(),
      lastFullSyncAt: fullSync || !syncToken ? new Date() : null,
      lastSyncStatus: "ok",
      lastError: null,
    },
    update: {
      nextSyncToken: responseData.nextSyncToken,
      lastSyncAt: new Date(),
      ...(fullSync || !syncToken ? { lastFullSyncAt: new Date() } : {}),
      lastSyncStatus: "ok",
      lastError: null,
    },
  });
  await syncContactsSpreadsheetForUser({ userId });

  res.status(200).json({
    ok: true,
    upserted,
    nextSyncToken: responseData.nextSyncToken,
    fullSync,
  });
}

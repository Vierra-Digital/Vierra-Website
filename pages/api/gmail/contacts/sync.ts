import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { fetchGoogleContacts } from "@/lib/gmail/people";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { asStr } from "@/lib/api/parsing";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const accountEmail = asStr(req.body?.accountEmail).toLowerCase();
  if (!accountEmail) {
    res.status(400).json({ message: "accountEmail is required." });
    return;
  }

  const accountId = await resolveAccountId(userId, accountEmail);
  if (!accountId) {
    res.status(404).json({ message: "Email account not found." });
    return;
  }

  const tokenResult = await getValidGmailAccessToken(userId, accountEmail);
  if (!tokenResult.ok) {
    res.status(tokenResult.reason === "account_not_found" ? 404 : 401).json({ message: tokenResult.message });
    return;
  }

  const syncState = await prisma.gmailContactSyncState.findUnique({
    where: {
      user_id_account_id: {
        user_id: userId,
        account_id: accountId,
      },
    },
  });

  const accessToken = tokenResult.accessToken;
  let syncToken = syncState?.next_sync_token || null;
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
          user_id_account_id: {
            user_id: userId,
            account_id: accountId,
          },
        },
        create: {
          user_id: userId,
          account_id: accountId,
          last_sync_at: new Date(),
          last_sync_status: "error",
          last_error: message,
        },
        update: {
          last_sync_at: new Date(),
          last_sync_status: "error",
          last_error: message,
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
        user_id_account_id_email: {
          user_id: userId,
          account_id: accountId,
          email: person.email.toLowerCase(),
        },
      },
      create: {
        user_id: userId,
        account_id: accountId,
        source: "gmail",
        first_name: person.firstName || null,
        last_name: person.lastName || null,
        email: person.email.toLowerCase(),
        phone: person.phone || null,
        business: person.business || null,
        website: person.website || null,
        address: person.address || null,
        gmail_resource_name: person.resourceName || null,
        gmail_etag: person.etag || null,
      },
      update: {
        source: "gmail",
        first_name: person.firstName || null,
        last_name: person.lastName || null,
        phone: person.phone || null,
        business: person.business || null,
        website: person.website || null,
        address: person.address || null,
        gmail_resource_name: person.resourceName || null,
        gmail_etag: person.etag || null,
      },
    });
    upserted += 1;
  }

  await prisma.gmailContactSyncState.upsert({
    where: {
      user_id_account_id: {
        user_id: userId,
        account_id: accountId,
      },
    },
    create: {
      user_id: userId,
      account_id: accountId,
      next_sync_token: responseData.nextSyncToken,
      last_sync_at: new Date(),
      last_full_sync_at: fullSync || !syncToken ? new Date() : null,
      last_sync_status: "ok",
      last_error: null,
    },
    update: {
      next_sync_token: responseData.nextSyncToken,
      last_sync_at: new Date(),
      ...(fullSync || !syncToken ? { last_full_sync_at: new Date() } : {}),
      last_sync_status: "ok",
      last_error: null,
    },
  });
  await syncContactsSpreadsheetForUser({ userId, companyId: session.companyId });

  res.status(200).json({
    ok: true,
    upserted,
    nextSyncToken: responseData.nextSyncToken,
    fullSync,
  });
}, { methods: ["POST"] });

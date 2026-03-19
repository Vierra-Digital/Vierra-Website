export type GooglePersonContact = {
  resourceName: string;
  etag: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  business: string;
  website: string;
  address: string;
};

type GooglePeopleListResponse = {
  connections?: Array<{
    resourceName?: string;
    etag?: string;
    names?: Array<{ givenName?: string; familyName?: string }>;
    emailAddresses?: Array<{ value?: string }>;
    phoneNumbers?: Array<{ value?: string }>;
    organizations?: Array<{ name?: string }>;
    urls?: Array<{ value?: string }>;
    addresses?: Array<{ formattedValue?: string }>;
  }>;
  nextPageToken?: string;
  nextSyncToken?: string;
};

function pickFirst<T>(values: Array<T | null | undefined> | undefined) {
  if (!Array.isArray(values) || values.length === 0) return undefined;
  return values[0] || undefined;
}

export async function fetchGoogleContacts(accessToken: string, syncToken?: string | null) {
  const contacts: GooglePersonContact[] = [];
  let pageToken: string | undefined = undefined;
  let nextSyncToken: string | undefined = undefined;

  do {
    const params = new URLSearchParams({
      personFields: "names,emailAddresses,phoneNumbers,organizations,urls,addresses",
      pageSize: "200",
      sortOrder: "LAST_MODIFIED_DESCENDING",
    });
    if (pageToken) params.set("pageToken", pageToken);
    if (syncToken) params.set("syncToken", syncToken);

    const response = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`people api failed ${response.status}: ${text}`);
    }
    const payload = (await response.json()) as GooglePeopleListResponse;
    nextSyncToken = payload.nextSyncToken || nextSyncToken;
    pageToken = payload.nextPageToken;

    for (const person of payload.connections || []) {
      const firstEmail = pickFirst(person.emailAddresses)?.value?.trim().toLowerCase() || "";
      if (!firstEmail) continue;
      const firstName = pickFirst(person.names)?.givenName?.trim() || "";
      const lastName = pickFirst(person.names)?.familyName?.trim() || "";
      contacts.push({
        resourceName: person.resourceName || "",
        etag: person.etag || "",
        firstName,
        lastName,
        email: firstEmail,
        phone: pickFirst(person.phoneNumbers)?.value?.trim() || "",
        business: pickFirst(person.organizations)?.name?.trim() || "",
        website: pickFirst(person.urls)?.value?.trim() || "",
        address: pickFirst(person.addresses)?.formattedValue?.trim() || "",
      });
    }
  } while (pageToken);

  return { contacts, nextSyncToken: nextSyncToken || null };
}

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/client/settings — the source for the Security, Preferences and Connections cards on the
 * staff-facing view of a client's settings.
 *
 * Those cards used to be hidden entirely, because the only settings endpoint returned the SIGNED-IN
 * user's preferences. Rendering that on a client's page would have shown a staff member their own
 * theme, notifications and Google accounts under the client's name. Everything below is about that
 * distinction holding: the row read is the client's, the connections are the client's, and a staff
 * member who names no company gets nothing rather than something.
 */

const { clientFindFirst, clientUpdate, tokenFindMany, mailboxFindMany, requireSessionMock } = vi.hoisted(() => ({
  clientFindFirst: vi.fn(),
  clientUpdate: vi.fn(),
  tokenFindMany: vi.fn(),
  mailboxFindMany: vi.fn(),
  requireSessionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findFirst: clientFindFirst, update: clientUpdate },
    platformToken: { findMany: tokenFindMany },
    emailProviderAccount: { findMany: mailboxFindMany },
  },
}));
vi.mock("@/lib/auth", () => ({ requireSession: requireSessionMock, requireRole: vi.fn() }));

import handler from "@/pages/api/client/settings";

const STAFF = {
  kind: "member",
  user: { id: "staff1", email: "staff@vierradev.com", role: "admin", name: null },
  companyId: "vierra",
};
const CLIENT = { kind: "client", clientId: "cl1", companyId: "co1", user: { id: "cu1" } };

const ROW = {
  user_id: "cu1",
  language: "fr",
  theme: "dark",
  two_factor_enabled: true,
  email_notifications: false,
};

function mockRes() {
  const res: Record<string, unknown> & { statusCode: number; body: any } = {
    statusCode: 0,
    body: undefined,
  };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res;
  });
  res.setHeader = vi.fn(() => res);
  return res as unknown as { statusCode: number; body: any } & Record<string, ReturnType<typeof vi.fn>>;
}

const call = (req: Record<string, unknown>) => {
  const res = mockRes();
  return handler({ method: "GET", query: {}, headers: {}, ...req } as never, res as never).then(
    () => res
  );
};

beforeEach(() => {
  clientFindFirst.mockReset().mockResolvedValue(ROW);
  clientUpdate.mockReset().mockResolvedValue({
    language: 'de',
    theme: 'light',
    two_factor_enabled: false,
    email_notifications: true,
  });
  tokenFindMany.mockReset().mockResolvedValue([]);
  mailboxFindMany.mockReset().mockResolvedValue([]);
  requireSessionMock.mockReset().mockResolvedValue(STAFF);
});

describe("method and access", () => {
  it("takes GET and PUT, and nothing else", async () => {
    const res = await call({ method: "POST" });
    expect(res.statusCode).toBe(405);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET, PUT");
  });

  it("refuses a session with no company at all", async () => {
    requireSessionMock.mockResolvedValue({ kind: "unaffiliated", user: { id: "x" } });
    const res = await call({ query: { companyId: "co1" } });
    expect(res.statusCode).toBe(403);
    expect(clientFindFirst).not.toHaveBeenCalled();
  });

  it("stops when requireSession already answered", async () => {
    requireSessionMock.mockResolvedValue(null);
    const res = await call({ query: { companyId: "co1" } });
    expect(res.statusCode).toBe(0);
    expect(clientFindFirst).not.toHaveBeenCalled();
  });

  it("makes a staff member name the company they are looking at", async () => {
    // A staff session's own companyId is Vierra's row, never a client's, so without an explicit
    // target there is nothing sensible to read.
    const res = await call({ query: {} });
    expect(res.statusCode).toBe(400);
    expect(clientFindFirst).not.toHaveBeenCalled();
  });

  it("404s a company with no client rather than inventing defaults", async () => {
    clientFindFirst.mockResolvedValue(null);
    const res = await call({ query: { companyId: "co-empty" } });
    expect(res.statusCode).toBe(404);
  });
});

describe("which row is read", () => {
  it("scopes a staff read to the named company", async () => {
    await call({ query: { companyId: "co1" } });
    expect(clientFindFirst.mock.calls[0][0].where).toEqual({ company_id: "co1" });
  });

  it("ignores a companyId a representative sends and reads their own row", async () => {
    // A client naming someone else's company must not reach it.
    requireSessionMock.mockResolvedValue(CLIENT);
    await call({ query: { companyId: "someone-elses-company" } });
    expect(clientFindFirst.mock.calls[0][0].where).toEqual({ id: "cl1" });
  });
});

describe("the settings it returns", () => {
  it("returns the client's stored values, not defaults", async () => {
    // The four columns exist on `clients` and had never been read by anything; the whole point is
    // that these are the client's, so a stored non-default must survive the round trip.
    const res = await call({ query: { companyId: "co1" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      language: "fr",
      theme: "dark",
      twoFactorEnabled: true,
      emailNotifications: false,
    });
  });

  it("uses the same field names as the profile settings endpoint", async () => {
    // The page merges whichever it fetched into one state object; a second shape would need a
    // second branch in the component.
    const res = await call({ query: { companyId: "co1" } });
    for (const key of ["emailNotifications", "twoFactorEnabled", "theme", "language"]) {
      expect(res.body, key).toHaveProperty(key);
    }
  });
});

describe("connections", () => {
  it("reads the client's tokens, not the caller's", async () => {
    await call({ query: { companyId: "co1" } });
    expect(tokenFindMany.mock.calls[0][0].where).toEqual({ user_id: "cu1" });
    expect(tokenFindMany.mock.calls[0][0].where).not.toMatchObject({ user_id: "staff1" });
  });

  it("lists Google accounts from the gmail: tokens, lowercased", async () => {
    tokenFindMany.mockResolvedValue([
      {
        platform: "gmail:Sam@Acme.co",
        refresh_token: "r",
        expires_at: new Date("2026-07-01T00:00:00Z"),
        meta: null,
      },
    ]);
    const res = await call({ query: { companyId: "co1" } });
    expect(res.body.connections.google).toEqual([
      { email: "sam@acme.co", expiresAt: "2026-07-01T00:00:00.000Z", needsReconnect: false },
    ]);
  });

  it("flags a grant that cannot refresh itself", async () => {
    // No refresh token means the grant dies with the current access token whether or not it
    // happens to work right now, so it needs reconnecting either way.
    tokenFindMany.mockResolvedValue([
      { platform: "gmail:a@b.co", refresh_token: null, expires_at: null, meta: null },
      { platform: "gmail:c@d.co", refresh_token: "r", expires_at: null, meta: { needsReconnect: true } },
      { platform: "gmail:e@f.co", refresh_token: "r", expires_at: null, meta: {} },
    ]);
    const res = await call({ query: { companyId: "co1" } });
    expect(res.body.connections.google.map((g: { needsReconnect: boolean }) => g.needsReconnect)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("reports the other platforms as booleans", async () => {
    tokenFindMany.mockResolvedValue([
      { platform: "linkedin", refresh_token: "r", expires_at: null, meta: null },
      { platform: "googleads", refresh_token: "r", expires_at: null, meta: null },
    ]);
    const res = await call({ query: { companyId: "co1" } });
    expect(res.body.connections).toMatchObject({
      linkedin: true,
      googleads: true,
      facebook: false,
    });
  });

  it("does not mistake a gmail token for a plain platform match", async () => {
    tokenFindMany.mockResolvedValue([
      { platform: "gmail:a@b.co", refresh_token: "r", expires_at: null, meta: null },
    ]);
    const res = await call({ query: { companyId: "co1" } });
    expect(res.body.connections.linkedin).toBe(false);
    expect(res.body.connections.google).toHaveLength(1);
  });

  it("scopes workspace mailboxes by company, since they are not per-user", async () => {
    mailboxFindMany.mockResolvedValue([
      { account_email: "team@acme.co", provider_label: "Sales" },
      { account_email: "hi@acme.co", provider_label: null },
    ]);
    const res = await call({ query: { companyId: "co1" } });
    expect(mailboxFindMany.mock.calls[0][0].where).toEqual({ company_id: "co1" });
    expect(res.body.connections.mailboxes).toEqual([
      { email: "team@acme.co", label: "Sales" },
      { email: "hi@acme.co", label: null },
    ]);
  });

  it("returns empty connections for a client with no linked user, without querying tokens", async () => {
    clientFindFirst.mockResolvedValue({ ...ROW, user_id: null });
    const res = await call({ query: { companyId: "co1" } });
    expect(tokenFindMany).not.toHaveBeenCalled();
    expect(res.body.connections.google).toEqual([]);
    expect(res.body.connections.linkedin).toBe(false);
  });

  it("never reports a calendar count, because the stored rows cannot support one", async () => {
    // gcalvis: rows are visibility preferences written only when someone toggles a calendar, so
    // their absence means "never chose", not "no calendars". Counting them would state a fact
    // the data does not contain.
    const res = await call({ query: { companyId: "co1" } });
    expect(JSON.stringify(res.body)).not.toContain("calendarCount");
    expect(JSON.stringify(res.body)).not.toContain("gcalvis");
  });
});

describe("failure", () => {
  it("500s rather than throwing out of the handler", async () => {
    clientFindFirst.mockRejectedValue(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({ query: { companyId: "co1" } });
    expect(res.statusCode).toBe(500);
    err.mockRestore();
  });
});

describe("PUT — a staff member changing a client's settings", () => {
  const put = (body: unknown, query: Record<string, string> = { companyId: "co1" }) =>
    call({ method: "PUT", query, body });

  it("writes the change to that client's row", async () => {
    // The id comes from the scoped lookup, never from the request — a caller cannot name the row
    // to update.
    clientFindFirst.mockResolvedValue({ id: "cl-real" });
    const res = await put({ theme: "light" });
    expect(res.statusCode).toBe(200);
    expect(clientFindFirst.mock.calls[0][0].where).toEqual({ company_id: "co1" });
    expect(clientUpdate.mock.calls[0][0].where).toEqual({ id: "cl-real" });
  });

  it("does not let the body choose which row is written", async () => {
    clientFindFirst.mockResolvedValue({ id: "cl-real" });
    await put({ theme: "light", id: "some-other-client", client_id: "another" });
    expect(clientUpdate.mock.calls[0][0].where).toEqual({ id: "cl-real" });
    expect(clientUpdate.mock.calls[0][0].data).not.toHaveProperty("id");
  });

  it("maps the page's field names onto the columns", async () => {
    await put({ emailNotifications: false, twoFactorEnabled: true, theme: "dark", language: "es" });
    expect(clientUpdate.mock.calls[0][0].data).toMatchObject({
      email_notifications: false,
      two_factor_enabled: true,
      theme: "dark",
      language: "es",
    });
  });

  it("returns the saved row in the shape the page reads", async () => {
    const res = await put({ theme: "light" });
    expect(res.body).toEqual({
      emailNotifications: true,
      twoFactorEnabled: false,
      theme: "light",
      language: "de",
    });
  });

  it("writes only the fields that were sent", async () => {
    await put({ theme: "light" });
    expect(Object.keys(clientUpdate.mock.calls[0][0].data).sort()).toEqual(["theme", "updated_at"]);
  });

  it("ignores any column the caller was not offered", async () => {
    // The body reaches Prisma. An allowlist is the only thing stopping a caller renaming the
    // client, moving them to another company, or flipping is_active.
    await put({ theme: "light", email: "attacker@evil.test", company_id: "other", is_active: false });
    const data = clientUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("email");
    expect(data).not.toHaveProperty("company_id");
    expect(data).not.toHaveProperty("is_active");
  });

  it("refuses a value outside the offered set", async () => {
    for (const body of [{ theme: "neon" }, { language: "xx" }, { theme: 5 }, { language: null }]) {
      const res = await put(body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
    }
    expect(clientUpdate).not.toHaveBeenCalled();
  });

  it("refuses a non-boolean for a toggle", async () => {
    for (const body of [{ twoFactorEnabled: "yes" }, { emailNotifications: 1 }]) {
      expect((await put(body)).statusCode, JSON.stringify(body)).toBe(400);
    }
    expect(clientUpdate).not.toHaveBeenCalled();
  });

  it("refuses a body with nothing recognisable in it", async () => {
    for (const body of [{}, { nonsense: true }, null, "text"]) {
      expect((await put(body)).statusCode, JSON.stringify(body)).toBe(400);
    }
    expect(clientUpdate).not.toHaveBeenCalled();
  });

  it("still makes a staff member name the company", async () => {
    const res = await put({ theme: "light" }, {});
    expect(res.statusCode).toBe(400);
    expect(clientUpdate).not.toHaveBeenCalled();
  });

  it("confines a representative to their own row, whatever company they name", async () => {
    requireSessionMock.mockResolvedValue(CLIENT);
    await put({ theme: "light" }, { companyId: "someone-elses-company" });
    expect(clientFindFirst.mock.calls[0][0].where).toEqual({ id: "cl1" });
  });

  it("refuses an unaffiliated session outright", async () => {
    requireSessionMock.mockResolvedValue({ kind: "unaffiliated", user: { id: "x" } });
    const res = await put({ theme: "light" });
    expect(res.statusCode).toBe(403);
    expect(clientUpdate).not.toHaveBeenCalled();
  });

  it("404s a company with no client instead of creating one", async () => {
    clientFindFirst.mockResolvedValue(null);
    const res = await put({ theme: "light" });
    expect(res.statusCode).toBe(404);
    expect(clientUpdate).not.toHaveBeenCalled();
  });

  it("500s rather than throwing when the write fails", async () => {
    clientUpdate.mockRejectedValue(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await put({ theme: "light" })).statusCode).toBe(500);
    err.mockRestore();
  });
});

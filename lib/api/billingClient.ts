import { prisma } from "@/lib/prisma";

/**
 * Which client row a company's billing belongs to.
 *
 * Every billing route used `findFirst({ where: { company_id } })` with no ordering. A company with
 * one client is fine; a company with several is not — Postgres is free to return any of them, and
 * it need not return the same one twice. One real workspace here has three clients and only one of
 * them carries a Stripe customer, so the Billing page showed an address on one request and nothing
 * on the next, and an edit could be written to a different client than the page was reading.
 *
 * Two rules, in order:
 *
 *  1. Prefer the client that actually has a Stripe customer. That is the one billing means.
 *  2. Failing that, the earliest created, so the answer is at least stable and the same route
 *     always reads and writes the same row.
 */

const BILLING_SELECT = {
  id: true,
  name: true,
  user_id: true,
  client_billing: true,
} as const;

type Resolved = {
  id: string;
  name: string;
  user_id: string | null;
  client_billing: { stripe_customer_id: string | null; monthly_retainer_cents: number | null } | null;
};

/** The billing client for a company, or null when the company has none. */
export async function resolveBillingClientByCompany(companyId: string): Promise<Resolved | null> {
  const clients = await prisma.client.findMany({
    where: { company_id: companyId },
    select: BILLING_SELECT,
    orderBy: { created_at: "asc" },
  });
  if (clients.length === 0) return null;
  const withCustomer = clients.find((c) => c.client_billing?.stripe_customer_id);
  return (withCustomer ?? clients[0]) as Resolved;
}

/** The billing client for a representative's own session. */
export async function resolveBillingClientById(clientId: string): Promise<Resolved | null> {
  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: BILLING_SELECT,
  });
  return (client as Resolved) ?? null;
}

/**
 * The one call every billing route makes: a representative always reads their own row, a staff
 * member reads the billing client of the company they named.
 */
export function resolveBillingClient(params: {
  kind: "client" | "member";
  clientId?: string;
  companyId: string;
}): Promise<Resolved | null> {
  return params.kind === "client" && params.clientId
    ? resolveBillingClientById(params.clientId)
    : resolveBillingClientByCompany(params.companyId);
}

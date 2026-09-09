import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

/**
 * Edit the billing details Stripe holds for a customer: who the invoices are addressed to, and
 * where.
 *
 * Answering "how would someone change this" without sending them to Stripe's portal. The portal
 * is still the only place a card is touched — card details must never reach this application —
 * but a company name, billing email, phone and postal address are ordinary fields, and asking
 * someone to leave the panel to fix a typo in a street name was the wrong trade.
 *
 * Nothing is mirrored locally. Stripe stays the record for this, exactly as the read does, so
 * there is no second copy to drift.
 */

const MAX = 200;
/** Stripe wants ISO 3166-1 alpha-2. */
const COUNTRY = /^[A-Za-z]{2}$/;

type Patch = {
  name?: string;
  email?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
};

/** A blank field clears the value in Stripe rather than being ignored. */
function text(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, MAX);
}

function readPatch(body: unknown): { ok: true; data: Patch } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "Billing details are required." };
  const input = body as Record<string, unknown>;
  const data: Patch = {};

  for (const key of ["name", "email", "phone"] as const) {
    const value = text(input[key]);
    if (value !== undefined) data[key] = value ?? "";
  }

  if (input.email !== undefined && typeof input.email === "string" && input.email.trim() !== "") {
    // Loose on purpose: Stripe validates properly, and a stricter pattern here would reject
    // addresses that are perfectly deliverable.
    if (!input.email.includes("@")) return { ok: false, message: "That email address is not valid." };
  }

  const rawAddress = input.address;
  if (rawAddress !== undefined) {
    if (!rawAddress || typeof rawAddress !== "object") {
      return { ok: false, message: "The address must be an object." };
    }
    const a = rawAddress as Record<string, unknown>;
    const address: NonNullable<Patch["address"]> = {};
    for (const [field, column] of [
      ["line1", "line1"],
      ["line2", "line2"],
      ["city", "city"],
      ["state", "state"],
      ["postalCode", "postal_code"],
      ["country", "country"],
    ] as const) {
      const value = text(a[field]);
      if (value !== undefined) address[column] = value ?? "";
    }
    if (address.country && !COUNTRY.test(address.country)) {
      return { ok: false, message: "Country must be a two-letter code, such as US or GB." };
    }
    if (address.country) address.country = address.country.toUpperCase();
    data.address = address;
  }

  if (Object.keys(data).length === 0) return { ok: false, message: "Nothing to change." };
  return { ok: true, data };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await requireSession(req, res);
  if (!session) return;
  if (session.kind === "unaffiliated") return res.status(403).json({ message: "Forbidden" });
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ message: "Billing is not configured." });
  }

  const companyId =
    session.kind === "client" ? session.companyId : resolveTargetCompanyId(session, req);
  if (!companyId) return res.status(400).json({ message: "companyId is required" });

  const patch = readPatch(req.body);
  if (!patch.ok) return res.status(400).json({ message: patch.message });

  try {
    // Scoped the same way the read is: a representative reaches only their own row.
    const client =
      session.kind === "client"
        ? await prisma.client.findFirst({
            where: { id: session.clientId },
            select: { client_billing: { select: { stripe_customer_id: true } } },
          })
        : await prisma.client.findFirst({
            where: { company_id: companyId },
            select: { client_billing: { select: { stripe_customer_id: true } } },
          });

    const customerId = client?.client_billing?.stripe_customer_id;
    if (!customerId) return res.status(404).json({ message: "No billing account yet." });

    const { stripe } = await import("@/lib/stripe");
    const customer = await stripe.customers.update(customerId, patch.data);

    const address = customer.address ?? null;
    return res.status(200).json({
      name: customer.name ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      address: address
        ? {
            line1: address.line1 ?? null,
            line2: address.line2 ?? null,
            city: address.city ?? null,
            state: address.state ?? null,
            postalCode: address.postal_code ?? null,
            country: address.country ?? null,
          }
        : null,
    });
  } catch (e) {
    console.error("client/billing-details", e);
    return res.status(502).json({ message: "Stripe would not accept those details." });
  }
}

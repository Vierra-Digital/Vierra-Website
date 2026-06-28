import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  if (session.kind !== "unaffiliated") {
    return res.status(403).json({ message: "You already belong to a company." });
  }

  const { companyName } = req.body ?? {};
  if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
    return res.status(400).json({ message: "companyName is required" });
  }

  // Bootstrapping a brand-new company has no RLS path (the user has no
  // membership yet, so user_company_id() is null) — the admin client is
  // required here, with eligibility already verified above.
  const admin = getSupabaseAdmin();

  // Ensure the auth user has a public.users row — the handle_new_auth_user
  // trigger should do this on signup, but guard against trigger failures or
  // users created before the trigger existed.
  await admin.from("users").upsert(
    { id: session.user.id, email: session.user.email },
    { onConflict: "id", ignoreDuplicates: true }
  );

  const baseSlug = slugify(companyName);

  for (let attempt = 0; attempt <= 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const { data: company, error } = await admin
      .from("companies")
      .insert({ name: companyName.trim(), slug })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") continue; // slug collision, retry with a suffix
      return res.status(500).json({ message: "Failed to create company" });
    }

    const { error: membershipError } = await admin
      .from("company_memberships")
      .insert({ company_id: company.id, user_id: session.user.id, role: "admin", status: "active" });
    if (membershipError) {
      return res.status(500).json({ message: "Failed to create membership" });
    }

    return res.status(201).json({ companyId: company.id });
  }

  return res.status(500).json({ message: "Failed to create company (slug collision)" });
}

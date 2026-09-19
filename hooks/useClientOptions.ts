import { useEffect, useState } from "react";

export type ClientOption = { id: string; name: string };

/**
 * The client-picker dropdown's data source, shared by every panel page that lets a Vierra staff
 * member pick which client company to act on (Email Analytics, Campaigns, ...). /api/admin/clients
 * returns one row per client REPRESENTATIVE, not per company — a company with several reps (a
 * business with multiple people signed in) would otherwise show as that many duplicate options, so
 * this collapses to one option per company_id before handing it back.
 */
export function useClientOptions(): ClientOption[] {
  const [options, setOptions] = useState<ClientOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/clients", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return;
        const byCompany = new Map<string, string>();
        for (const c of rows as { companyId?: string; businessName?: string }[]) {
          if (c.companyId && !byCompany.has(c.companyId)) byCompany.set(c.companyId, c.businessName || "");
        }
        setOptions([...byCompany.entries()].map(([id, name]) => ({ id, name })));
      })
      .catch(() => {
        /* the picker just stays empty; callers still work unscoped/merged */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}

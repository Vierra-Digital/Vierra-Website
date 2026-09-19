-- Revenue ledger, synced from Stripe via the webhook (invoice.paid / invoice.payment_failed),
-- not hand-kept and not live-pulled on every page load. Before this table, finance_entries'
-- kind='revenue' rows were meant to hold this, but nothing anywhere ever wrote one — every
-- revenue read across the app (Finances page, dashboard tile, client overview) was silently $0.
-- This table becomes the single source of truth those three read from instead.
CREATE TABLE IF NOT EXISTS public.stripe_invoices (
  id                      text PRIMARY KEY,               -- Stripe invoice id, e.g. "in_..."
  -- Nullable + SET NULL, unlike finance_entries' client-cascade pattern: this is a financial
  -- ledger, and deleting a Client must not silently erase their revenue history. The row stays,
  -- still attributable to the company, with client_id cleared.
  client_id               uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_customer_id      text NOT NULL,
  stripe_subscription_id  text,
  status                  text NOT NULL,                  -- paid | open | uncollectible | void
  amount_due_cents        integer NOT NULL,
  amount_paid_cents       integer NOT NULL,
  currency                text NOT NULL,
  period_start            timestamptz,
  period_end              timestamptz,
  hosted_invoice_url      text,
  created_at              timestamptz NOT NULL,            -- Stripe's invoice.created, for bucketing
  paid_at                 timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_company_created
  ON public.stripe_invoices (company_id, created_at);

-- Monthly revenue and expense records behind the dashboard's Revenue/Expenses/Profit tiles.
-- Nothing in the schema held money before this: the Stripe integration stores subscription ids
-- and status only, never an amount, so those figures had no source to read.
CREATE TABLE IF NOT EXISTS finance_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('revenue', 'expense')),
  -- Integer cents, not a float: money in floating point accumulates rounding error.
  amount_cents integer NOT NULL,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_entries_company_occurred
  ON finance_entries (company_id, occurred_at);

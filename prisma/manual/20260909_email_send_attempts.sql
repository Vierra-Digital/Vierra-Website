-- Apply before deploying the P1 email send receipt code. No message bodies or
-- credentials are stored here. Keep receipts while clients may retry a request.
CREATE TABLE IF NOT EXISTS public.email_send_attempts (
  user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'completed', 'uncertain')),
  status_code integer,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE public.email_send_attempts ENABLE ROW LEVEL SECURITY;
-- Only the server database connection accesses receipts; no browser policies.

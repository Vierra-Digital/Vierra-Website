-- Dedup log for the Stripe webhook receiver (pages/api/stripe/webhook.ts). Stripe redelivers an
-- event that wasn't acknowledged in time, or resends on request; stripe_event_id is Stripe's own
-- event.id, stable per event, used to skip re-processing one already handled. Mirrors the existing
-- smartlead_webhook_events pattern (single unique id column) rather than brevo_webhook_events'
-- composite key, since Stripe (like Smartlead) gives a confirmed single unique id per event.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  text NOT NULL UNIQUE,
  event_type       text NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now()
);

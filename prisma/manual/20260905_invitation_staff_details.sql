-- Staff Orbital's invite dialog used to collect a teammate's position, mentor, time zone and
-- strikes; the invitation-based flow that replaced direct staff creation had nowhere to keep
-- them, so the dialog was reduced to email + role. These columns give the invite somewhere to
-- carry that detail until it is accepted, at which point lib/auth/resolveUser.ts copies them
-- onto the company_memberships row it creates.
--
-- All nullable with sensible defaults: every existing invitation stays valid and simply carries
-- no detail.
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS position   text,
  ADD COLUMN IF NOT EXISTS mentor_id  uuid,
  ADD COLUMN IF NOT EXISTS time_zone  text,
  ADD COLUMN IF NOT EXISTS strikes    integer NOT NULL DEFAULT 0;

-- Mentor points at a user, and a mentor who is later removed should blank the field rather than
-- block the delete — the same rule company_memberships.mentor_id already uses.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invitations_mentor_id_fkey'
  ) THEN
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_mentor_id_fkey
      FOREIGN KEY (mentor_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

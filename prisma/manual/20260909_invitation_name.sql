-- Staff Orbital's invite dialog collected no name at all: the row it produced was labelled with the
-- invitee's email address until they signed up and set one themselves, and the person inviting had
-- no way to say who they were inviting.
--
-- The names ride on the invitation the same way position, mentor, time zone and strikes already do
-- (see 20260905_invitation_staff_details.sql), and are joined into public.users.name when the
-- invite is accepted (lib/auth/resolveUser.ts). Kept as two columns rather than one so the dialog
-- can ask for them separately without guessing where to split a combined string.
--
-- Both nullable: every invitation created before this stays valid and simply carries no name.
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text;

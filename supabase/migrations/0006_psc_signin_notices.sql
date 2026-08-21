-- A ledger of "this person has been reported as having signed in for the first
-- time", so that the scheduled check which watches for a first sign-in stays
-- silent once it has announced somebody.
--
-- This is deliberately NOT an activity log: it holds one row per person, ever,
-- and records nothing about what they did. It exists only so the notice is sent
-- once instead of every day, and so a missed run does not lose the event.
--
-- Written by the scheduled check, which connects with service credentials and
-- is not subject to these policies. The portal never writes here; admins can
-- read it so the state is inspectable rather than invisible.
create table if not exists public.psc_signin_notices (
  email             text primary key,
  first_sign_in_at  timestamptz not null,
  notified_at       timestamptz not null default now()
);

alter table public.psc_signin_notices enable row level security;

drop policy if exists psc_signin_notices_read on public.psc_signin_notices;
create policy psc_signin_notices_read on public.psc_signin_notices
  for select to authenticated using (public.psc_is_admin());

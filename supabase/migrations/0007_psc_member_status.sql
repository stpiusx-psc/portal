-- Answer "has this person actually got in yet?" for an administrator.
--
-- The roster in psc_members says who is ALLOWED in. It says nothing about
-- whether they ever showed up, because that lives in auth.users, which the
-- client cannot read. Without this, an invitation is fire-and-forget: there is
-- no way to tell a chased-up parent from one who signed in the same evening.
--
-- security definer so it can see auth.users, and gated on psc_is_admin() inside
-- the query, so a non-admin gets zero rows rather than an error. Nothing here
-- exposes a password or a token; the timestamps are the point.
--
-- Also drops psc_signin_notices, added minutes earlier in 0006 to de-duplicate a
-- scheduled first-sign-in notice. That check cannot run unattended in this
-- setup (a scheduled session has no database access), so the table has no
-- reader and is removed rather than left behind as dead schema.
drop table if exists public.psc_signin_notices;

create or replace function public.psc_member_status()
returns table (
  email               text,
  has_account         boolean,
  email_confirmed     boolean,
  account_created_at  timestamptz,
  last_sign_in_at     timestamptz
)
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select m.email,
         (u.id is not null),
         (u.email_confirmed_at is not null),
         u.created_at,
         u.last_sign_in_at
  from public.psc_members m
  left join auth.users u on lower(u.email) = m.email
  where public.psc_is_admin()
$$;

revoke all on function public.psc_member_status() from public, anon;
grant execute on function public.psc_member_status() to authenticated;

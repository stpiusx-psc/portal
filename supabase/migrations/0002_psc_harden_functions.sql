-- Hardening from the Supabase security linter, applied to the psc_ objects.
--
-- 1. Pin search_path on the functions that were missing it, so a caller cannot
--    influence which schema they resolve names in.
-- 2. Take EXECUTE away from PUBLIC/anon on the membership helpers. They only
--    report on the caller, but a signed-out visitor has no reason to call them.
--    The RLS policies are scoped `to authenticated`, so anon never reaches them.

create or replace function public.psc_email() returns text
  language sql stable security invoker set search_path = public, pg_temp as
$$ select lower(nullif(auth.jwt() ->> 'email', '')) $$;

create or replace function public.psc_touch() returns trigger
  language plpgsql security invoker set search_path = public, pg_temp as
$$ begin
     new.updated_at := now();
     new.updated_by := public.psc_email();
     return new;
   end $$;

revoke execute on function public.psc_email()     from public, anon;
revoke execute on function public.psc_is_member() from public, anon;
revoke execute on function public.psc_can_edit()  from public, anon;
revoke execute on function public.psc_is_admin()  from public, anon;

grant execute on function public.psc_email()     to authenticated;
grant execute on function public.psc_is_member() to authenticated;
grant execute on function public.psc_can_edit()  to authenticated;
grant execute on function public.psc_is_admin()  to authenticated;

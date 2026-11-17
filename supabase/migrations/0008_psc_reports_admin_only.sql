-- PEC reports are the liaison's working drafts, not shared committee data.
--
-- They were readable by every member and editable -- and deletable -- by every
-- editor, which in practice means the School Principal and the PEC chair and
-- secretary, since those are editor accounts. A draft report carries the PSC's
-- asks and its financial position before either has been put to the PEC, so it
-- should not be visible to the people it is about to be presented to.
--
-- Hiding the tab in the UI would not have been enough: the policies are what
-- actually decide, and the anon key is public, so anybody who can sign in could
-- have read the table directly.
drop policy if exists psc_reports_read on public.psc_pec_reports;
create policy psc_reports_read on public.psc_pec_reports
  for select to authenticated using (public.psc_is_admin());

drop policy if exists psc_reports_write on public.psc_pec_reports;
create policy psc_reports_write on public.psc_pec_reports
  for all to authenticated using (public.psc_is_admin()) with check (public.psc_is_admin());

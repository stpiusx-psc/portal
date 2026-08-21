-- Give the school principal access to the portal.
--
-- Editor rather than viewer: she confirms dates, so she needs to be able to
-- change them rather than ask somebody else to.
insert into public.psc_members (email, display_name, role) values
  ('cfrancis@saintpius.ca', 'Charlaine Francis', 'editor')
on conflict (email) do update
  set display_name = excluded.display_name,
      role         = excluded.role;

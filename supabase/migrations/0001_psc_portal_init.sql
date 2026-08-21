-- ---------------------------------------------------------------------------
-- St. Pius X PSC portal — shared data layer.
--
-- APPLIED to the "Docusafe" Supabase project (pddqdfgwnhkojlnjcwzj).
--
-- The tables live in `public` with a psc_ prefix, matching the cmd_/cmo_/pv_
-- convention the other apps in that project already use, and each carries its
-- own row-level security so nothing is shared with them.
--
-- Access is granted by EMAIL ADDRESS rather than user id, so a new committee
-- member can be authorised before they have ever created an account.
-- ---------------------------------------------------------------------------

create table if not exists public.psc_members (
  email        text primary key,
  display_name text,
  role         text not null default 'viewer'
                 check (role in ('admin', 'editor', 'viewer')),
  created_at   timestamptz not null default now()
);

create table if not exists public.psc_event_overrides (
  school_year     text not null,
  event_id        text not null,
  date            date,
  end_date        date,
  date_confidence text check (date_confidence in ('proposed', 'confirmed', 'tbd')),
  main_resp       text[],
  support_resp    text[],
  sign_up_url     text,
  budget          numeric(10, 2) check (budget is null or budget >= 0),
  volunteer_count integer check (volunteer_count is null or volunteer_count >= 0),
  status          text check (status in ('active', 'discontinued', 'idea')),
  notes           text,
  prep_done       jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  primary key (school_year, event_id),
  constraint psc_end_after_start check (end_date is null or date is null or end_date >= date)
);

create table if not exists public.psc_pec_reports (
  id                  text primary key,
  school_year         text not null,
  source_meeting_date date,
  pec_meeting_date    date,
  title               text not null,
  highlights          text[] not null default '{}',
  decisions           text[] not null default '{}',
  financials          text[] not null default '{}',
  asks_for_pec        text[] not null default '{}',
  upcoming            text[] not null default '{}',
  source_text         text,
  created_at          timestamptz not null default now(),
  created_by          text
);

create table if not exists public.psc_pec_notes (
  id                  text primary key,
  school_year         text not null,
  meeting_date        date not null,
  attendees           text,
  points              text[] not null default '{}',
  feedback_on_minutes text[] not null default '{}',
  actions             text[] not null default '{}',
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  created_by          text
);

create index if not exists psc_overrides_year_idx on public.psc_event_overrides (school_year);
create index if not exists psc_reports_year_idx on public.psc_pec_reports (school_year, source_meeting_date desc);
create index if not exists psc_notes_year_idx on public.psc_pec_notes (school_year, meeting_date desc);

-- --------------------------------------------------------------------- helpers
create or replace function public.psc_email() returns text
  language sql stable as
$$ select lower(nullif(auth.jwt() ->> 'email', '')) $$;

create or replace function public.psc_is_member() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.psc_members m where m.email = public.psc_email()) $$;

create or replace function public.psc_can_edit() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.psc_members m
     where m.email = public.psc_email() and m.role in ('admin', 'editor')
   ) $$;

create or replace function public.psc_is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.psc_members m
     where m.email = public.psc_email() and m.role = 'admin'
   ) $$;

-- -------------------------------------------------------------------- security
alter table public.psc_members         enable row level security;
alter table public.psc_event_overrides enable row level security;
alter table public.psc_pec_reports     enable row level security;
alter table public.psc_pec_notes       enable row level security;

drop policy if exists psc_members_read on public.psc_members;
create policy psc_members_read on public.psc_members
  for select to authenticated using (public.psc_is_member());

drop policy if exists psc_members_admin on public.psc_members;
create policy psc_members_admin on public.psc_members
  for all to authenticated using (public.psc_is_admin()) with check (public.psc_is_admin());

drop policy if exists psc_overrides_read on public.psc_event_overrides;
create policy psc_overrides_read on public.psc_event_overrides
  for select to authenticated using (public.psc_is_member());

drop policy if exists psc_overrides_write on public.psc_event_overrides;
create policy psc_overrides_write on public.psc_event_overrides
  for all to authenticated using (public.psc_can_edit()) with check (public.psc_can_edit());

drop policy if exists psc_reports_read on public.psc_pec_reports;
create policy psc_reports_read on public.psc_pec_reports
  for select to authenticated using (public.psc_is_member());

drop policy if exists psc_reports_write on public.psc_pec_reports;
create policy psc_reports_write on public.psc_pec_reports
  for all to authenticated using (public.psc_can_edit()) with check (public.psc_can_edit());

drop policy if exists psc_notes_read on public.psc_pec_notes;
create policy psc_notes_read on public.psc_pec_notes
  for select to authenticated using (public.psc_is_member());

drop policy if exists psc_notes_write on public.psc_pec_notes;
create policy psc_notes_write on public.psc_pec_notes
  for all to authenticated using (public.psc_can_edit()) with check (public.psc_can_edit());

-- Stamp who last touched a calendar row.
create or replace function public.psc_touch() returns trigger
  language plpgsql as
$$ begin
     new.updated_at := now();
     new.updated_by := public.psc_email();
     return new;
   end $$;

drop trigger if exists psc_overrides_touch on public.psc_event_overrides;
create trigger psc_overrides_touch before insert or update on public.psc_event_overrides
  for each row execute function public.psc_touch();

-- ------------------------------------------------------------------- the roster
insert into public.psc_members (email, display_name, role) values
  ('jorge@naturaltrade.ca',   'Jorge Chinchilla', 'admin'),
  ('lyndadfreeman@gmail.com', 'Lynda Freeman',    'editor')
on conflict (email) do nothing;

-- To add Ms. Francis later, either use People & Access in the portal or run:
--   insert into public.psc_members (email, display_name, role)
--   values ('cfrancis@saintpius.ca', 'Charlaine Francis', 'viewer');

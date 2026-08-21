-- ---------------------------------------------------------------------------
-- St. Pius X PSC portal — shared data layer.
--
-- Not applied yet. Run this once a Supabase project is chosen, then set
-- VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY so the portal switches from
-- browser-local storage to a shared database.
--
-- Everything lives in its own `psc` schema so the portal can share an existing
-- project without touching anything else in it.
-- ---------------------------------------------------------------------------

create schema if not exists psc;

-- Who is allowed in, and what they may do. Rows are created by an admin;
-- signing in with an email that has no row here grants read-only access to
-- nothing, which is the safe default.
create table if not exists psc.members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  display_name text,
  role        text not null default 'viewer'
                check (role in ('admin', 'editor', 'viewer')),
  created_at  timestamptz not null default now()
);

-- Editable, per-year state for an event. The playbook, lessons learned and
-- prior-year actuals stay in the repo; only what volunteers change lives here.
create table if not exists psc.event_overrides (
  school_year      text not null,
  event_id         text not null,
  date             date,
  end_date         date,
  date_confidence  text check (date_confidence in ('proposed', 'confirmed', 'tbd')),
  main_resp        text[],
  support_resp     text[],
  sign_up_url      text,
  budget           numeric(10, 2) check (budget is null or budget >= 0),
  volunteer_count  integer check (volunteer_count is null or volunteer_count >= 0),
  status           text check (status in ('active', 'discontinued', 'idea')),
  notes            text,
  prep_done        jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id),
  primary key (school_year, event_id),
  constraint end_after_start check (end_date is null or date is null or end_date >= date)
);

-- Generated PEC reports, kept so the liaison has a trail of what was sent.
create table if not exists psc.pec_reports (
  id                   uuid primary key default gen_random_uuid(),
  school_year          text not null,
  source_meeting_date  date,
  pec_meeting_date     date,
  title                text not null,
  highlights           text[] not null default '{}',
  decisions            text[] not null default '{}',
  financials           text[] not null default '{}',
  asks_for_pec         text[] not null default '{}',
  upcoming             text[] not null default '{}',
  source_text          text,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id)
);

-- Notes taken during a PEC meeting, and whether the feedback email went out.
create table if not exists psc.pec_notes (
  id                   uuid primary key default gen_random_uuid(),
  school_year          text not null,
  meeting_date         date not null,
  attendees            text,
  points               text[] not null default '{}',
  feedback_on_minutes  text[] not null default '{}',
  actions              text[] not null default '{}',
  sent_at              timestamptz,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id)
);

create index if not exists event_overrides_year_idx on psc.event_overrides (school_year);
create index if not exists pec_reports_year_idx on psc.pec_reports (school_year, source_meeting_date desc);
create index if not exists pec_notes_year_idx on psc.pec_notes (school_year, meeting_date desc);

-- ------------------------------------------------------------------ security
alter table psc.members         enable row level security;
alter table psc.event_overrides enable row level security;
alter table psc.pec_reports     enable row level security;
alter table psc.pec_notes       enable row level security;

create or replace function psc.is_member() returns boolean
  language sql stable security definer set search_path = psc, public as
$$ select exists (select 1 from psc.members m where m.user_id = auth.uid()) $$;

create or replace function psc.can_edit() returns boolean
  language sql stable security definer set search_path = psc, public as
$$ select exists (
     select 1 from psc.members m
     where m.user_id = auth.uid() and m.role in ('admin', 'editor')
   ) $$;

-- Members can see the roster; only admins change it.
drop policy if exists members_read on psc.members;
create policy members_read on psc.members
  for select using (psc.is_member());

drop policy if exists members_admin on psc.members;
create policy members_admin on psc.members
  for all using (exists (
    select 1 from psc.members m where m.user_id = auth.uid() and m.role = 'admin'
  ));

-- Everyone signed in and on the roster reads the calendar; editors change it.
drop policy if exists overrides_read on psc.event_overrides;
create policy overrides_read on psc.event_overrides
  for select using (psc.is_member());

drop policy if exists overrides_write on psc.event_overrides;
create policy overrides_write on psc.event_overrides
  for all using (psc.can_edit()) with check (psc.can_edit());

drop policy if exists reports_read on psc.pec_reports;
create policy reports_read on psc.pec_reports
  for select using (psc.is_member());

drop policy if exists reports_write on psc.pec_reports;
create policy reports_write on psc.pec_reports
  for all using (psc.can_edit()) with check (psc.can_edit());

drop policy if exists notes_read on psc.pec_notes;
create policy notes_read on psc.pec_notes
  for select using (psc.is_member());

drop policy if exists notes_write on psc.pec_notes;
create policy notes_write on psc.pec_notes
  for all using (psc.can_edit()) with check (psc.can_edit());

-- Keep updated_at honest.
create or replace function psc.touch_updated_at() returns trigger
  language plpgsql as
$$ begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;

drop trigger if exists event_overrides_touch on psc.event_overrides;
create trigger event_overrides_touch before update on psc.event_overrides
  for each row execute function psc.touch_updated_at();

-- ------------------------------------------------------------------- seeding
-- Grant the first two people access. Replace the user_id values after each
-- person has signed in once (their uuid appears in auth.users).
--
-- insert into psc.members (user_id, email, display_name, role) values
--   ('<uuid>', 'jorge@naturaltrade.ca',   'Jorge Chinchilla', 'admin'),
--   ('<uuid>', 'lyndadfreeman@gmail.com', 'Lynda Freeman',    'editor');

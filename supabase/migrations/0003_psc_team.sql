-- The committee roster becomes editable data rather than a code constant,
-- because parents join and leave every year.
--
-- NOTE: `title` here is the person's committee position (Chair, Committee,
-- Principal). It is NOT an access level -- that lives in psc_members.role.
create table if not exists public.psc_team (
  id          bigint generated always as identity primary key,
  name        text not null,
  title       text not null default 'Committee',
  active      boolean not null default true,
  sort_order  integer not null default 1000,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text,
  constraint psc_team_name_unique unique (name)
);

create index if not exists psc_team_active_idx on public.psc_team (active, sort_order);

alter table public.psc_team enable row level security;

drop policy if exists psc_team_read on public.psc_team;
create policy psc_team_read on public.psc_team
  for select to authenticated using (public.psc_is_member());

drop policy if exists psc_team_write on public.psc_team;
create policy psc_team_write on public.psc_team
  for all to authenticated using (public.psc_can_edit()) with check (public.psc_can_edit());

create or replace function public.psc_team_touch() returns trigger
  language plpgsql security invoker set search_path = public, pg_temp as
$$ begin
     new.updated_at := now();
     new.updated_by := public.psc_email();
     return new;
   end $$;

drop trigger if exists psc_team_touch_trg on public.psc_team;
create trigger psc_team_touch_trg before insert or update on public.psc_team
  for each row execute function public.psc_team_touch();

insert into public.psc_team (name, title, active, sort_order, note) values
  ('Lynda Freeman', 'PSC Chair', true, 0, 'Chair, Back to School BBQ, Christmas Craft Fair, Runathon, Family Fun Night'),
  ('Miss C. Francis', 'School Principal', true, 10, 'Opening prayer, School liaison, Approvals, Payments'),
  ('Jorge Chinchilla', 'PEC Liaison', true, 20, 'PSC ↔ PEC reporting'),
  ('Julie Hogarth', 'Committee', true, 30, 'Back to School BBQ, Hot Lunch, Runathon, Christmas Craft Fair, Sports Day'),
  ('Stephanie Toves', 'Committee', true, 40, 'Back to School BBQ, Christmas Craft Fair, Family Fun Night'),
  ('Eileen Wilson', 'Committee', true, 50, 'Hot Lunch, Christmas Craft Fair, AGM Wine & Cheese, The Card Project'),
  ('Ana Luisa Martinez', 'Committee', true, 60, 'Kindergarten Potluck, Christmas Craft Fair, Family Fun Night'),
  ('Diana Martins-Garbutt', 'Committee', true, 70, 'Poinsettia Sale, Intermediate Speech Arts'),
  ('Michael Sun', 'Hot Lunch Vendor Coordinator', true, 80, 'Hot Lunch'),
  ('Surabhi Anand', 'Hot Lunch Coordinator (in training)', true, 90, 'Hot Lunch — succession from Michael Sun'),
  ('Jennifer Dales', 'Committee', true, 100, 'Used Uniform Sale, Scholastic Book Fair, Shrove Tuesday Pancakes'),
  ('Kate Blomfeldt (Parkins)', 'Committee', true, 110, 'Christmas Craft Fair — vendors, Family Fun Night'),
  ('Olivia Matthews', 'Committee', true, 120, 'Grade 7 Graduation, Christmas Craft Fair — advertising'),
  ('Veronica Price', 'Committee', true, 130, 'Kindergarten Potluck, Family Fun Night, Thank-you notes'),
  ('Penny Lidstone (Miller)', 'Committee', true, 140, 'Lost and Found'),
  ('Shadi Baker', 'Committee', true, 150, 'Crossing Guard sign-ups, Christmas Craft Fair, Family Fun Night'),
  ('Jeannie Ha', 'Committee', true, 160, 'Teacher Appreciation, Volunteer tea'),
  ('Vivian Bopp', 'Committee', true, 170, 'Runathon — cash balancing & data entry'),
  ('Kelsey Swanekamp', 'Committee', true, 180, 'Christmas Craft Fair — raffle'),
  ('Parbs Bains', 'Committee', true, 190, 'Christmas Market'),
  ('Lina Barrera', 'Committee', true, 200, 'Christmas Market'),
  ('Clarizz Calinisan', 'Committee', true, 210, 'Christmas Market'),
  ('Ana Cristina Serrano', 'Committee', true, 220, 'Costume Sale (discontinued 2025)'),
  ('Jennifer Hetherington', 'Committee', true, 230, 'Lice Check'),
  ('Jenny O''Mahony', 'Committee', true, 240, 'Family Fun Night, Lice Check'),
  ('Lenora Delaney', 'Committee', true, 250, null),
  ('Amy Castaldo', 'Committee', true, 260, null),
  ('Helena Chun', 'Committee', true, 270, null),
  ('Lisa Faist', 'Committee', true, 280, null)
on conflict (name) do nothing;

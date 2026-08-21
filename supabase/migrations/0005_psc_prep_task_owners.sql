-- Per-task owners on an event's preparation timeline, so work can be handed
-- out task by task rather than only at whole-event level.
--
-- Shaped like prep_done: a JSON object keyed by the task's index within the
-- event's seeded prep list, e.g. {"0": "Julie Hogarth", "3": "Kate Blomfeldt"}.
alter table public.psc_event_overrides
  add column if not exists prep_owner jsonb not null default '{}'::jsonb;

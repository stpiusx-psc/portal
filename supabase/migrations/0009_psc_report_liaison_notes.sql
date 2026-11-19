-- The liaison's own notes from the PEC meeting a report was taken to.
--
-- Kept on the report rather than in psc_pec_notes, because that table is for
-- live note-taking that builds the feedback email to the chair. These are the
-- other half of the loop: what was sent to the PEC, and what came back. Holding
-- both on one row means opening last month's report shows both at once.
--
-- No separate policy: psc_pec_reports is already administrator-only as of 0008,
-- which is exactly the audience for a private note.
alter table public.psc_pec_reports
  add column if not exists liaison_notes text[] not null default '{}';

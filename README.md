# St. Pius X — PSC ↔ PEC Portal

A working portal for the St. Pius X Elementary **Parent Standing Committee (PSC)**
and the liaison role with the **Parents Education Committee (PEC)**.

It does four things:

1. **Year calendar** — every PSC activity for the school year, with the date, the
   main responsible, the volunteer sign-up link and the assigned budget. Exportable
   by month, two months, term or full year, at three levels of detail, as PDF,
   spreadsheet or a calendar file you can import into Google Calendar.
2. **Event playbooks** — for each event: the run sheet, the preparation timeline,
   prior-year revenue and costs, the lessons learned, and links to the documents
   on the shared Drive. So a new volunteer can pick up an event without a handover.
3. **PEC reports** — paste in the PSC agenda or minutes Lynda circulates and it
   drafts the monthly report for the PEC, sorted into highlights, decisions,
   financials, asks and what's coming up.
4. **PEC meeting notes** — type notes live during the PEC meeting, then turn them
   into a feedback email to the PSC chair.

Everything in the UI is in English.

---

## Where the content came from

Nothing in the seeded calendar is invented. It was built from:

- The 2025-26 PSC agendas and minutes (September, October, November) and the
  May 2025 minutes.
- The [PSC shared Drive](https://drive.google.com/drive/folders/1JdU9kNDjTZkHDR13oV0Yw21b5zTKHgFt):
  the **PSC Timeline** (the month-by-month task plan), the per-event folders, the
  finance sheets (`BBQ Finances`, `Christmas Fair 2025`, `Spring Fair 2024 summary`),
  the station instruction documents, and the event debriefs.
- The school's *Fundraising Floats and Expense Reimbursements* policy.

### About the dates

The minutes are from **2025-26**. Every date for **2026-27** was rolled forward to
the equivalent weekday of the equivalent week and is marked **Proposed**. Each
event also records `priorYearDate` so the roll-forward can be checked.

**Proposed dates are not real dates.** Confirm each one with Ms. Francis, then set
it to *Confirmed* in the portal. Exports label unconfirmed events "(proposed)" so a
rolled-forward date is never mistaken for an agreed one.

### About personal data

The portal deliberately stores **names and roles only** — no parent emails or phone
numbers. Those stay in the access-controlled PSC Contact List on the shared Drive.
This is what makes it safe to deploy the portal and share the link.

---

## Running it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## Deploying

The repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that
builds and publishes to **GitHub Pages** on every push to `main`.

To turn it on: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

> GitHub Pages on a **private** repo needs a paid plan. On the free plan either
> make the repo public — safe to do, because no personal contact data is stored —
> or connect the repo to Cloudflare Pages / Netlify / Vercel instead (build
> command `npm run build`, output directory `dist`).

The build honours `VITE_BASE_PATH`, so the same bundle works from a project
subpath (`/St.-Pius-PSC/`) or from the root of a custom domain.

## Storage: how edits are saved

Right now edits are saved in **the browser of whoever makes them** and are not yet
shared between people. That was a deliberate first step: the portal is fully usable
today with no database to set up or pay for. **Backup & Data** exports everything to
a single JSON file — keep it in the shared Drive.

To make it genuinely shared, apply `supabase/migrations/0001_init.sql` to a Supabase
project and set:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The migration creates a `psc` schema (so it can live inside an existing project),
tables for the editable event fields, PEC reports and PEC notes, and row-level
security driven by a `psc.members` roster with `admin` / `editor` / `viewer` roles.
Sign-in is by email magic link, which works with any address including Gmail.

## Project layout

```
src/
  data/          seeded content — events, playbooks, meetings, team
  lib/
    types.ts     the domain model
    dates.ts     school-year and calendar maths
    store.ts     persistence and the seed/override merge
    pecReport.ts the PSC-minutes parser and report generator
    exporters.ts ICS, CSV, text and print/PDF output
  views/         one file per screen
  components/    shared UI and the event editor
supabase/migrations/  the shared-database schema (not yet applied)
docs/                 the user manual for the PSC chair
```

### How editing works without losing data

Seeded content lives in the repo. What a volunteer changes is stored separately as
an **override** keyed by event id, then merged on top. Improving a playbook in code
never overwrites somebody's edited date or budget, and *Reset to original* on any
event drops just that override.

## Documentation

`docs/SPX-PSC-Portal-User-Guide.pdf` is the guide for the PSC chair. It is generated
from `docs/user-manual.html` and the screenshots in `docs/img/`, so it can be
regenerated after a UI change by printing that page to PDF.

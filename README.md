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

## Accounts and access

Sign-in is **email and password**. Access is granted per email address in the
`psc_members` table, so somebody can be authorised *before* they have an account:

1. An administrator adds their email under **People &amp; Access** in the portal.
2. That person opens the portal, chooses *Create an account*, and signs up with
   exactly that email.
3. They confirm the address from the email Supabase sends, then sign in.

Three access levels: **admin** (everything, plus inviting people), **editor** (can
change dates, owners, budgets, reports and notes) and **viewer** (read only).

Anyone who signs up with an email that is *not* on the roster gets a clear "not on
the list yet" screen and, crucially, **no data** — row-level security returns zero
rows rather than relying on the UI to hide anything. This is verified in the
database, not just in the client.

## Storage

The deployed portal reads and writes a shared Supabase database, so an edit by one
person is immediately visible to everyone else. The relevant configuration lives in
`.env.production`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The anon key is Supabase's *publishable* client key and is meant to be in the
bundle — it grants nothing on its own. Never put the `service_role` key there,
because that one does bypass row-level security.

Builds without those variables fall back to browser-local storage and say so in the
sidebar, which is what `npm run dev` does by default.

**Backup &amp; Data** still exports everything to a single JSON file. Worth doing
before any big change.

### The database

`supabase/migrations/` holds what is actually deployed, applied to the **Docusafe**
Supabase project. The tables sit in `public` with a `psc_` prefix, matching the
`cmd_`/`cmo_`/`pv_` convention that project already uses, and each has its own
row-level security so the portal shares nothing with the other apps in there.

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

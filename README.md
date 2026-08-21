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

The portal is published at **https://stpiusx-psc.github.io/portal/**.

Two repository settings are required once, before the first deploy can succeed:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
   The workflow cannot do this for you — creating a Pages site needs
   repository-admin rights, which `GITHUB_TOKEN` does not have, so
   `configure-pages` with `enablement: true` fails with *"Resource not
   accessible by integration"*.
2. **Settings → Actions → General → Workflow permissions: Read and write.**
   `actions/deploy-pages` needs `pages: write` at deploy time.

Pages on a **private** repo also needs a paid plan; this repo is public, which is
safe because no parent contact details are stored. The alternative is Cloudflare
Pages / Netlify / Vercel against a private repo (build `npm run build`, output
`dist`).

The workflow derives `VITE_BASE_PATH` from the repository name, so the same
bundle works from any project subpath (`/portal/`) without editing anything. Set
it to `/` if the portal later moves to a custom domain served from the root.

**Publishing is gated twice, in two different places.** The `deploy` job skips
itself outside the default branch — that is this repository's policy, and it is
why a feature-branch push ends green with `build` acting as a type-check. But
the `github-pages` **environment** has its own "Deployment branches and tags"
rule under *Settings -> Environments*, and that one is the hard gate.

GitHub writes that rule when Pages is first enabled, naming whichever branch was
the default **at that moment**, and it does not follow a later change of default
branch. So switching the default branch is not enough on its own: the
environment rule has to be updated to name the new branch too, or every deploy
is refused.

A refusal there is nearly unreadable: the job is rejected before it starts, so
it ends in about a second with no steps, no runner and no log. Build green and
deploy dead in one second on the branch that is supposed to publish means the
environment rule is stale.

### If the repository moves

Transferring or renaming the repository changes the published URL. Four things
then need doing, the first of them urgently:

1. **Re-run the deploy workflow.** The base path is compiled into the published
   bundle, so until the workflow runs again under the new name the live site
   still asks for `/<old-name>/assets/...`. Those requests 404, and the page
   renders **blank white with nothing in the console to point at the cause** —
   it looks like the site is down rather than misaddressed. A push to the
   default branch, or a manual run, fixes it.
2. The Supabase **Redirect URLs** allow-list — otherwise password resets land in
   whichever app owns the project's Site URL.
3. The URL on the cover of `docs/user-manual.html`.
4. `docs/invitation-email-draft.md`.

## Accounts and access

Sign-in is **email and password**. Access is granted per email address in the
`psc_members` table, so somebody can be authorised *before* they have an account:

1. An administrator adds their email under **People &amp; Access** in the portal.
2. That person opens the portal, chooses *Create an account*, and signs up with
   exactly that email.
3. They confirm the address from the email Supabase sends, then sign in.

The Supabase project is **shared with the other app in it**, and so is its pool
of accounts. Anybody who already signed in to that app already has an account
here and must use *Sign in*, not *Create an account* — signing up again sends no
email at all, because Supabase answers a repeat sign-up with a success and
silence rather than admitting the address is taken. The portal detects that case
and says so instead of promising an email; if somebody is stuck waiting for a
confirmation that never arrives, *Forgot your password?* is the way in.

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

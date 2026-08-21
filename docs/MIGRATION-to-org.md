# Moving the portal to the stpiusx-psc organisation

The repository started under a personal GitHub account. Moving it to the
`stpiusx-psc` organisation removes the personal handle from the public URL and,
more importantly, means the portal no longer depends on one person's account.

**Transfer the existing repository — do not create a new one.** A transfer keeps
the full commit history, the Actions setup and the deployment history. Creating a
fresh repository and pushing to it loses all of that for no benefit.

## Steps

1. **Transfer** — on `github.com/jchinchillav/St.-Pius-PSC`:
   Settings → General → Danger Zone → **Transfer ownership** → new owner
   `stpiusx-psc`.

2. **Rename** — on the transferred repository:
   Settings → General → Repository name → `portal` → Rename.

   The build reads the repository name to work out its own base path, so nothing
   in the code needs editing for this.

3. **Re-enable Pages** — Settings → Pages → Build and deployment →
   Source: **GitHub Actions**. A transfer does not carry this over.

4. **Workflow permissions** — Settings → Actions → General → Workflow
   permissions → **Read and write permissions** → Save.

5. **Re-run the deploy** — Actions → "Build and deploy to GitHub Pages" →
   Run workflow.

6. **Supabase redirect allow-list** — this one is easy to forget and breaks
   password resets silently. In the Supabase dashboard for the **Docusafe**
   project: Authentication → URL Configuration → Redirect URLs, add:

   ```
   https://stpiusx-psc.github.io/portal/**
   ```

   Remove the old `jchinchillav` entry once the new URL is confirmed working.
   **Do not change the project's Site URL** — it belongs to another app in the
   same project, and changing it would break that app's sign-in.

## The result

```
https://stpiusx-psc.github.io/portal/
```

## What already points at the new URL

`README.md`, `docs/user-manual.html` and the generated
`docs/SPX-PSC-Portal-User-Guide.pdf`, and `docs/invitation-email-draft.md` were
all updated ahead of the move, so the guide and the invitation email can be sent
as soon as the transfer is done.

## Worth doing afterwards

Add a second organisation owner (the PSC chair) under the organisation's People
settings. The point of moving off a personal account is that the portal survives
any one person leaving the committee, and that only holds if more than one person
can administer it.

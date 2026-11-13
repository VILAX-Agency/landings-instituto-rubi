# Phase 2 plan: Lead forms (Supabase Free, Resend, Turnstile) on Vercel Pro

> **Status:** approved plan, **not implemented yet**. Implementation will happen on `feat/fase-2-leads`, branched
> from `main` once all existing work is merged. The pending decisions in section E must be resolved
> before production.
>
> Last updated: 2026-11-13. Base: `main` at `a5256f6` (includes PRs #1, #2 and #3).

## A. Objective and confirmed decisions

Make the existing landing forms operational for paid-ads traffic (about 15–30 leads/day), with reliable
storage, email notification and deployment on Vercel. **Guiding principle: avoid over-engineering** while
preserving security and maintainability.

| Component | Decision |
|---|---|
| Frontend | Astro, statically generated; only API routes run on demand |
| Hosting | Vercel Pro, server functions in the EU (`fra1`) |
| Production domain | `tratamiento.institutorubi.com` |
| URL structure | `/{tratamiento}/{localidad}/` (empty base path) |
| Database | **Supabase Free (confirmed)**, EU region |
| Email notifications | Resend Free, single provider |
| Anti-spam | Cloudflare Turnstile + honeypot + Vercel WAF rate-limit rule |
| JavaScript | **Required to submit in production**; `<noscript>` shows the clinic's phone number |
| SEO | Paid ads only; every HTML page stays `noindex` |
| Deployment | GitHub → Vercel |

**Out of scope for this phase:**
- CRM integration or a lead dashboard;
- multiple email providers;
- queues, Redis or other additional services;
- routing notifications by city;
- cookie consent and advertising/conversion tracking;
- automated lead deletion, until a retention period is approved.

Existing landing designs, content structures and treatment slugs must not change in this phase.
Production services must not be connected, DNS must not be modified and nothing may be deployed to production
without explicit approval.

## B. Review findings against the repository

1. **Endpoint path.** `astro.config.mjs` uses `trailingSlash: 'always'`, so the endpoint is `POST /api/lead/`.
2. **Reserved slugs.** With an empty base path, `src/pages/[...slug].astro` owns the root. `assertSlug()`
   (`src/config/site.ts`) will reject the reserved slugs (`api`, `gracias`, `404`), so a collision fails the build.
3. **Production root returns a real 404.** The preview index (today `src/pages/index.astro`) moves into
   `src/pages/[...slug].astro`, whose `getStaticPaths` emits the index (`slug: undefined`) only when
   `INCLUDE_DRAFTS` is true. Production builds contain no `/index.html`, so Vercel returns HTTP 404 (served by a
   minimal noindex `src/pages/404.astro`). No meta-refresh and no redirect.
4. **Submission ID.** It can't be embedded in the static HTML, or every visitor would share it. The browser generates it with
   `crypto.randomUUID()` when the form loads and reuses it on retries.
5. **JavaScript-only submission.** Turnstile requires JavaScript, so:
   - the form posts JSON with `fetch`;
   - the submit button is rendered disabled and JS enables it;
   - `<noscript>` shows the phone number from `organizacion.telefono`;
   - the endpoint accepts JSON only: no FormData/303 path.
6. **City field.** PR #1 added a required `ciudad` select fed by the provisional `ciudadesFormulario` list in
   `src/components/forms/formConfig.ts`. The server validates it against that list, and the table stores it in a `ciudad`
   column, separate from `localidad` (the landing's location).
7. **Production may be empty at first.** The only real landing (`aumento-pecho-aba`) is a `borrador`, so a
   production build (`PUBLIC_INCLUDE_DRAFTS=false`) publishes no landings until one is marked `aprobado`.
8. **Consent text.** The current wording (`organizacion.formulario.consentimiento`) bundles accepting the
   privacy policy with agreeing to be contacted, and has no link to the policy. `privacy_notice_version` will be a short hash
   of the text shown, so wording changes stay traceable.
9. **Trusted data only.** `landing_id` must belong to a landing accepted by `esPublicable()` and `resolveLanding()`
   (`src/lib/content.ts`), and `interes` must be one of that treatment's `interes_opciones`. Treatment and locality are
   resolved from repository content, never from client input. Implementation step 1 confirms that content collections load
   in an on-demand route; fallback: a small manifest generated at build time.

## C. Technical plan

Implementation branch: `feat/fase-2-leads`, created from the updated `main`. Small, reviewable steps.

### C1. Configuration and documentation
- `src/config/site.ts`:
  - `SITE_URL` from `PUBLIC_SITE_URL`;
  - `LANDINGS_BASE_PATH` defaults to `''`;
  - reserved-slug check.
- `astro.config.mjs`: `site` from the env var. All secrets are declared with Astro's `astro:env` as
  `context: 'server', access: 'secret'`, so the build fails if one is imported into client code.
- `.env.example`, `src/env.d.ts`, `README.md`.
- `CLAUDE.md` §1–3 and §7: ads-only landings on a subdomain, always `noindex`. The medical and editorial rules stay unchanged.

### C2. Astro on Vercel
- Add `@astrojs/vercel`. Keep `output: 'static'`; only the API routes declare `prerender = false`.
- `vercel.json`:
  - `regions: ["fra1"]`;
  - the hourly cron (C7);
  - an `X-Robots-Tag: noindex, nofollow` header **only on HTML routes**: paths ending in `/`, excluding `/api/` and `/_astro/`.
- Every HTML page already has `<meta name="robots" content="noindex, nofollow">`.
- `public/robots.txt` doesn't block crawling, so Google and AdsBot can still read the `noindex`.

### C3. Supabase — `supabase/migrations/0001_leads.sql`
One `leads` table:

```text
id                       uuid primary key
submission_id            uuid unique
created_at               timestamptz
landing_id, tratamiento, localidad   text
nombre, telefono         text
email                    text null
ciudad                   text
interes                  text null
privacy_notice_version   text
privacy_acknowledged_at  timestamptz
page_url                 text
utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid   text null
notification_status      text check in ('pending','sent','failed')
notification_attempts    integer
notification_claimed_at  timestamptz null
notified_at              timestamptz null
notification_error       text null
```

- Length `CHECK`s on the text fields.
- Index on `(notification_status, created_at)`.
- Row-level security enabled with **no policies**. All access is server-side with the secret key.
- Function `claim_retryable_notifications(max_rows int)` (see C7). `EXECUTE` is revoked from `anon` and `authenticated`.
- No raw IP addresses, user agents, health histories or other unnecessary identifiers.
- Client: `src/lib/leads/db.ts`, using plain `fetch` against Supabase's REST API. No SDK dependency.

### C4. Validation — `src/lib/leads/schema.ts`
- Zod rules:
  - trimmed values with maximum lengths;
  - lenient phone normalisation;
  - optional email;
  - `ciudad` must be in the list;
  - the privacy checkbox must be `true`.
- Replaces the `LeadPayload` interface in `formConfig.ts`.

### C5. Endpoint — `src/pages/api/lead.ts` + `src/lib/leads/handleLead.ts`
The business logic is a plain function that receives its dependencies (db, notifier, Turnstile check, landing lookup) as parameters, so it can be tested without module mocks.

1. JSON only; reject payloads over 8 KB.
2. Honeypot filled → fake success, nothing stored.
3. Turnstile verification; **fails closed in production**.
4. Zod validation → 400 with per-field errors.
5. Trusted landing lookup (B9).
6. INSERT with `notification_status='pending'`, `notification_claimed_at=now()`, `notification_attempts=1`.
   The request that inserts the lead owns its first send.
7. `submission_id` conflict → return success without sending again.
8. `notifyLead()`.
9. Set `sent` or `failed` and clear `notification_claimed_at`.

A database failure returns 503, **never success**. Logs carry the `submission_id` only, never personal data.

### C6. Resend — `src/lib/leads/notify.ts`: `notifyLead(lead)`
- A single `fetch` from `LEADS_EMAIL_FROM` to `LEADS_EMAIL_TO`, with the header `Idempotency-Key: lead/{submission_id}`.
- **Minimal content:** name, phone, email (if given), city, the selected treatment interest, landing name,
  date/time and `submission_id`.
- **Not included:** UTM parameters, click IDs or the page URL; they stay in the database only. The form has no free-text
  fields, and none will be added.
- Returns a clear `{ ok, error }` result.
- **Resend Free limits:** 3,000 emails a month and 100 a day, and **every recipient counts**. Recommendation: a single shared
  mailbox or alias as `LEADS_EMAIL_TO`.

### C7. Notification retries with an atomic claim — `src/pages/api/cron/notificaciones.ts`
- Hourly Vercel Cron, authenticated with `Authorization: Bearer ${CRON_SECRET}`.
- Calls `claim_retryable_notifications(20)`, which runs a single statement:

  ```sql
  UPDATE leads
     SET notification_claimed_at = now(),
         notification_attempts   = notification_attempts + 1
   WHERE id IN (
     SELECT id FROM leads
      WHERE notification_status IN ('pending','failed')
        AND notification_attempts < 5
        AND (notification_claimed_at IS NULL
             OR notification_claimed_at < now() - interval '15 minutes')
      ORDER BY created_at
      LIMIT max_rows
      FOR UPDATE SKIP LOCKED)
  RETURNING *;
  ```

- Only the caller that gets a row back sends that notification, so concurrent runs never claim the same lead. A claim older
  than 15 minutes (for example, a crashed function) becomes retryable again.
- Resend's idempotency key suppresses a duplicate send within 24 hours, covering the gap between "sent" and "status saved".
- **Delivery guarantee:** at-least-once. A duplicate email is only possible if the status update keeps failing for
  more than 24 hours; exactly-once delivery would need additional infrastructure, which is out of scope.
- Leads that reach 5 attempts stay `failed` for manual follow-up.
- Side effect: the hourly database read keeps the Supabase Free project from pausing after 7 days of inactivity.

### C8. Form — `LeadForm.astro` and `formConfig.ts`
- The visual design and component API stay the same. The form is operational only when `PUBLIC_LEADS_ENABLED=true`;
  otherwise the current "no operativo" behaviour stays.
- Hidden fields:
  - `submission_id` and `landing_id`;
  - `page_url`, UTM parameters, `gclid` and `fbclid`;
  - honeypot;
  - Turnstile token.
- Turnstile loads lazily on the first focus in the form, to protect Core Web Vitals.
- While sending: the button is disabled with `aria-busy`.
- Errors: field-level messages (`aria-invalid` and `aria-describedby`) and a summary in an `aria-live` region.
- Network errors keep the same `submission_id` on retry.
- After a confirmed save, the page navigates to `/gracias/`.

### C9. Thank-you page — `/gracias/`
- `noindex`, with no personal data or identifiers in the URL.
- It's reached only after a confirmed save, but a direct visit is always possible, so **visiting it is not proof of
  conversion**. The source of truth is the `leads` table.
- No client-side marker is added in this phase. Future tracking (out of scope) should rely on confirmed server-side records,
  such as the `submission_id`.

### C10. Tests (Vitest)
- **Unit:**
  - valid and invalid payloads, required fields;
  - honeypot;
  - Turnstile handling;
  - unknown landing;
  - duplicate `submission_id`;
  - database success and failure;
  - email success and failure;
  - claim/cron logic;
  - API responses.
- **Integration** (skipped when the env vars are missing), against the **dev** Supabase project and Resend's test
  address:
  - exactly one row per submission;
  - no duplicates;
  - a failed email leaves the lead `failed`, then the cron recovers it;
  - two concurrent claims → only one of them gets the row.
- **`scripts/check-dist.mjs`** (after the build):
  - every generated HTML page has the robots meta tag;
  - production mode: no drafts, fixtures or index page;
  - the **actual values** of the secret env vars (read from the environment, ignoring empty ones) appear nowhere in the public
    static output (`.vercel/output/static`). No broad pattern matching.

### C11. Deployment documentation — `docs/despliegue.md`
- **Vercel:**
  - GitHub connection;
  - Production and Preview environment variables;
  - deployment protection on previews;
  - Turnstile test keys in Preview;
  - the WAF rate-limit rule on `/api/lead/`;
  - `fra1`.
- **DNS at IONOS:** the `tratamiento` CNAME, plus Resend's SPF, DKIM and DMARC records for the sending domain.
- **Supabase:** setup, key rotation, and backups (section D).
- **Post-deploy checklist:** `curl -I` on `/` (expect 404), a landing, `/api/lead/` and an `/_astro/` asset to confirm the
  status codes and headers; a real test lead; a simulated notification failure; keyboard and mobile checks.

### Environment variables

```env
# Public
PUBLIC_SITE_URL=https://tratamiento.institutorubi.com
PUBLIC_LEADS_ENABLED=false
PUBLIC_TURNSTILE_SITE_KEY=
PUBLIC_INCLUDE_DRAFTS=false
PUBLIC_INCLUDE_FIXTURES=false

# Server-only secrets (astro:env)
SUPABASE_URL=
SUPABASE_SECRET_KEY=
RESEND_API_KEY=
LEADS_EMAIL_FROM=
LEADS_EMAIL_TO=
TURNSTILE_SECRET_KEY=
CRON_SECRET=
```

The current Supabase secret-key format (`sb_secret_…`) is preferred; if the project uses a legacy service-role key, the docs
will say so without exposing it. Secrets live only in `.env.local` (git-ignored) and in Vercel.

## D. Backups and recovery (Supabase Free)

Supabase Free includes no automatic backups and no SLA.

- **Procedure** (manual, weekly, and before any migration):
  1. Export the `leads` table (`supabase db dump --data-only -t public.leads`, or the dashboard's CSV export).
  2. Encrypt it immediately with `age` (or GPG) using the client's public key. The unencrypted file is never stored.
  3. Store it in the client's access-controlled storage, with MFA.
  4. Keep backups only as long as the approved retention period; delete older ones.
- **Restore:**
  1. Decrypt.
  2. Restore into the dev project first to verify it.
  3. Then restore into production.
  4. The unique `submission_id` prevents duplicates when merging into existing data.
- **Accepted risk:** leads created since the last backup can be lost if Supabase loses data. The notification inbox keeps a copy
  of each lead's contact details, which partly reduces that risk.
- No backup automation in this phase.

## E. Pending decisions before production

1. **Legal:**
   - privacy policy URL;
   - final checkbox wording (privacy acknowledgment is not consent to marketing);
   - legal basis and retention period;
   - processor agreements (DPAs) with Supabase, Resend, Vercel and Cloudflare.
2. **Resend:** recipient address (one shared mailbox recommended), sending domain and from-address, and the DNS records at
   IONOS.
3. **Supabase:** confirm the production project is in an EU region, create the dev project, and put the keys in `.env.local`
   (never in chat or Git).
4. **Cloudflare:** an account for Turnstile and the production site key for `tratamiento.institutorubi.com`.
5. **Final city list** for the form (currently provisional in `formConfig.ts`).
6. **At least one landing approved** (`estado: "aprobado"`) before production goes live.

## Acceptance criteria

- All landing forms submit successfully, and every valid lead is stored exactly once.
- Resend sends the expected notification, and email failures never cause lead loss.
- Form errors are handled accessibly.
- Supabase is not publicly readable or writable.
- The site builds for Vercel, landing pages stay statically generated, and the designs are unchanged.
- Automated tests pass, deployment instructions are complete, and no unnecessary infrastructure or abstractions are introduced.

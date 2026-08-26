# Handover

This document covers two things: **onboarding a second (or third, or Nth) mosque**
onto an already-running deployment, and an honest list of **what's out of scope** in
this build so whoever picks it up next knows where the edges are.

## Architecture recap (why onboarding looks the way it does)

Every tenant-owned record — circles, students, attendance, grades, questions, tasks,
points ledger entries, users — carries an `organizationId` and is scoped to it at the
query layer (`assertOrgScope`, `apps/api/src/middleware/auth.ts` and friends). This is
**shared-database multi-tenancy**: all mosques live in the same MongoDB database, not
one database per mosque. Onboarding a new mosque therefore means inserting one new
`Organization` document plus its first `admin` `User` — nothing at the infrastructure
level changes.

## Onboarding a new mosque

There is deliberately no API route to create an organization or its first admin: every
existing admin-creation route (`POST /api/v1/users`) requires an authenticated admin,
which a brand-new tenant doesn't have yet. That bootstrap step is a script,
`apps/api/src/scripts/createOrg.ts` — unlike `seed.ts`, it never wipes anything, so
it's safe to run against a database that already has other tenants in it.

1. Make sure you have the production `MONGODB_URI` (and the deployed API's other env
   vars — see `apps/api/.env.example`) available in your shell or a local `.env`.
2. Run, filling in real values:

   ```bash
   ORG_NAME="جامع النور" \
   ORG_NAME_EN="Jami' Al-Noor" \
   ORG_SLUG="jami-al-noor" \
   ORG_TIMEZONE="Asia/Riyadh" \
   ADMIN_NAME="Admin's Name" \
   ADMIN_EMAIL="admin@example.com" \
   ADMIN_PASSWORD="a-strong-temporary-password" \
   pnpm create-org
   ```

   `ORG_SLUG` must be unique across the whole deployment (the script checks and
   refuses to overwrite an existing org). `ORG_NAME_EN` and `ORG_TAGLINE` are
   optional. The script prints the new organization's ID and admin user ID on
   success — keep those for your own records, but nothing further needs them; the
   admin logs in with email/password from here on.

3. Hand the admin their email + temporary password and have them log in at the
   deployed web app's `/login`. From inside the app they can (all self-service, no
   more script access needed):
   - **Settings** — upload/set the org's logo, tagline, and theme colors (the design
     system derives the full palette from three base colors via CSS `color-mix()` —
     see `apps/web/src/theme/ThemeProvider.tsx`), set the org's timezone and
     session-start/late-cutoff defaults, toggle whether students need a PIN.
   - **Settings > Supervisors** — add supervisor accounts (`POST /api/v1/users`,
     admin-only).
   - **Circles** — create circles, assign supervisors, add students (which mints
     each student's private QR/link via `nanoid` — see `Student.accessSlug`).
4. That's it — everything else (attendance, grades, weekly questions/tasks, points,
   reports) works identically for every tenant from here, because it was built
   multi-tenant from the start rather than retrofitted.

**Scaling note**: shared-database multi-tenancy is the right call while the tenant
count is small (a handful to a few dozen mosques). If this ever needs to scale to
hundreds of large, high-traffic organizations with strict data-isolation or
per-tenant-backup requirements, database-per-tenant (or a sharding strategy keyed on
`organizationId`) would be the next architectural step — not needed today, worth
knowing about before it becomes urgent.

## Known limitations / what's out of scope

Documented here rather than silently left for someone to discover — see
[DECISIONS.md](./DECISIONS.md) for the full per-phase reasoning behind each of these.

- **No committed frontend test suite.** `apps/api` has 42 passing Vitest/Supertest
  tests covering the points engine, auth, and org-scoping; `apps/web` was instead
  verified manually (and via ad hoc Playwright scripts) against a live seeded backend
  during development, screen by screen, but none of that was committed as a
  repeatable Vitest + React Testing Library suite. This is the single biggest gap
  against SPEC.md's stated tech bar. Priority order if picking this up: the points
  display components (they render server-computed numbers — easy to silently get
  wrong), the auth/ProtectedRoute redirect logic, and the ScanBarcode/WeeklyQuestion
  screens that already had real bugs caught by manual testing (see DECISIONS.md
  Phases 9-10) — regression tests there would have the highest value.
- **Lighthouse performance score: 82/100 on `/login`** (target in SPEC.md was ≥90;
  accessibility is 98/100). Route-level code splitting and vendor chunk splitting
  were both applied and measured (DECISIONS.md Phase 11); the remaining gap is
  inherent to a client-side-rendered React SPA with no server-side
  rendering/prerendering under Lighthouse's throttled mobile simulation, not a bug.
  Closing it fully would mean adopting SSR (e.g. migrating to a framework with an SSR
  mode) or shipping meaningfully less JS by replacing `recharts` and/or
  `html5-qrcode` with lighter alternatives — both real architectural changes, not
  polish.
- **File uploads (Multer) were deferred**, per the original spec's own phrasing.
  `logoUrl`/`avatarUrl`/`photoUrl` fields all exist and render correctly wherever a
  URL is present, but there's no upload endpoint yet — today those fields must be set
  to an already-hosted image URL (e.g. via Settings' logo-URL field, or a seed-time
  placeholder). Adding real upload support means picking object storage (S3-compatible
  is the natural fit given Multer's disk/S3 storage engines) and is a self-contained
  follow-up.
- **No automated CI pipeline** (GitHub Actions or equivalent) was set up — `pnpm -r
build`, `pnpm -r lint`, and `pnpm test` are all fast and deterministic enough to
  wire into one directly; this is a small, high-value next step.
- **No email/SMS notifications** (e.g. for approvals, weekly summaries) — not in
  SPEC.md's scope, noting it here only because it's a common ask once a mosque is
  actually using this day to day.

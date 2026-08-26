# Decisions log

Non-obvious choices made while building Halaqat Jami' Al-Siddiq, in chronological order.

## Phase 1 — Scaffold

- **Package manager: pnpm workspaces, no Turborepo/Nx.** The spec's repo layout is a
  plain 3-package workspace (`apps/api`, `apps/web`, `packages/shared`). That's small
  enough that a build-orchestration tool would be pure overhead — `pnpm -r` covers it.
- **`packages/shared` ships TypeScript source directly (no build step).** Both
  `apps/api` (run via `tsx`) and `apps/web` (bundled by Vite) can consume `.ts` files
  straight out of a workspace dependency. Adding a `tsc` build + `dist/` for the shared
  package would only add a watch/rebuild step with no benefit at this scale.
- **API module system: `NodeNext` + explicit `.js` extensions in relative imports.**
  Node 20 ESM requires the specifier to match what's on disk after compilation, so
  `import { env } from "@/config/env.js"` is correct even though the source file is
  `env.ts`. `tsx` handles this transparently in dev; `tsc` mirrors it in `dist/` for
  `node dist/index.js`.
- **Logging: pino + pino-http (API only).** Not in the spec's tech table, but the spec
  requires structured error handling and the "never show a raw error string" rule
  implies server-side logging discipline. pino is the standard low-overhead choice for
  an Express/TS API and pairs with `pino-pretty` in dev.
- **i18n language persistence key: `halaqat_language` in `localStorage`.** Chosen so it
  doesn't collide with any other app on the same origin during local dev.
- **Numerals: Western Arabic numerals (0–9) everywhere, per spec §2.2**, including in
  the `ar` locale — deliberate, for unambiguous points/grades at a glance.
- **Default org theme lives in `src/styles/theme.css` as the fallback**; an
  organization's DB-stored `theme` overrides are injected as inline custom properties
  on `:root` at runtime by a `ThemeProvider` (built in Phase 8), never by editing this
  file per-tenant.
- **ESLint: classic `.eslintrc.cjs` (not flat config).** ESLint 8 is what's compatible
  with the pinned `@typescript-eslint` v7 line at time of writing; flat config on
  ESLint 8 is still experimental. Revisit on an ESLint 9 upgrade.

## Phase 2 — Data layer

- **User uniqueness uses partial indexes, not `sparse: true`.** A compound index
  `{ organizationId, phone }` with `sparse: true` still indexes a document that's
  missing only `phone`, because MongoDB's sparse-index rule for a compound key is "at
  least one of the fields exists" — and `organizationId` always exists. Two supervisors
  with no phone number collided on `phone: null` during the seed smoke test. Fixed by
  switching both the `email` and `phone` indexes on `User` to
  `partialFilterExpression: { <field>: { $type: "string" } }`, which only indexes
  documents where that specific field is actually present.
- **`Organization` does not use the `orgScopedPlugin`.** Every other model gets
  `organizationId` + `deletedAt` + timestamps from the shared plugin
  (`apps/api/src/models/plugins/orgScoped.ts`); `Organization` is the tenant root and
  defines its own `deletedAt`/timestamps directly.
- **Seed script (Phase 2) creates only the org/admin/supervisors/circles/students.**
  Six weeks of attendance/grades/questions/tasks history is deferred to Phase 3, once
  `points.service.ts` exists — generating that history by hand now would mean writing
  ledger-writing logic twice (once ad hoc in the seed script, once for real in the
  points engine). `seed.ts` logs a reminder to re-run after Phase 3 lands.
- **Seed script wipes the whole database, guarded against `NODE_ENV=production`.** It
  refuses to run in production unless `SEED_FORCE=true` is set explicitly — this script
  is a dev/demo convenience, not a migration.
- **Student PIN and staff password hashing both use bcrypt cost 12** (SPEC.md §3),
  implemented as sibling `hash*`/`compare*` helpers on the `Student` and `User` models
  rather than a single shared helper, since they hash conceptually different secrets
  (a 4-digit PIN vs. a full password) even though the mechanism is identical.
- **`Student.barcodeValue` is set equal to `accessSlug`** via a `pre("validate")` hook
  rather than removed as a duplicate field — SPEC.md §4 lists them as two distinct
  fields (the private-link slug vs. the printable QR/barcode payload), so keeping both
  preserves the option to diverge later (e.g. a physical card format) without a schema
  migration, even though today they're always identical.
- **Seed student avatars use `api.dicebear.com` placeholder URLs** (generated
  deterministically from each name) rather than binary photo fixtures — the field only
  needs to hold a valid URL for every screen to render correctly; no image bytes are
  fetched at seed time.
- **`CreateUserInput` requires email OR phone, not email specifically**, via a Zod
  `.refine()`, even though SPEC.md §4's field comment says email is "required for
  admin/supervisor." Treated as non-binding inline commentary rather than a hard rule,
  since the model itself marks `email` optional — revisit if that's wrong.

## Phase 3 — Points engine

- **`recomputeStudentPoints` sums every ledger row for the student, full stop** — it
  does not exclude reversed entries. A reversal is itself a normal signed row (e.g.
  `-10` to cancel a `+10`), so summing everything already nets out correctly; the
  `reversedAt` flag on the original row exists purely for audit/UI (e.g. strikethrough
  in the points-history screen), not to be filtered out of the sum. Filtering it out
  would double-count the correction.
- **Timezone math avoids `date-fns-tz`'s `toZonedTime` + plain `date-fns` functions.**
  That combination (e.g. `toZonedTime(x, tz)` then `startOfDay(...)`) only produces
  correct results if the Node process itself runs with `TZ=UTC`, because plain
  date-fns reads a Date's _local_ getters. Instead, `apps/api/src/utils/timezone.ts`
  extracts wall-clock Y-M-D via `Intl.DateTimeFormat` (timezone-aware regardless of
  process TZ) and converts back to a UTC instant via `fromZonedTime` (also
  TZ-independent) — no assumption about the server's own timezone setting anywhere.
- **Grade → points conversion formula (SPEC.md §4 doesn't specify one):**
  `gradeToPointsMode: "manual"` — the caller supplies `points` explicitly, decoupled
  from the 0–100 `grade` value (defaults to 0 if omitted). `"percentage"` — points
  equal the grade itself, rounded (a 100% grade earns 100 points). Implemented in
  `grade.service.ts`'s `resolveGradePoints`.
- **`question.service.answerQuestion` now verifies the student's `circleId` matches
  the question's `circleId`** (mirroring the same guard `attendance.service` already
  had for scans) — found while wiring seed data: nothing in the original service
  stopped a student from a different circle answering another circle's question.
- **Attendance/manual-attendance create-only; edits go through a separate
  `updateAttendanceRecord`.** `scanAttendance` and `recordManualAttendance` both throw/
  return-idempotently on an existing record for that student+day rather than silently
  overwriting it — SPEC.md's API surface lists `POST /attendance/manual` (create) and
  `PATCH /attendance/:id` (edit, triggers reversal) as separate routes, so the service
  layer mirrors that split.
- **`approveSubmission` throws `ConflictError` if already approved**, rather than being
  a silent idempotent no-op — callers that want to change an approved submission go
  through `rejectSubmission` first, then re-approve. Keeps the state machine explicit.
- **Vitest + `mongodb-memory-server`'s `MongoMemoryReplSet` (1-node) for API tests** —
  required because the points engine tests exercise real multi-document transactions,
  which a standalone in-memory mongod can't do. `apps/api/vitest.config.ts` sets
  `fileParallelism: false` since each test file starts its own replica set.
- **Seed script's history data (6 weeks of attendance/grades, 4 questions with
  answers, 3 tasks with submissions in every lifecycle state) is generated by calling
  the real, tested domain services** (`attendance.service`, `grade.service`,
  `question.service`, `task.service`) rather than inserting documents directly — the
  seed data is therefore guaranteed to be ledger-consistent (`Student.totalPoints`
  always matches `recomputeStudentPoints`), and running it against a real replica set
  took ~15s for the full org (30 students × 6 weeks + 4 questions + 3 tasks).

## Phase 4 — Auth

- **Routers are factory functions (`createAuthRouter()`, `createStudentAccessRouter()`),
  not module-level singletons**, specifically so each `express-rate-limit` instance
  lives inside the router closure and gets recreated fresh every time `createApp()`
  runs. A module-level `const limiter = rateLimit(...)` would be a singleton shared by
  every `createApp()` call in the process — harmless in production (one instance ever),
  but it broke test isolation: two different Supertest `app` instances were secretly
  sharing one rate-limit counter, so an earlier test's requests silently ate into a
  later test's budget. Found this via a failing rate-limit test before it could become
  a source of flaky CI.
- **Refresh tokens are stateless JWTs with no DB-tracked revocation list.** Logout
  clears the cookie client-side; there's no server-side "kill all sessions for this
  user" yet. Acceptable for now since nothing in SPEC.md §3/§6 asks for it, but if a
  "force logout everywhere" admin action is ever needed, it requires either a
  `tokenVersion` counter on `User` (bump it, and reject refresh tokens issued before
  the bump) or a persisted denylist — flagging so it's not assumed to already exist.
- **`assertOrgScope` throws 404, not 403, on a cross-tenant resource.** A 403 confirms
  "this exists, you can't have it" — for a resource in a different mosque's data, even
  that confirmation is a leak. 404 ("not found") is indistinguishable from the
  resource genuinely not existing.
- **Staff login tries every user matching the identifier across all orgs, not just
  one.** `email`/`phone` are unique per-organization (`User`'s indexes), not globally,
  and there's no subdomain-based tenant resolution yet (`Organization.slug` is
  reserved for that per its SPEC.md comment) — so `POST /auth/login` can't know which
  org to scope to ahead of time. It fetches every candidate with a matching
  email-or-phone and bcrypt-compares the password against each, returning the first
  match. Fine for early rollout (typically one tenant's data per environment); revisit
  once multi-tenant subdomain routing exists.
- **Student PIN flow: if `org.requireStudentPin` is on but a given student has no
  `pin` set, the link mints a session directly** rather than blocking them out or
  demanding they set one on the spot — SPEC.md §3 doesn't cover this edge case, and
  refusing access because an admin forgot to set a PIN would be a worse failure mode
  than skipping a check that was never configured for that student.
- **`express-async-errors`** (a single side-effecting import in `app.ts`) patches
  Express to forward rejected promises from `async` route handlers to the error
  middleware automatically — chosen over hand-writing `try/catch` or an `asyncHandler`
  wrapper in every route, since with ~20+ routes coming in Phases 5/6 that
  boilerplate would dominate the route files. `errorHandler.ts` then centralizes every
  domain-error → HTTP-status mapping in one place instead of scattering it per route.
- **Login/refresh share one rate-limit budget (20/min); slug-lookup/verify-pin share
  another (10/min)**, rather than each route having its own — both pairs are really
  "prove you hold this credential" attempts against the same target, so splitting the
  budget per-route would let an attacker get 2x the effective throughput by
  alternating routes.

## Phase 5 — Core API (organizations, circles, students, QR)

- **Added a `/users` route group for staff (admin/supervisor) management, even
  though SPEC.md §6's explicit route list doesn't enumerate it.** The Settings
  screen (§7, "supervisor management") and the seed script both need a way to
  create/list/update staff accounts, and there's no other route for it. An admin can
  only assign the `admin`/`supervisor` roles (never `super_admin`); a `super_admin`
  can assign any role.
- **`students.routes.ts` defines its own full paths** (`/circles/:id/students`,
  `/students`, `/students/:id`, ...) and is mounted at the bare `/api/v1` prefix,
  rather than being namespaced under one `app.use("/api/v1/students", ...)` —
  SPEC.md §6 nests student _listing_ under `/circles/:id/students` but every other
  student route directly under `/students`, so one flat router mirrors that instead
  of forcing an artificial prefix split.
- **A supervisor gets 404, not 403, on a circle/student they don't own** — same
  reasoning as `assertOrgScope` in Phase 4: confirming "this circle exists, it's just
  not yours" is itself information a supervisor from an unrelated circle shouldn't get
  by guessing ids.
- **Circle deletion (soft) is refused (409) while it has active students**, per
  SPEC.md §6's `DELETE /circles/:id` comment — the caller must reassign or deactivate
  students first; the API doesn't cascade-deactivate them automatically, since that's
  a destructive side effect a human should decide on explicitly.
- **QR codes are generated on demand** (`GET /students/:id/qr.png`, PNG via the
  `qrcode` package, 512px, encoding `barcodeValue`) rather than pre-rendered and
  stored — it's cheap to generate and this way a slug regeneration never leaves a
  stale cached image behind.

_(Further entries appended as later phases land.)_

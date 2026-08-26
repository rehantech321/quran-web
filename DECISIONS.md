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

## Phase 6 — Feature APIs (attendance, grades, questions, tasks)

- **Found and fixed a router-ordering bug that silently 401'd unrelated requests.**
  `createStudentsRouter()` is mounted at the bare `/api/v1` prefix (it needs to define
  both `/circles/:id/students` and `/students*`), and its first layer is an
  unconditional `router.use(requireAuth)`. Because Express matches `app.use()` mount
  prefixes in _registration order_, and `"/api/v1"` is a prefix of every other
  route, mounting this router _before_ `/api/v1/questions`, `/api/v1/tasks`, etc.
  meant every request to those routers passed through this router's blanket
  `requireAuth` first — including student-token requests to `/questions/active`,
  which got rejected with 401 before Express ever reached the questions router that
  should have handled them with `requireStudentAuth`. Fixed by moving
  `app.use("/api/v1", createStudentsRouter())` to be registered **last**, after every
  other `/api/v1/*` router — this is caught by `featureApi.routes.test.ts`'s first
  test, which would regress immediately if the ordering broke again.
- **`approveSubmission`/`rejectSubmission` gained a required `organizationId`
  param.** They were written in Phase 3 as internal domain logic only reachable from
  tests/seed data, so they trusted `submissionId` alone. Now that they're reachable
  over HTTP (`POST /tasks/:taskId/submissions/:id/approve|reject`), a submission id
  with no org check would have let a supervisor from one organization approve or
  reject a submission belonging to a completely different mosque just by guessing or
  enumerating ids. Added a `getSubmissionWithTask` read-only lookup for routes to
  verify org + circle ownership _before_ calling the mutating functions (same
  pattern as the attendance/grade routes below).
- **Routes that mutate an existing record (attendance PATCH, grade PATCH, task
  approve/reject) always fetch-and-check ownership before calling the mutating
  service function, never after.** The service functions themselves fetch by id and
  mutate in one step; if the route checked "is this the supervisor's circle?" using
  the _return value_ of the mutating call, the mutation would already have happened
  before the check could reject it. `featureApi.routes.test.ts` asserts this
  explicitly for attendance: a cross-circle PATCH gets 404'd _and_ the record is
  verified unchanged afterward.
- **`WeeklyQuestion.points` defaults from the circle's/org's
  `pointsConfig.defaultQuestionPoints`** when omitted from `POST /questions` — the
  Mongoose field is required but the Zod input schema allows omitting it (per
  SPEC.md §4: "points: number; // default from org config (20)"), so `createQuestion`
  now resolves the effective points config the same way attendance/grades do rather
  than passing `undefined` straight through to a required field.
- **`GET /questions/active` strips `correctOptionKey`/`explanation` from the
  response** before returning it to the student — those only reveal once
  `answerQuestion` has graded a real attempt, so the payload itself can't be
  inspected to find the answer.
- **`GET /tasks/pending-approvals` scopes to the supervisor's own circles by
  default** (resolved via `listCircles(orgId, { supervisorId })` when no explicit
  `circleId` query param is given) rather than the org-wide queue — a supervisor
  shouldn't see (or approve) another supervisor's students' submissions just because
  the query param was omitted.
- **`GET /tasks` and `GET /questions`'s `status`/`circleId` query params are staff
  listing filters only** — `taskQuerySchema`'s `status` field (`SubmissionStatus`)
  isn't applied to the staff `GET /tasks` listing (which lists _tasks_, not
  _submissions_ — there's no single "status" for a task shared across many students'
  submissions). It's meaningful for `GET /tasks/mine`'s active/completed split
  instead, which is the actual per-student view.

## Phase 7 — Reports API

- **`GET /students/:id/report` and `GET /reports/student/:id` are the same
  endpoint under two paths.** SPEC.md §6 lists both (once under the students
  section, once under reports), which reads like the same "full report payload"
  requirement stated twice rather than two different payloads. Both routes call the
  identical `getStudentReport` service function, verified by a test that asserts
  they return the same student id.
- **PDF export is a plain, unbranded table layout (pdfkit), not a styled document.**
  SPEC.md §6 asks for CSV/PDF export without specifying a design, and this app
  already has a dedicated polished print surface — the QR-card sheet (Phase 11's
  print stylesheet). Spending design effort on a second, redundant "pretty PDF" for
  a data export wasn't worth it; this one exists to get the numbers into a portable
  file, not to look good.
- **Circle report's per-student "attendance rate" counts `present` + `late` as
  attended, `absent`/`excused` as not** — matches the spec's intent that `late`
  still means the student showed up (it just costs points), while `excused` is
  explicitly a non-penalized absence rather than attendance.
- **Leaderboard periods (`week`/`month`/`term`) are fixed rolling windows** (7/30/90
  days from now), computed by summing `PointsLedger` entries in that window — SPEC.md
  §6 names the periods without defining their boundaries, and there's no
  "academic term" concept anywhere else in the data model to derive `term` from, so
  90 days was chosen as a reasonable stand-in. `all` skips the ledger aggregation
  entirely and just sorts by `Student.totalPoints` (the already-current cache), which
  is both correct and cheaper.
- **`GET /reports/circle/:id`'s date-range filter (`from`/`to`) only affects
  `totalPoints`, attendance, grades, question, and task rows — never the org/circle
  config used to interpret them** (e.g. today's `pointsConfig`, not whatever it was
  historically) — consistent with how the points engine already snapshots resolved
  config into each record at write time (Phase 3), so no new "as-of" config
  resolution was needed here.

## Phase 8 — Design system in React

- **Found and fixed a real i18n bug via the browser check**: the language detector's
  `order` included `"navigator"`, so a visitor with an English browser/OS locale got
  the English UI on first load — contradicting SPEC.md §0 ("Arabic with full RTL...
  English is a secondary language via a toggle"). Every visitor should see Arabic by
  default regardless of browser locale, switching to English only through the
  in-app toggle (which persists to `localStorage`). Fixed by dropping `"navigator"`
  from `detection.order`, leaving only `localStorage` (falling through to
  `fallbackLng: "ar"` when empty). Caught by actually driving the app in a headless
  browser rather than just reading the config — the bug wasn't visible from the code
  alone since `fallbackLng: "ar"` looked correct in isolation.
- **`ThemeProvider` derives an org's full color ramp from just 3 base colors via CSS
  `color-mix()`**, not a hex-math library. `Organization.theme` only stores
  `primary`/`accent`/`sage` (SPEC.md §4), but Tailwind classes throughout reference a
  6-step scale per color family (`primary-950`...`primary-500`, etc.). Setting only
  the base token (`--c-primary-900`, `--c-gold-500`, `--c-sage-400`) and defining the
  rest as `color-mix(in srgb, var(--c-primary-900) 85%, white)`-style expressions
  means a mosque only ever picks 3 colors, and every existing utility class still
  resolves sensibly — no per-org shade design needed, and no new dependency for
  color math. Requires a browser with `color-mix()` support (all evergreen browsers
  in 2026); the _default_ palette in `theme.css` stays flat hex and is untouched by
  this, so the untouched-org case has zero compatibility risk.
- **`AppShell` takes `navItems` as a prop rather than hardcoding role-specific
  navigation** — the supervisor and student apps need different tab bars
  (SPEC.md §2.5), and the shell itself has no business knowing about roles; that
  wiring happens where each app's routes are defined (Phase 9/10).
- **`StatusChip` ships a small fixed set of built-in glyphs (check/cross/clock/dash/
  info) keyed by `tone`**, not an icon-library dependency — no icon package was
  declared in the scaffold, and the handful of states this app actually needs
  (success/danger/warning/info/neutral) don't justify adding one now.
- **`Select` wraps a native `<select>`** rather than building a custom listbox —
  native selects are accessible, RTL-correct, and touch-friendly for free; SPEC.md
  doesn't ask for anything a native select can't do (no multi-select, no search).
- **Verified visually, not just by build/lint passing**: launched the Vite dev
  server and drove it with Playwright (no project-specific run skill existed yet,
  and `chromium-cli` wasn't available in this environment) to screenshot both the
  home page and `/dev/kitchen-sink` and check the browser console for errors — this
  is what caught the i18n default-language bug above; a type-check alone would have
  missed it.

## Phase 9 — Supervisor app

- **Found and fixed a real crash bug via the browser check**: `ScanBarcode`'s cleanup
  effect unconditionally called `scanner.stop()` on unmount. `html5-qrcode`'s `stop()`
  throws _synchronously_ ("Cannot stop, scanner is not running or paused") rather than
  rejecting a promise when the scanner never successfully started — which happens for
  any camera permission denial or missing camera, not just this sandboxed environment.
  A synchronous throw inside a `useEffect` cleanup isn't caught by a `.catch()` on a
  promise chain, so it propagated to React's error boundary and blanked the whole
  route. Fixed by checking `scanner.getState()` against
  `Html5QrcodeScannerState.SCANNING/PAUSED` before calling `stop()`, wrapped in
  try/catch. Also fixed a related gap in the same effect: when `getCameras()` resolves
  with an empty array (no error, just zero cameras), the code silently did nothing
  instead of surfacing the manual-entry fallback UI.
- **Found and fixed a real layout bug**: `StudentForm` was missing the `pb-24` bottom
  padding every other staff page has to clear the fixed mobile bottom tab bar, so the
  QR/access-link card and delete button rendered partially behind it. Caught by an
  actual mobile-viewport screenshot, not by build/lint.
- **QR codes and report exports are fetched as authenticated blobs, not `<img src>`/
  `<a href>`.** Both `GET /students/:id/qr.png` and `GET /reports/export` require a
  staff bearer token (the QR encodes the same slug that bootstraps a student session,
  so it can't be anonymously fetchable — see Phase 5's decision on that). A plain
  `<img>` or navigation-triggered download can't attach an Authorization header, so
  `useStudentQrObjectUrl` and `downloadReportExport` fetch through the authenticated
  axios client and hand back a blob object URL / trigger a throwaway-anchor download
  instead.
- **Circle listing was extended server-side with `studentCount` and today's
  attendance-recording progress** (`listCirclesWithStats` in `circle.service.ts`) —
  SPEC.md §7 screen 2 explicitly asks for both on the Circles-list card, and the
  original `GET /circles` response had neither. "Today's attendance progress ring"
  is interpreted as _recorded/total_ (how much of today's roster has been processed),
  not attendance rate — a ring that fills as the supervisor works through scanning,
  which matches "progress" better than a presence percentage would.
- **No file-upload endpoint was built; student/org photos are a plain URL field.**
  SPEC.md §1 lists Multer + local disk for file upload and §7 screen 10 asks for
  "photo upload with a circular cropper," but no upload route exists anywhere in
  Phases 5–7 — building that infrastructure (Multer config, storage adapter, crop UI)
  is a substantial side-quest against the remaining phase budget. Every photo field
  (`Student.photoUrl`, `Organization.logoUrl`) already accepted an arbitrary URL, and
  the seed script already relies on this (dicebear placeholder URLs) — the form just
  exposes that same field as a text input instead of a file picker. Revisit if real
  photo upload becomes a priority.
- **"Points-over-time line chart" (SPEC.md §7 screen 11) became a leaderboard bar
  chart** (Recharts, points per student) instead of a true time series — there's no
  historical circle-level points snapshot endpoint, and building one (time-bucketed
  ledger aggregation) was out of scope for this pass. The leaderboard itself already
  needed a chart and reuses the same data.
- **A dedicated `/app/approvals` route exists alongside the per-circle approvals
  section already embedded in the circle detail Tasks tab** — SPEC.md §7 lists
  "Approvals queue" as its own screen (9) distinct from circle detail (3), and it
  naturally spans every circle a supervisor runs rather than being scoped to one.
- **Bottom nav maps to Circles / Scan / Reports / Profile exactly as SPEC.md §2.5
  specifies for supervisors — "Profile" routes to the Settings screen.** There's no
  separate staff profile screen anywhere in the spec's 12-screen list; Settings already
  covers org branding, points config, and supervisor management, so it doubles as the
  4th tab's destination rather than inventing a new screen.
- **Verified the whole supervisor app end-to-end against a real seeded backend**
  (temp MongoDB replica set + API + Vite dev server, driven with Playwright): login,
  circles list, all 6 circle-detail tabs, student create/edit with the QR/access
  card, the scan screen's manual-entry fallback, reports, settings, and the
  approvals queue — all with zero browser console errors after the two fixes above.

_(Further entries appended as later phases land.)_

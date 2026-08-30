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

## Phase 10 — Student app

- **Found and fixed a real bug via the browser check**: `WeeklyQuestion` checked
  `if (!question) return <no-active-question>` _before_ checking whether a `result`
  was available to show. Answering a question invalidates the active-question query
  (correctly — the student has now answered it), which refetches and resolves to
  `null`; that null hit the `!question` branch first and silently replaced the
  correct/incorrect result card with "no question available" before the student ever
  saw whether they got it right. Fixed by checking `result` first, independent of
  `question`'s current (post-answer) value — verified by actually answering a
  freshly-created question in a live browser and confirming the green-checkmark
  result card renders and stays visible.
- **Added `GET /students/me` and `GET /students/me/points-history`** (student-scoped,
  same registration-before-the-staff-gate pattern as Phase 6's questions/tasks
  routers) — the student-access resolve/verify-pin responses only ever carried
  `circleId`, not the circle's name or supervisor, but SPEC.md §7 screen 17's Profile
  needs both. `getMyStudentProfile` resolves them server-side rather than the
  frontend making extra calls to endpoints it has no permission to reach (`/circles/:id`
  is staff-only).
- **While adding those, found and fixed a real authorization gap**: `GET
/students/:id/qr.png` and `GET /students/:id/points-history` were missing the
  `assertSupervisorOwnsCircle` check every other student route has — a supervisor
  could fetch _any_ student's QR code (which encodes their private-link slug — the
  same secret that bootstraps their session) or points history within the org, not
  just their own circle's students. Fixed alongside the new routes since it's the
  same file and the same pattern.
- **No dedicated "past questions" history list on the Weekly Question screen** —
  SPEC.md §7 screen 15 asks for one, but there's no backend endpoint returning a
  student's answered-question history (only the single _active_ one). Out of scope
  for this pass; `GET /students/:id/points-history` already surfaces "correct answer"
  ledger entries chronologically, which covers the same information in the Points
  History screen instead.
- **Verified all 5 student screens end-to-end against a live seeded backend**,
  including a targeted follow-up test that created a fresh question via the API and
  drove the actual answer flow in a browser (since every seeded student had already
  answered all seeded questions) — this is what caught the result-card bug above.

## Phase 11 — Polish

- **Added `EmptyState`/`ErrorState` UI primitives** and swapped every ad-hoc
  "no results" / raw error string across the staff and student screens over to
  them, so empty and failed states get consistent ornament-backed styling,
  i18n'd copy, and (for `ErrorState`) a retry action instead of a dead end.
- **Added `OfflineBanner`** (via `navigator.onLine` + `online`/`offline` listeners)
  and a catch-all `NotFound` route — neither was in the original 19-screen list but
  both are named explicitly in SPEC.md §9 ("shared Print view and Empty/error/offline
  states").
- **Added the Print view** (`PrintStudentCards`, route
  `/app/circles/:circleId/print`, deliberately mounted _outside_ `StaffLayout` so
  the sidebar/bottom-nav chrome doesn't print) with a dedicated `print.css` using
  `@media print` to hide app chrome and lay out one QR card per student. Built
  `useBlobObjectUrls` to fetch each student's `qr.png` as an authenticated blob
  (the endpoint requires a bearer token, so a plain `<img src="/api/...">` can't
  work) and revoke the object URLs on unmount to avoid leaking memory on a page
  that can render 30+ images.
- **Route-level code splitting**: converted nearly every page component in
  `router.tsx` to `React.lazy` + `Suspense`. This was driven by a real measurement,
  not speculation — an initial Lighthouse run against the unsplit production build
  showed a ~1.4MB main bundle with `html5-qrcode` (ScanBarcode, ~339KB) and
  `recharts` (Reports, ~374KB) both loading on every route regardless of whether
  the visitor ever reaches those screens. Splitting them out is what let the shared
  entry chunk drop to ~40KB.
- **Added `manualChunks` to `vite.config.ts`** to split vendor libraries
  (react/react-dom/react-router, TanStack Query+axios+zustand, i18next, react-hook-form+zod,
  framer-motion) into their own cacheable chunks, separate from route chunks and from
  each other. Measured effect: Lighthouse performance score moved from 80 to 82 on
  `/login` — a real but small gain, because a _first_ visit (which is what Lighthouse
  measures) downloads the same total bytes either way; the win is deploy-to-deploy
  browser caching, which a single synthetic Lighthouse run can't reflect.
- **Lighthouse performance score on `/login`: 82/100 (target was ≥90), accessibility:
  98/100.** Documenting this honestly rather than chasing the last few points: the
  Lighthouse trace itself (`render-blocking-insight` audit) attributes only ~315ms of
  the ~1650ms estimated savings to a literal render-blocking resource (the main CSS
  file); Total Blocking Time is already 0ms, and FCP/LCP land around 3.5-3.7s purely
  from JS download+parse+execute under Lighthouse's default 4x-CPU-throttled mobile
  simulation. This is the architectural cost of a client-side-rendered React SPA with
  no server-side rendering or static prerendering — SPEC.md's stack (Vite+React SPA,
  no Next.js/Remix-style SSR) doesn't include an SSR layer, and adding one now would
  be a stack change far outside a "polish" pass. Two concrete, measured optimizations
  were applied (route splitting, vendor chunking); further gains would require either
  SSR/prerendering or shipping less JS overall (e.g. replacing `recharts` or
  `html5-qrcode` with lighter alternatives), both bigger changes than this phase's
  scope. Real-world impact is smaller than the synthetic score suggests: on repeat
  visits (the common case for staff logging in daily) all vendor chunks and fonts are
  browser-cached, and Lighthouse's throttling profile is deliberately pessimistic
  versus typical hardware.
- **Full verification before commit**: `pnpm -r build`, `pnpm -r lint`, and
  `pnpm --filter @halaqat/api test` (42/42 passing) all re-run clean after the
  code-splitting and `manualChunks` changes, since neither had been re-verified
  since Phase 10's last full pass.

## Phase 12 — Docs

- **Wrote `apps/api/src/scripts/createOrg.ts` rather than leaving tenant onboarding
  as a manual mongosh procedure in HANDOVER.md.** There's no API route to create an
  org/first-admin — every existing user-creation route requires an already
  authenticated admin, which a new tenant doesn't have yet — so onboarding a second
  mosque was otherwise undocumented in any runnable form. The script only inserts
  (never wipes, unlike `seed.ts`) and refuses to run if the requested `ORG_SLUG`
  already exists, so it's safe against a database that already holds other tenants'
  data. Verified end-to-end against a throwaway `mongodb-memory-server` replica set:
  ran once successfully (prints the new org/admin ids), then ran again with the same
  slug and confirmed it fails closed with a clear "already exists" error rather than
  silently duplicating or overwriting.
- **README's Test section and HANDOVER.md both call out the missing frontend test
  suite explicitly**, rather than letting `pnpm test`'s all-green output imply full
  coverage. SPEC.md's tech table lists Vitest + RTL for the frontend, but no
  component tests were ever written — every screen was instead verified manually
  against a live seeded backend during each phase (documented throughout this file).
  Silently shipping docs that don't mention this would leave whoever picks this up
  next to discover the gap the hard way.
- **HANDOVER.md's "known limitations" section is the single honest summary of every
  documented gap across Phases 1–11** (no frontend tests, Lighthouse performance at
  82 not ≥90, no file upload, no CI pipeline) rather than scattering "revisit this"
  notes only in per-phase entries above — the goal is that someone picking up this
  project reads one section and knows exactly where the edges are, without having to
  read the entire decisions log front to back.

## Post-launch — WhatsApp parent messaging, bulk barcode download, visual polish

- **Parent/guardian WhatsApp messaging is a `wa.me` deep link, not the WhatsApp
  Business API.** A custom-message box and a "send report" button (with a
  daily/weekly/monthly period selector, backed by a new `range` param on
  `getStudentReport`) both build a `https://wa.me/<digits>?text=...` URL and open it
  in a new tab — the supervisor still taps Send inside WhatsApp themselves. Chosen
  over the official Business API because that requires Meta business verification
  and pre-approved message templates for anything sent outside a 24h reply window,
  for a feature that's fundamentally "help staff send a message a human reviews
  before it goes out." `apps/web/src/lib/whatsapp.ts` normalizes whatever phone
  format was typed (`+`, `00`, spaces, dashes) into the digits-only form `wa.me`
  needs; it can't guess a missing country code, so the parent-phone field now has an
  inline hint asking staff to include one.
- **Bulk barcode download zips client-side (`jszip`), not via a new server
  endpoint.** `downloadStudentBarcodes()` fetches each student's existing
  `/students/:id/qr.png` (already an authenticated, per-student route) in parallel
  and packages them into one `.zip` in the browser — no new backend surface, no new
  server dependency. Filenames are index-prefixed and Arabic-safe
  (`01-أحمد محمد.png`). Wired into both the circle Students tab and the print sheet,
  since either place could plausibly be where a supervisor reaches for "get me every
  QR code in this circle."
- **Login's hero photo is a real, identifiable halaqa — not a stock/generic mosque
  image** — "Halaq at Masjid al-Haram, 6 April 2015, Makkah, Saudi Arabia" by
  Mohammed Tawsif Salam, sourced from Wikimedia Commons under CC BY-SA 3.0 /
  GFDL 1.2+. CC BY-SA requires attribution, satisfied by a visible, linked credit
  line in the corner of the hero panel (`auth.photoCredit`, both locales) rather
  than only in a repo-level credits file — attribution needs to travel with the
  image wherever it's shown, not just live in source control. Resized/re-encoded to
  WebP+JPEG fallback at 1920px/~250KB (from a 5184×3456/5.3MB original) and checked
  into `apps/web/public/images/` rather than hot-linked, so the login page doesn't
  depend on Wikimedia's uptime.
- **`Login` and every other screen with a placeholder mosque icon now render the
  real org logo (`BrandMark`, `public/quran-logo.png`) instead of the generic
  `MihrabArch` ornament** — consistent branding beats a good-enough abstract
  substitute once a real asset exists.
- **Fixed a real, pre-existing test flake while touching this area**:
  `attendance.service.test.ts`'s non-boundary tests called `scanAttendance` without
  pinning the clock, so whether a scan landed as "present" or "late" depended on the
  real wall-clock time the suite happened to run relative to the default `lateAfter`
  (20:15 Asia/Riyadh) — invisible during a normal workday, guaranteed to fail
  overnight. Fixed with a suite-level `beforeEach` pinning fake time to a safe
  morning instant, using vitest's `shouldAdvanceTime: true` (not a fully frozen
  clock) so sequential writes within one test still get distinct, correctly-ordered
  `occurredAt` timestamps — a first attempt with a frozen clock passed the
  status-only assertions but broke a test asserting ledger sort order, since a scan
  followed by an edit landed on the exact same frozen instant.

## Post-launch — bug reports from real usage (barcode, PDF, lateness, grades, type size)

Five issues reported after real use of the deployed app. All five were real bugs (not
misunderstandings), found and fixed by reading the actual code path rather than
guessing — each is a distinct root cause:

- **"The barcode doesn't work at all for accessing the student's page."** The QR/
  barcode PNG (`generateStudentQrPng`) encoded the bare `barcodeValue` (a nanoid
  slug) — plain text, not a URL. The in-app scanner worked fine (it matches on that
  same raw text), but a parent or student scanning the printed card with an
  ordinary phone camera app got a text string with nothing to tap, not a link. Now
  encodes the full `${WEB_BASE_URL}/student/<slug>` URL instead (`WEB_BASE_URL` is a
  new env var — set it in production; see `.env.example`). `scanAttendance` gained
  `extractBarcodeValue()` to recover the bare slug from a scanned URL, so the in-app
  scanner and manual-entry field keep working against the same printed code —
  verified live by decoding an actual generated QR with `jsqr` and confirming both
  the URL form and the legacy bare-slug form resolve correctly.
- **Found and fixed a second, related bug while testing that fix**: `ScanBarcode`'s
  `handleDecoded` — shared by the camera callback and manual entry — unconditionally
  called `scannerRef.current?.pause(true)`. `html5-qrcode` throws synchronously if
  the scanner isn't actively scanning, which is exactly the state manual entry
  exists for (no camera device, denied permission). The throw happened before the
  `try/catch` around the actual attendance API call, so the whole submit silently
  died — manual entry, the fallback for exactly this situation, was broken by it.
  Fixed the same way the Phase 9 unmount bug was: check `getState()` before calling
  `pause()`/`resume()`.
- **"Reports aren't downloading as PDF — only English text shows up."** pdfkit's
  built-in `"Helvetica"`/`"Helvetica-Bold"` are the Adobe Standard 14 AFM fonts —
  Latin-only. Arabic student/circle names simply have no glyphs in that font, so
  they rendered as nothing (not an error, not a crash — invisible), leaving only the
  English column headers and numbers, which read as "it's all in English."
  `utils/pdf.ts` now embeds Amiri (`src/assets/fonts/*.ttf`, OFL-licensed, fetched
  from the Google Fonts repo) via `doc.registerFont`. `tsc` doesn't copy non-`.ts`
  files, so `scripts/copy-assets.mjs` mirrors `src/assets` into `dist/assets` as
  part of `pnpm build`. Verified by actually downloading a circle report PDF and
  reading it back — Arabic names render correctly now.
- **"Lateness isn't calculated automatically after the 20:15 cutoff."** The
  QR-scan path (`scanAttendance`) already auto-computed late-vs-present correctly
  (see Phase 3's boundary test) — but the roster/manual-attendance tab
  (`recordManualAttendance`) always took `status` as an explicit, literal choice
  with no time awareness at all, by original design. Given the barcode bug above,
  manual roster-tapping was likely the only workable path, so "automatic" lateness
  was never actually exercised. Rather than just fixing the barcode bug and hoping
  that's enough, added `resolveManualStatus()`: a manual "present" tap past the
  circle's `lateAfter` is now recorded (and paid) as "late" automatically, exactly
  as if they'd scanned in late — an explicit "late"/"absent"/"excused" tap is never
  second-guessed, since those are already unambiguous. Deliberately _not_ applied to
  `updateAttendanceRecord` (editing an existing record) — a correction made the next
  day shouldn't be judged against right-now's clock.
- **"Grades aren't saving — not sure what's wrong."** Two compounding bugs in
  `GradesTab`: (1) `currentWeekOf()`'s default date built a local midnight `Date`
  then called `.toISOString()` — which converts to UTC, rolling the calendar day
  _backward_ for any positive UTC offset (Asia/Riyadh is UTC+3), silently defaulting
  the "week of" picker to the wrong Saturday. (2) `onSubmit` had no error handling:
  a cleared/invalid native date input produces `""`, and `new Date("").toISOString()`
  throws synchronously — with no try/catch and no await at the call site, this was
  an unhandled promise rejection. The button did nothing, no error, nothing in the
  console a non-technical user would think to look at. Fixed both: `currentWeekOf()`
  now builds the "YYYY-MM-DD" string from local Y/M/D getters directly (no UTC
  round-trip), and `onSubmit` validates the parsed date and wraps the mutation in
  try/catch. While in there, also fixed the duplicate-grade conflict showing the raw
  internal error string `"grade_already_recorded"` as-is (a pattern likely repeated
  elsewhere in the app — flagging, not fixing everywhere, since only grades was
  reported) — added `isConflictError()` and a proper translated message for this
  specific, expected case.
- **Type size**: bumped the root `font-size` from 16px to 18px in `index.css`. Every
  Tailwind `text-*` utility is a `rem` multiple of that root, so this scales the
  whole app's type proportionally in one place rather than touching every
  component.
- Two pre-existing tests (`attendance.service.test.ts`, `reports.routes.test.ts`)
  called `recordManualAttendance` with `status: "present"` without pinning the
  clock — harmless before `resolveManualStatus()` existed, but the new time-check
  made them fail depending on the real time of day the suite happened to run
  (exactly the flake already fixed once earlier in `attendance.service.test.ts`;
  the same fix — `vi.useFakeTimers({ shouldAdvanceTime: true })` pinned to a safe
  morning instant — was needed in `reports.routes.test.ts` too once its own
  `recordManualAttendance` calls started being time-sensitive).

## Post-launch — second round: barcode config, grades rework, reports, champions, photo upload

- **The barcode was still opening `localhost` in production.** Not a code bug — the
  previous fix (encoding `WEB_BASE_URL` into the QR) works correctly, but
  `WEB_BASE_URL` was never actually set on the production deployment, so it fell
  back to its dev default. This requires a server-side config change (setting
  `WEB_BASE_URL=https://<real-domain>` in the deployed `apps/api/.env` and
  restarting the API) that only the deployment owner can make — flagged clearly
  rather than silently "fixed" by code that can't reach their server.
- **Grades reworked from "one per student per week" to a free-form log.**
  `recordGrade`'s application-level conflict check was already removed in the
  previous round, but `CircleGrade` still had a **database-level unique index** on
  `{studentId, weekOf}` — missed the first time. A test added to catch exactly this
  (two grades for the same student on the same day) caught it immediately: a raw
  `MongoServerError: E11000 duplicate key` leaking straight past the app's error
  handling. Fixed by dropping `unique: true` from that index.
  **Operational note**: Mongoose does not drop or alter existing indexes on an
  already-running database — it only creates missing ones. Any deployment that has
  already recorded grades (including this one) needs the stale index dropped
  manually once: `db.circlegrades.dropIndex("studentId_1_weekOf_1")` via `mongosh`.
  This is the first schema-index change since launch; there's still no migration
  tooling (see HANDOVER.md), so this one-off manual step is the pragmatic fix
  rather than building migration infrastructure for a single index.
- **Grades UI redesigned**: grouped by student (most recently graded student
  first) instead of one flat chronological list — with grades no longer
  one-per-week, a supervisor reviewing a student's progress needs their history
  together, not interleaved with everyone else's. The date field is now optional,
  defaults to today, and is no longer framed as "which week" — it's just "when."
  Also reinforced (via a hint under the student dropdown) that student selection
  was already scoped to the circle being viewed — Grades has always lived inside a
  specific circle's detail page (`circleId` from the route), never showing students
  from other circles; the confusion was about clarity, not an actual scoping bug.
- **Reports were showing English text in an Arabic-first app**: the on-screen
  Report tab was already fully i18n'd, but the PDF/CSV _exports_
  (`exportCircleReport`/`exportStudentReport`) had hardcoded English titles, column
  headers, and — in the student ledger export — raw `source`/`reason` values like
  `"ledger.attendance.present"` (the same i18n keys the in-app points-history screen
  translates client-side, shown here completely unlocalized since a generated
  export has no i18next context of its own). Added `utils/ledgerLabels.ts` — a
  small static Arabic lookup mirroring the `ledger.*` i18n namespace — and
  translated every export's title/subtitle/columns to Arabic. Also added
  `level` (the student's memorization level, e.g. "جزء عم") and `latestGrade` to
  both the on-screen report and every export — asked for explicitly ("memorization
  progress and level"); a dedicated structured memorization-progress tracker (pages/
  juz completed) doesn't exist yet and would be a larger follow-up, so this reuses
  the existing `level` field and the grade history already being recorded.
- **Removed the logged-in staff member's name from the header.** Investigated
  before touching anything: the name shown ("Abdulrahman Al-Sudais") is literally
  `ADMIN_NAME` in `scripts/seedData.ts` — the demo/seed script's placeholder admin,
  a nod to the real Imam of Masjid al-Haram. Its appearance in what's described as
  a production deployment is a strong signal that `pnpm seed` (which wipes and
  replaces all data with 30 fake students, fake circles, etc.) was run there
  instead of `pnpm create-org` (which only ever adds one real org, never wipes
  anything) — flagged directly rather than silently worked around, since it implies
  the visible data may not be real. The header itself now just shows the org
  logo/name — simpler, and sidesteps the question of whose name to show for good.
- **Added "Champions of the Circles" (فرسان الحلقات)** — the top-scoring student in
  each circle for the current week, shown on the Circles-list screen (the actual
  post-login landing page; the separate `/` `Home` route is unrelated legacy
  placeholder from Phase 1 that was never wired into the real navigation flow).
  New `getCircleChampions` service loops `getLeaderboard` per circle server-side
  (fine at mosque scale — a handful of circles) rather than the frontend firing N
  separate requests. A circle with no points activity yet renders with no
  champion card rather than an empty/broken one.
- **Logo made large and prominent on the login/hero screen**, per direct request —
  the existing `BrandMark` (the mosque's real logo, added directly to
  `public/quran-logo.png` outside this session) grew from a small corner mark to
  the dominant visual element, with a drop-shadow for legibility against the photo
  background. The background photo itself is still the Masjid al-Haram halaqa photo
  from the previous round — swapping in a mosque-specific photo is a one-file
  change (`public/images/halaqa-hero.*`) once one is provided.
- **Photo upload/capture, not a pasted URL.** `apps/api/uploads/` and the `multer`
  dependency were already scaffolded (per HANDOVER.md's "File uploads were
  deferred") but never wired to a route. Added `POST /students/:id/photo`
  (disk storage, JPEG/PNG/WebP only, 5MB limit, old file deleted on replacement) and
  serve it back at `/api/v1/uploads/students/*` — same prefix Nginx already proxies
  in the deploy guide, so no new reverse-proxy config needed. The stored `photoUrl`
  is `${WEB_BASE_URL}/api/v1/uploads/students/<file>` — a real absolute URL, so it
  satisfies the existing `updateStudentSchema`'s `.url()` validation without any
  special-casing. Frontend: `<input type="file" accept="image/*"
capture="environment">` opens the device camera directly on mobile (falls back to
  a plain file picker on desktop, where `capture` has no effect) and uploads
  immediately on selection, with a local blob-URL preview while the request is in
  flight. Deliberately edit-only (like the QR/access card) — a brand-new student
  has no id to upload against until the record exists.
- Full verification before commit: `pnpm -r build`, `pnpm -r lint`, and
  `pnpm --filter @halaqat/api test` all re-run clean, plus a live pass (fresh seeded
  DB + real browser) confirming the index fix, the champions widget, the redesigned
  grades tab, the Arabic PDF/report content, the enlarged logo, and the removed
  header name all actually render correctly — not just compile.

## Post-launch — real mosque photo for the login hero

- **Swapped the stock Masjid al-Haram photo for the mosque's own** (a real photo of
  their students at a memorization achievement ceremony, provided directly). Removed
  the Wikipedia CC-BY-SA attribution link along with it — not needed for an owned
  photo — and deleted the now-unused `halaqa-hero.*` files and the raw
  full-resolution original from `public/` (only the resized/compressed derivatives
  in `public/images/` are actually served; leaving the unoptimized original at a
  public URL would have shipped extra, unnecessary bytes for no benefit).
- **Found and fixed a real contrast bug this swap exposed**: the darkening overlay
  behind the hero text was tuned against the old (darker, warmer-toned) photo and
  tinted with the brand's dark green (`primary-950`) — against this brighter photo,
  a dark-green overlay under the also-dark-green logo let the logo blend into its
  own background instead of popping. Switched to a neutral black overlay (flat wash
  - directional gradient, both stronger) plus a soft blurred glow specifically
    behind the logo, and added drop-shadows to the title/tagline text — legible
    regardless of what's directly behind them now, not just tuned to one specific
    photo.
- **Found and fixed a mobile clipping bug** while re-verifying: the mobile hero
  used a fixed `h-64` height sized for the old, smaller logo. Once the logo grew
  (per the earlier "make it prominent" request), the tagline paragraph silently
  overflowed past the container's `overflow-hidden` edge — never visible on mobile,
  no error, easy to miss without actually screenshotting a phone-sized viewport.
  Fixed by hiding the tagline on mobile entirely (`hidden lg:block` — it's a nice-
  to-have flourish, not essential information, and mobile screen space is
  precious) rather than growing the container indefinitely to fit more text.

## Post-launch — PDF report text reading backwards

Fixing the Arabic font (earlier round) made the glyphs visible and correctly shaped,
but each line still read in the wrong order — "تقرير الحلقة: الحلقة الأولى" rendered
as "الأولى الحلقة الحلقة: تقرير". Root cause: pdfkit (via fontkit) shapes Arabic
letters _within_ a word correctly using the font's joining features, but implements
none of the Unicode Bidirectional Algorithm — `.text()` just draws a string's
characters left to right in whatever order they're given, regardless of the
text's actual direction. For RTL text that means the first word (which belongs on
the right) gets drawn first, on the left.

Added `utils/rtlText.ts#toVisualRtl()` — reverses **word** order (splitting on
spaces), not character order, so each word's internal letters (and any embedded
LTR run, like a number) stay correct; only the sequence of words along the line is
corrected. Applied it to every string `renderSimpleReportPdf` draws — title,
subtitle, column headers, cell values — and switched everything to `align: "right"`.
Also mirrored the table itself: columns now draw right-to-left starting from the
page's right margin, so the first column in the array (e.g. "الاسم") lands
rightmost, matching where a table's "first" column belongs for an Arabic reader,
instead of the previous left-to-right layout that put it on the far side.

Not a general bidi implementation (a full one would need a real bidi algorithm —
e.g. the `bidi-js` package — to handle arbitrary mixed-script paragraphs correctly);
word-reversal is the well-known, much simpler pragmatic fix for the
short labels/names/values a generated report actually contains, and was verified
against real multi-column circle and student report PDFs (10-student roster,
level/grade/points columns, ledger source/reason history), not just a short test
string. Added `rtlText.test.ts` covering word-order reversal, embedded-number
handling, and non-Arabic strings passing through unchanged.

_(All 12 phases complete; further entries appended as post-launch work lands.)_

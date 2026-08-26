# Halaqat Jami' Al-Siddiq (حلقات جامع الصِّدِّيق) — Product & Technical Spec

A production-grade **MERN** web application — a Quran circles (halaqat) management
system for a mosque. This document is the source of truth the build follows;
non-obvious decisions made while implementing it are logged in
[DECISIONS.md](./DECISIONS.md).

---

## 0. Product context

A mosque runs Quran memorization circles (حلقات). Each circle has one supervisor
(مشرف) and 8–15 students (طلاب). Students earn and lose points through four
mechanisms: attendance, weekly grade, weekly question, and weekly task. Points
accumulate into a running total shown on the student's dashboard, and are used for
rankings and rewards.

**This app will be sold/licensed to other mosques later.** Built multi-tenant from day
one — every record is scoped to an `Organization` (mosque). Branding (name, logo,
colors, app title) is per-organization and stored in the DB, not hardcoded.

**Primary language is Arabic with full RTL layout.** English is a secondary language
via a toggle. Every UI string goes through i18n from the first line of code — never a
hardcoded visible string.

---

## 1. Tech stack (non-negotiable)

| Layer           | Choice                                                                |
| --------------- | --------------------------------------------------------------------- |
| Frontend        | React 18 + Vite + TypeScript                                          |
| Routing         | React Router v6                                                       |
| Server state    | TanStack Query v5                                                     |
| Client state    | Zustand (auth + UI prefs only)                                        |
| Styling         | Tailwind CSS v3 + CSS custom properties for theming                   |
| Forms           | React Hook Form + Zod                                                 |
| i18n            | i18next + react-i18next, with `dir="rtl"` switching                   |
| Charts          | Recharts                                                              |
| QR/Barcode scan | `html5-qrcode` (camera) with manual-entry fallback                    |
| QR generation   | `qrcode` (server-side PNG/SVG for printable student cards)            |
| Backend         | Node.js 20 + Express 4 + TypeScript                                   |
| Database        | MongoDB + Mongoose 8                                                  |
| Auth            | JWT (access + refresh, httpOnly refresh cookie) + bcrypt              |
| Validation      | Zod on every route (shared schemas via a `packages/shared` workspace) |
| File upload     | Multer + local disk in dev, S3-compatible adapter interface for prod  |
| Testing         | Vitest + Supertest (API), React Testing Library (key components)      |
| Tooling         | ESLint, Prettier, Husky pre-commit                                    |

**Repo layout** — pnpm workspaces monorepo:

```
/apps/api          Express + Mongoose
/apps/web          React + Vite
/packages/shared   Zod schemas, TS types, points constants shared by both
/SPEC.md           this file
/DECISIONS.md      log of every non-obvious choice made
/README.md         setup, env vars, seed instructions
```

---

## 2. Design system — Islamic, elegant, professional

Calm, dignified, premium — not a generic dashboard template.

### 2.1 Color tokens

Defined as CSS custom properties in `apps/web/src/styles/theme.css`, referenced
through Tailwind's `theme.extend.colors`. All colors are per-organization overridable
at runtime by injecting the org's palette into `:root`.

```css
:root {
  /* Core mosque green — from the logo */
  --c-primary-950: #06251c;
  --c-primary-900: #0b3b2e; /* main brand green, headers, nav */
  --c-primary-800: #10473a;
  --c-primary-700: #14523f;
  --c-primary-600: #1b6b52;
  --c-primary-500: #24856a;

  /* Sage — the calligraphy green in the logo */
  --c-sage-400: #7fb98a;
  --c-sage-300: #9ccba0;
  --c-sage-100: #dcefdf;

  /* Gold — the crescent */
  --c-gold-600: #a8842f;
  --c-gold-500: #c8a24a;
  --c-gold-400: #e0b057;
  --c-gold-100: #f6ebd2;

  /* Neutrals — warm cream, never pure white */
  --c-cream-50: #fbf9f4;
  --c-cream-100: #f7f4ec;
  --c-cream-200: #efeadd;
  --c-ink-900: #14201b;
  --c-ink-600: #4a5b53;
  --c-ink-400: #8a9891;

  /* Semantic */
  --c-success: #2e7d5b;
  --c-danger: #b3261e;
  --c-warning: #c77700;
  --c-info: #2a6f97;
}
```

Page background is `--c-cream-100`, never `#FFF`. Cards are `--c-cream-50` with a 1px
`--c-cream-200` border and a soft `0 2px 12px rgba(11,59,46,0.06)` shadow.

### 2.2 Typography

- Arabic UI: **IBM Plex Sans Arabic** (weights 400/500/600/700) — self-hosted via
  `@fontsource`.
- Arabic display/headings and Quranic text: **Amiri** — for the app title, section
  headers, and any ayah/surah names.
- Latin UI: **Inter**.
- Numerals: Western Arabic numerals (0-9) in both languages for clarity in
  points/grades — deliberate decision, logged in DECISIONS.md.
- Base size 16px, line-height 1.7 for Arabic body text.

### 2.3 Islamic ornamentation — rules

Reusable React components in `apps/web/src/components/ornament/`. **All SVG, no
raster images.**

1. **`<GirihPattern />`** — an 8-point star (khatim) tessellation, SVG `<pattern>`
   fill, **3–5% opacity** in `--c-primary-900`, on the login page, dashboard header
   band, and empty states. Never competes with content.
2. **`<MihrabArch />`** — the pointed-arch silhouette from the logo. Top edge of the
   hero card on the student dashboard, and the frame for the QR scanner viewport.
3. **`<CornerArabesque />`** — a small gold arabesque flourish for the top-left and
   bottom-right corners of "achievement" cards.
4. **`<GoldRule />`** — a 1px gold hairline with a centered diamond/star motif, instead
   of a plain `<hr>`.
5. **Card headers** — deep green band (`--c-primary-900`) with a subtle girih pattern
   at 6% white, gold hairline at the bottom edge.

**Restraint rule:** at most **two** ornament types visible on any single screen.
Ornament sits behind or beside content, never on top of text.

### 2.4 Motion

Framer Motion, subtle only: 150–250ms ease-out fades and 8px slide-ups on card mount,
a gentle scale+gold-glow pulse when points are awarded, a checkmark draw animation on
a correct answer. Respects `prefers-reduced-motion`.

### 2.5 Responsive

Mobile-first. The supervisor uses this on a phone in the mosque (scanning barcodes
standing up) — the scan screen, attendance list, and grade entry must be one-handed
usable, tap targets ≥ 44px. Desktop gets a persistent sidebar; mobile gets a bottom tab
bar (Home / Tasks / Questions / Profile for students; Circles / Scan / Reports /
Profile for supervisors).

---

## 3. Roles & auth

| Role                     | Login method                  | Can do                                                                       |
| ------------------------ | ----------------------------- | ---------------------------------------------------------------------------- |
| `super_admin`            | email + password              | Manage organizations, global settings                                        |
| `admin` (mosque manager) | email + password              | Manage supervisors, circles, points config, org branding, all reports        |
| `supervisor` (مشرف)      | email/phone + password        | Own circles: attendance, grades, questions, tasks, approvals, circle reports |
| `student` (طالب)         | **passwordless private link** | View own dashboard, answer weekly question, update own task status           |

**Student access link:** each student has a unique unguessable slug, e.g.
`https://halaqat.jami-al-siddiq.com/student/ABC123XYZ`.

- Slug = 12 chars, `nanoid` custom alphabet (no ambiguous chars: no `0/O/1/l/I`).
- Opening the link mints a long-lived student session JWT (90 days, refreshable)
  scoped to that student only.
- Optional per-org setting: require a 4-digit PIN after opening the link (default
  **off**, toggleable).
- Supervisor can **regenerate** a student's slug (invalidates the old one) and
  **copy / share / print** it.
- Slug lookups are rate-limited hard (10/min/IP); never reveal whether an invalid slug
  exists.

**Security requirements:** helmet, CORS allowlist, express-rate-limit on auth and
student-link routes, bcrypt cost 12, no secrets in the repo, Mongoose `select: false`
on password hashes, all `_id`s validated as ObjectId before query, and every
controller verifies the resource belongs to `req.user.organizationId` via a shared
`assertOrgScope()` helper used everywhere — no exceptions.

---

## 4. Data models (Mongoose)

`apps/api/src/models/`. All models get `{ timestamps: true }`, a compound index on
`organizationId`, and soft-delete via `deletedAt: Date | null`.

Models: `Organization`, `User`, `Circle`, `Student`, `AttendanceRecord`,
`CircleGrade`, `WeeklyQuestion`, `QuestionAnswer`, `WeeklyTask`, `TaskSubmission`,
`PointsLedger` (the single source of truth for all points).

See field-level shapes in the original spec conversation / model source files — kept
here at a summary level since the Mongoose schemas themselves are the executable
source of truth once Phase 2 lands.

Key uniqueness constraints:

- `AttendanceRecord`: unique `{ studentId, sessionDate }` — one record per student per day.
- `CircleGrade`: unique `{ studentId, weekOf }`.
- `QuestionAnswer`: unique `{ questionId, studentId }` — one attempt only.
- `TaskSubmission`: unique `{ taskId, studentId }`.
- `PointsLedger`: indexed on `{ studentId, occurredAt: -1 }`.

---

## 5. The points engine

`apps/api/src/services/points.service.ts`. **No controller ever writes
`totalPoints` directly.**

1. Every points change writes a `PointsLedger` entry inside a **MongoDB transaction**
   together with the source record.
2. **Edits never mutate history.** Changing an attendance record from `absent` to
   `present` writes a _reversal_ entry (`+10` to cancel the `-10`) plus the new entry
   (`+10`). The ledger is append-only.
3. `Student.totalPoints` and `pointsBreakdown` are denormalized caches recomputed from
   the ledger on every write within the same transaction.
4. `recomputeStudentPoints(studentId)` and a `pnpm --filter api recompute-points` CLI
   script rebuild all caches from the ledger — the safety net.
5. Attendance points come from `circle.pointsConfigOverride ?? org.pointsConfig`,
   resolved at write time and **snapshotted** into the record, so later config changes
   don't retroactively alter history.
6. Late/absent detection: compare `checkInAt` against the circle's `lateAfter` in the
   **org's timezone** (`date-fns-tz`). A scan after `lateAfter` = `late`. Students with
   no record when the supervisor closes the session = `absent`.
7. Task points are awarded **only** on `approvalStatus === 'approved'`. Rejection
   after approval writes a reversal.

Vitest coverage: correct point values per status, reversal on edit, one-record-per-day
enforcement, timezone boundary at `lateAfter`, question single-attempt enforcement,
task approve → reject → re-approve sequences.

---

## 6. API surface

REST, `/api/v1`, all responses `{ success, data, meta?, error? }`. Zod-validated
body/query/param on every route. Full route list lives in the original spec and
mirrors the router files under `apps/api/src/routes/` once Phase 5/6 land.

---

## 7. Screens

Supervisor/admin: Login, Circles list, Circle detail (tabs), Scan Barcode, Attendance
roster, Add Circle Grade, Weekly Question builder, Weekly Task builder, Approvals
queue, Add/edit student, Reports, Settings.

Student (private link): Dashboard, Points History, Weekly Question, My Tasks, Profile.

Shared: Print view (printable QR cards), Empty/error/offline states.

Full per-screen behavior detail lives in the original spec conversation and is
mirrored by the component implementations as each screen is built.

---

## 8. Quality bar

Skeleton loading states, optimistic updates with rollback, RTL-aware toasts,
accessibility (semantic HTML, gold focus rings, `aria-live` on scan results, color
never the sole carrier of meaning, AA contrast), RTL correctness via Tailwind logical
properties only (no `ml-`/`mr-`/`left-`/`right-`), a realistic seed script, a
documented `.env.example`, and a README covering install/env/seed/run/test/deploy.

---

## 9. Build order

1. Scaffold (this phase).
2. Data layer — Mongoose models, shared Zod schemas, seed script.
3. Points engine + tests.
4. Auth.
5. Core API — organizations, circles, students, QR generation.
6. Feature APIs — attendance, grades, questions, tasks + approvals.
7. Reports API.
8. Design system in React.
9. Supervisor app screens.
10. Student app screens.
11. Polish — print view, empty/error states, motion, a11y, Lighthouse ≥ 90.
12. Docs — README, DECISIONS.md, HANDOVER.md.

Commit after each phase.

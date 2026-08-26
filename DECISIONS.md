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

_(Further entries appended as later phases land.)_

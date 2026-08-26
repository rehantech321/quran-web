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

_(Further entries appended as later phases land.)_

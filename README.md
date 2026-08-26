# Halaqat Jami' Al-Siddiq — حلقات جامع الصِّدِّيق

A multi-tenant Quran memorization circles (halaqat) management system: attendance,
weekly grades, weekly questions, weekly tasks, points, and reporting — built for
mosques, in Arabic-first RTL with an English toggle.

Status: **all 12 build phases complete** (scaffold through docs). See
[DECISIONS.md](./DECISIONS.md) for the reasoning behind non-obvious choices,
[SPEC.md](./SPEC.md) for the full product and technical spec this build follows, and
[HANDOVER.md](./HANDOVER.md) for onboarding a new mosque tenant and an honest list of
what's out of scope for this build.

## Stack

- **apps/api** — Node.js 20, Express 4, Mongoose 8 (MongoDB), JWT auth, Zod validation.
- **apps/web** — React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Zustand,
  React Hook Form + Zod, i18next (ar default / en toggle, RTL-aware).
- **packages/shared** — Zod schemas, shared TS types, and points-engine constants used
  by both apps.

## Prerequisites

- Node.js 20+
- pnpm (via Corepack: `corepack enable && corepack prepare pnpm@latest --activate`)
- A MongoDB instance that supports multi-document transactions — the points engine
  (SPEC.md §5) requires one. A standalone `mongod` does **not** support transactions;
  it must run as a (single-node is fine) replica set:
  ```bash
  mongod --replSet rs0 --dbpath /path/to/data
  # then, once, in a mongosh connected to it:
  rs.initiate()
  ```
  MongoDB Atlas clusters are always replica sets, so this only matters for local dev.
  Docker: `docker run -p 27017:27017 mongo --replSet rs0` (then run `rs.initiate()` once
  via `mongosh` or `docker exec`).

## Install

```bash
pnpm install
```

## Environment setup

Copy the example env files and fill in real values:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

At minimum, set `MONGODB_URI` and generate the three JWT secrets in `apps/api/.env`:

```bash
openssl rand -hex 32
```

See `apps/api/.env.example` for what every variable does.

## Run (development)

```bash
# API — http://localhost:4000
pnpm dev:api

# Web — http://localhost:5173 (proxies /api to the API in dev)
pnpm dev:web
```

## Seed sample data

```bash
pnpm seed
```

This creates one organization (Jami' Al-Siddiq), an admin, two supervisors, three
circles, ~30 students, and several weeks of attendance/grades/questions/tasks so every
screen has realistic data on first run.

## Rebuild points caches

The points ledger is the source of truth; `Student.totalPoints` is a denormalized
cache. If it ever drifts, rebuild it from the ledger:

```bash
pnpm recompute-points
```

## Test

```bash
pnpm test
```

Runs Vitest across all workspaces. Today that means **42 Supertest-driven API tests**
(`apps/api`) covering the points engine (reversal, timezone boundaries, one-per-day
rules, approve/reject lifecycles), auth, org-scoping, and cross-tenant access checks —
all passing against a real `mongodb-memory-server` replica set (transactions require
one; see Prerequisites). `apps/web` has no committed Vitest/RTL suite yet — every
screen was instead verified manually against a live seeded backend with Playwright
during development (see DECISIONS.md's per-phase entries). Adding a frontend
component-test suite is the main testing gap; see HANDOVER.md.

## Lint / format

```bash
pnpm lint
pnpm format
```

A Husky pre-commit hook runs lint-staged (ESLint + Prettier) on staged files.

## Deployment notes

- **API** — Railway or Render. Set the same env vars as `apps/api/.env.example`;
  point `MONGODB_URI` at your Atlas connection string and `CORS_ORIGIN` at the deployed
  web origin.
- **Web** — Vercel. Set `VITE_API_BASE_URL` to the deployed API's `/api/v1` URL.
- **Database** — MongoDB Atlas (free tier is sufficient for a single small mosque;
  scale the cluster tier as tenants grow).

## Onboarding a second mosque

Every record is scoped to an `Organization`. See [HANDOVER.md](./HANDOVER.md) for the
step-by-step process of provisioning a new tenant, plus a full list of known
limitations and suggested next steps.

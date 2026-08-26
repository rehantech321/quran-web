# Halaqat Jami' Al-Siddiq — حلقات جامع الصِّدِّيق

A multi-tenant Quran memorization circles (halaqat) management system: attendance,
weekly grades, weekly questions, weekly tasks, points, and reporting — built for
mosques, in Arabic-first RTL with an English toggle.

Status: **in active development.** See [DECISIONS.md](./DECISIONS.md) for the
reasoning behind non-obvious choices, and [SPEC.md](./SPEC.md) for the full product
and technical spec this build follows.

## Stack

- **apps/api** — Node.js 20, Express 4, Mongoose 8 (MongoDB), JWT auth, Zod validation.
- **apps/web** — React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Zustand,
  React Hook Form + Zod, i18next (ar default / en toggle, RTL-aware).
- **packages/shared** — Zod schemas, shared TS types, and points-engine constants used
  by both apps.

## Prerequisites

- Node.js 20+
- pnpm (via Corepack: `corepack enable && corepack prepare pnpm@latest --activate`)
- A MongoDB instance — local `mongod`, Docker, or a free MongoDB Atlas cluster

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

Once the data layer and seed script land (Phase 2+):

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

Runs Vitest across all workspaces — Supertest-driven API tests and React Testing
Library component tests.

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

Every record is scoped to an `Organization`. See `HANDOVER.md` (added in the final
phase) for the step-by-step process of provisioning a new tenant.

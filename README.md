# BugBoard

A minimal real-time issue tracker — Next.js 15 (App Router) · React 19 · NextAuth v5 (credentials) · Prisma 6 + MySQL · Tailwind · Server-Sent Events.

## Features

- Email/password auth with role-based access (`ADMIN` / `MEMBER`)
- Create issues, change status (open → in progress → resolved), delete (owner or admin)
- Live multi-tab sync over SSE, with resync-on-reconnect
- Search + status/priority filters, at-a-glance stats

## Prerequisites

- Node.js 20+
- Docker (for local MySQL) or an existing MySQL 8 instance

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    - set AUTH_SECRET:  openssl rand -base64 32
#    - DATABASE_URL defaults to the docker-compose MySQL below

# 3. Start MySQL (docker-compose)
docker compose up -d

# 4. Apply the schema and seed demo data
npx prisma migrate deploy
npx prisma db seed        # dev only — see "Seeding" below

# 5. Run the app
npm run dev               # http://localhost:3000
```

Demo accounts (dev seed): `admin@bugboard.dev / admin123`, `alice@bugboard.dev / member123`, `bob@bugboard.dev / member123`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Playwright e2e (**reseeds the DB** — see below) |

## Environment variables

| Var | Required | Notes |
|-----|:---:|-------|
| `DATABASE_URL` | ✅ | MySQL connection string |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32`. The server refuses to start in production with an empty/placeholder value |
| `AUTH_URL` | ✅ | App origin, e.g. `http://localhost:3000` |
| `SEED_ADMIN_PASSWORD`, `SEED_MEMBER_PASSWORD` | prod | Required when seeding with `NODE_ENV=production` |
| `ALLOW_PROD_SEED` | — | Must be `true` to allow the (destructive) seed to run in production |
| `REDIS_URL` | — | Reserved for a future pub/sub backend (see Scaling) |

## Seeding

`prisma/seed.ts` **wipes all users and issues** before inserting demo data. It refuses to run when `NODE_ENV=production` unless `ALLOW_PROD_SEED=true`, and requires `SEED_*_PASSWORD` env vars in that case. Point `DATABASE_URL` at a disposable database when running it.

## Testing

Playwright specs live in `e2e/` (auth, delete authorization, realtime sync + reconnect). `globalSetup` runs `prisma migrate deploy` + `db seed`, so **`npm test` resets the target database** — use a dedicated test `DATABASE_URL`.

```bash
npx playwright install    # first run only: fetch browsers
npm test
```

## Architecture notes & constraints

- **Realtime is single-instance only.** Events flow through an in-memory `EventEmitter` (`lib/events.ts`), so the app must run as **one Node process** — no PM2 cluster, multi-replica, or serverless — until that bus is replaced with a shared pub/sub (e.g. Redis via `REDIS_URL`). See `lib/events.ts` and `implementation_plan.md §7.3`.
- **Sessions are JWT** (12h), re-validated against the DB every ~5 min so deleted/demoted users lose access without waiting for expiry.
- **Deployment / DB hardening is not production-ready:** `docker-compose.yml` runs MySQL as `root` with a trivial committed password on all interfaces and has no healthcheck. Before any non-localhost deployment, bind to loopback, add a least-privilege DB user, and set a strong password.

## Known follow-ups

- ESLint is not yet configured (`npm run lint` needs `eslint` + `eslint-config-next` installed).
- No pagination / fulltext search (loads the full issue list); fine for small teams.

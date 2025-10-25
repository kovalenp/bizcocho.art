# bozchocho.art — Astro + Payload + Stripe (monorepo)

**Stack**

- Astro 5 (SSR via `@astrojs/node`)
- Payload CMS 3 (Next.js 15 app)
- PostgreSQL (local), Stripe SDK v18
- Turborepo + npm workspaces
- Node.js 22 LTS

## Quick start

```bash
nvm use 22 || volta install node@22
pnpm i
cp apps/web/.env.example apps/web/.env
cp apps/cms/.env.example apps/cms/.env
pnpm dev   # runs web and cms together
```

### Apps

- `apps/web` — Astro site on http://localhost:4321
- `apps/cms` — Payload admin/API on http://localhost:3000 (Next.js)

### Local DB

Use any local Postgres (e.g., Postgres.app, Docker, or Supabase). Put your connection string in `apps/cms/.env` as `DATABASE_URL`.

### Stripe

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `apps/cms/.env`. A minimal Checkout Session route is included.

## Local Docker (DB + MailPit)

```bash
docker compose -f infra/docker/docker-compose.yml up -d
# Postgres:  localhost:5432  (postgres/postgres, db: bozchocho)
# MailPit UI: http://localhost:8025 (SMTP on 1025)
```

In `apps/cms/.env` set:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bozchocho
SMTP_HOST=localhost
SMTP_PORT=1025
```

Then run the apps on your host Node:

```bash
pnpm dev
# web: http://localhost:4321
# cms: http://localhost:3000
```

## Using pnpm

```bash
corepack enable
corepack prepare pnpm@latest --activate

pnpm i
pnpm dev
# web: http://localhost:4321
# cms: http://localhost:3000
```

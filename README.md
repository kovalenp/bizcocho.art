# bizcocho.art — Next.js + Payload CMS + Stripe

**Stack**

- Next.js 15 with Payload CMS 3 embedded
- PostgreSQL (local)
- Stripe integration
- pnpm package manager
- Node.js 22 LTS

## Quick start

```bash
nvm use 22 || volta install node@22
pnpm i
cp .env.example .env
pnpm dev
```

### App

- Unified Next.js app on http://localhost:4321
  - Public site at `/`
  - Payload CMS admin at `/admin`
  - Auto-generated API at `/api/[...slug]`
  - GraphQL at `/api/graphql`

### Local DB

Use any local Postgres (e.g., Postgres.app, Docker, or Supabase). Put your connection string in `.env` as `DATABASE_URI`.

### Stripe

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env`.

## Local Docker (DB + MailPit)

```bash
docker compose -f infra/docker/docker-compose.yml up -d
# Postgres:  localhost:5432  (postgres/postgres, db: bizcocho)
# MailPit UI: http://localhost:8025 (SMTP on 1025)
```

In `.env` set:

```
DATABASE_URI=postgres://postgres:postgres@localhost:5432/bizcocho
PAYLOAD_SECRET=your-secret-here
SMTP_HOST=localhost
SMTP_PORT=1025
```

Then run the app on your host Node:

```bash
pnpm dev
# app: http://localhost:4321
# admin: http://localhost:4321/admin
```

## Seeding the database

```bash
pnpm seed
```

This creates:
- Admin user: `admin@bizcocho.art` / `admin123`
- 4 sample art classes with images

## Using pnpm

```bash
corepack enable
corepack prepare pnpm@latest --activate

pnpm i
pnpm dev
# app: http://localhost:4321
# admin: http://localhost:4321/admin
```

## Architecture

This is a unified Next.js 15 application with Payload CMS 3 embedded. Benefits:

- **Single deployment** - One app instead of two
- **Direct database access** - Use `getPayload()` in Server Components (no HTTP calls)
- **Shared TypeScript types** - Payload auto-generates types for collections
- **Simplified development** - One framework, one config, one build process

### Route Groups

- `(app)` - Public frontend routes
- `(payload)` - CMS admin and API routes

### Data Access Pattern

```tsx
// Server Component with direct Payload access
import { getPayload } from 'payload'
import config from '@payload-config'

export default async function Page() {
  const payload = await getPayload({ config })

  const classes = await payload.find({
    collection: 'classes',
    where: { isPublished: { equals: true } },
  })

  return <div>{/* render classes */}</div>
}
```

No API calls needed! Direct in-memory database access via Payload's ORM.

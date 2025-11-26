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

## Testing

The project uses **Vitest** for unit testing with comprehensive coverage.

```bash
# Run all tests
pnpm test

# Watch mode for development
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

For detailed testing documentation, see **[docs/TESTING.md](docs/TESTING.md)**

## Logging

The application uses [Pino](https://getpino.io/) for production-grade structured logging, integrated with Payload CMS:

### Development (localhost)
- Pretty-printed, colorized logs via `pino-pretty`
- Default log level: `debug`
- Human-readable timestamps

### Production
- JSON-formatted logs for log aggregation (Sentry, CloudWatch, Datadog, etc.)
- Default log level: `info`
- Structured logging with consistent format: `{ message, payload, error }`
- Automatic redaction of sensitive fields (passwords, tokens, API keys)

### Configuration
Set environment variables:
```bash
NODE_ENV=production        # development | production
LOG_LEVEL=info            # fatal | error | warn | info | debug | trace
```

### Usage Examples
```typescript
import { logInfo, logError, logWarn, logDebug, logger } from '@/lib/logger'

// Structured logging
logInfo('User logged in', { userId: 123, email: 'user@example.com' })
logError('Payment failed', error, { orderId: 456, amount: 100 })
logWarn('Deprecated API used', { endpoint: '/api/v1/users' })
logDebug('Cache hit', { key: 'session:abc123' })

// Advanced: Child loggers with context
const apiLogger = logger.child({ module: 'api', route: '/checkout' })
apiLogger.info('Processing request')
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

## Collections

### Core Business Collections

#### Courses
Multi-session learning programs where students enroll once and attend all sessions.
- **Pricing**: Single price for entire course (e.g., €180 for a 4-week course)
- **Capacity**: `maxCapacity` applies to ALL course sessions simultaneously
- **Sessions**: Auto-generated from schedule configuration (start/end date, recurrence pattern, days of week)
- **Booking**: One booking grants access to all course sessions

#### Classes
Individual workshops or events, either one-time or recurring.
- **Types**:
  - `one-time`: Sessions created manually (e.g., special workshop)
  - `recurring`: Sessions auto-generated from schedule (e.g., weekly pottery class)
- **Pricing**: Price per individual session
- **Capacity**: `maxCapacity` per session
- **Booking**: Each session booked separately

#### Sessions
The actual time slots when teaching occurs. Sessions belong to either a Class OR a Course.
- **Fields**: `startDateTime`, `timezone`, `status`, `availableSpots`
- **Status**: `scheduled` | `cancelled` | `completed`
- **Auto-generated**: Created by Course/Class hooks when schedule is configured
- **Capacity tracking**: `availableSpots` decremented when bookings are created

#### Bookings
Customer reservations for classes or courses.
- **Types**: `class` (single session) | `course` (full enrollment)
- **Status flow**: `pending` → `confirmed` → `attended`/`no-show`/`cancelled`
- **Payment**: Integrated with Stripe (`stripePaymentIntentId`)
- **Expiration**: Pending bookings auto-expire via cron cleanup

### Supporting Collections

| Collection | Description |
|------------|-------------|
| **Instructors** | Teachers with name, bio, photo, email, specialties |
| **Tags** | Category labels for filtering (e.g., "Ceramics", "Kids & Family") |
| **Media** | Image uploads with localized alt text |
| **Users** | Admin/customer accounts with auth and contact info |

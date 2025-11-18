# Repository Guidelines

This repository hosts bizcocho.art - an art class booking platform with Next.js 15 + Payload CMS 3. Follow these practices to keep changes consistent and deploy-ready.

**Note for AI assistants (Claude Code, etc.):** This file contains comprehensive development guidelines for this repository. Key information for quick productivity is also available in CLAUDE.md.

## Project Structure

- `apps/web` — Next.js 15 SSR app with Payload CMS integrated
  - Frontend pages in `src/app/(app)/[locale]` with i18n support
  - Payload CMS admin at `/admin` route
  - API routes in `src/app/api`
  - Collections in `src/collections`
  - Tailwind CSS v4 for styling
- `infra/docker/docker-compose.yml` — Postgres + MailPit for local development
- Root tooling: pnpm workspaces + Turbo for monorepo management

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **CMS**: Payload CMS 3
- **Database**: PostgreSQL (via @payloadcms/db-postgres)
- **Styling**: Tailwind CSS v4
- **i18n**: Custom implementation with English/Spanish support
- **Payment**: Stripe (future integration)
- **Node Version**: 22+

## Build, Test & Development Commands

```bash
pnpm install                      # install workspace deps (Node 22+)
pnpm --filter @bizcocho/web dev   # run Next.js dev server (port 4321)
pnpm --filter @bizcocho/web build # build for production
pnpm --filter @bizcocho/web seed  # seed database with sample data
pnpm --filter @bizcocho/web generate:types # generate Payload types
pnpm build                        # build all packages
pnpm lint | pnpm format           # linting and formatting
```

Launch Postgres + MailPit via `docker compose -f infra/docker/docker-compose.yml up -d` before starting development.

## Key Features Implemented

### Collections
- **ClassTemplates** - Reusable class definitions with pricing, capacity, duration
- **ClassSessions** - Specific instances of classes with dates/times
- **Instructors** - Instructor profiles with photos and bios
- **Bookings** - Guest booking system with contact info
- **Tags** - Category tags for filtering classes
- **Media** - File uploads for class images
- **Users** - Admin authentication
- **Memberships**, **CourseEnrollments**, **Courses** (configured but not yet in use)

### Frontend Features
- Multilingual support (English/Spanish) with locale-based routing
- Class listing page with tag filtering
- Class detail pages with image galleries
- Booking form with validation
- Responsive design with Tailwind CSS
- Smooth card hover animations and transitions

### API Endpoints
- `/api/bookings` - POST endpoint for creating bookings

## Coding Style & Naming Conventions

- **TypeScript** everywhere; ESM imports, 2-space indentation
- **Next.js conventions**:
  - Pages use Server Components by default
  - Client Components marked with `'use client'`
  - Dynamic routes: `[locale]`, `[slug]`
- **Payload Collections**: PascalCase files (`ClassTemplates.ts`)
- **Components**: PascalCase files (`BookingForm.tsx`)
- **Utilities**: camelCase files (`messages/index.ts`)
- **Tailwind**: Use utility classes; avoid inline styles

## i18n Structure

```
src/i18n/
  config.ts          # Locale definitions
  messages/
    index.ts         # Message types and resolver
    en.ts            # English translations
    es.ts            # Spanish translations
```

Messages are organized by section: `common`, `home`, `classDetail`, `booking`

## Database Schema

Key relationships:
- ClassTemplates 1:N ClassSessions
- ClassTemplates N:M Tags
- Bookings N:1 ClassTemplates
- Bookings N:1 Users (optional for guest bookings)
- ClassTemplates N:1 Instructors

## Testing Guidelines

- Add Vitest suites beside code (`*.test.ts`)
- Use Playwright for E2E flows (booking, checkout)
- Keep >80% coverage on payment/capacity code
- Run `pnpm test` before PRs

## Commit & Pull Request Guidelines

- Use Conventional Commits: `feat(web): add class detail page`, `fix(api): validate booking date`
- One feature/bug per PR with clear description
- Include manual test steps and screenshots for UI changes
- Run `pnpm build` before requesting review

## Security & Configuration

- Never commit `.env*` files; copy from `.env.example`
- Required environment variables:
  - `DATABASE_URI` - PostgreSQL connection string
  - `PAYLOAD_SECRET` - Secret key for Payload CMS
  - `SITE_URL` - Base URL (http://localhost:4321 for dev)
  - `STRIPE_SECRET_KEY` (future)
  - `STRIPE_WEBHOOK_SECRET` (future)
- Validate all user inputs
- Use Payload's built-in authentication for admin routes

## Future Enhancements

- Stripe payment integration for bookings
- Email notifications for booking confirmations
- Class session scheduling with recurrence patterns
- Membership system with recurring payments
- Admin dashboard for managing bookings
- Calendar view for class sessions
- User accounts for customers (currently guest bookings only)

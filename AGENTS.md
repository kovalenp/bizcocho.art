# Repository Guidelines

This monorepo hosts the Astro marketing site and Payload CMS behind bizcocho.art; follow these practices to keep changes consistent and deploy-ready.

**Note for AI assistants (Claude Code, etc.):** This file contains comprehensive development guidelines for this repository. Key information for quick productivity is also available in CLAUDE.md.

## Project Structure & Module Organization
- `apps/web` — Astro 5 SSR site; pages in `src/pages`, future components in `src/components`, static assets colocated with features.
- `apps/cms` — Next.js 15 + Payload 3 admin/API; collections live in `payload/collections`, routes in `src/app` (App Router) and any legacy pages in `src/pages`.
- `infra/docker/docker-compose.yml` spins up Postgres + MailHog for local data/mail; keep configs in sync with `apps/cms/.env`.
- Root tooling (pnpm/Turbo) lives in `package.json`, `pnpm-workspace.yaml`, and `turbo.json`; update them whenever you add packages or pipeline steps.

## Build, Test & Development Commands
```bash
pnpm install                     # install workspace deps (Node 22+)
pnpm dev                         # run Astro (4321) + Payload (3000)
pnpm build                       # build every package
pnpm --filter @bozchocho/web dev # isolate Astro work
pnpm --filter @bozchocho/cms dev # work on Payload/Next
pnpm lint | pnpm format          # placeholder hooks until linters land
```
Launch Postgres + MailHog via `docker compose -f infra/docker/docker-compose.yml up -d` before CMS work.

## Coding Style & Naming Conventions
- TypeScript everywhere; prefer ESM imports, 2-space indentation, and descriptive PascalCase components/functions.
- Astro/React components use kebab-case file names (`class-calendar.astro`), Payload collections stay in PascalCase files (`Classes.ts`).
- Keep schema/types in sync by colocating Zod schemas with their collections or loaders, then re-exporting through the nearest `index.ts`.

## Testing Guidelines
- Add Vitest suites beside the code they cover (`*.test.ts`) and snapshot UI in Astro with `@astrojs/test`; reserve Playwright for flows like booking or checkout.
- Keep >80% coverage on payment/capacity code and expose package-level `pnpm test` scripts before opening PRs that add specs.

## Commit & Pull Request Guidelines
- Repo history is clean slate; adopt Conventional Commits (`feat(web): add class cards`, `fix(cms): guard webhook secret`).
- One feature/bug per PR; describe context, manual test steps, env changes, and link issues/specs. Attach screenshots or terminal output when UX or CLI behavior changes.
- Run `pnpm build` and any new `pnpm test` targets before requesting review—CI assumes both apps succeed without extra flags.

## Security & Configuration Tips
- Never commit `.env*` files; copy from the examples inside each app. Required keys: `PUBLIC_CMS_URL` for Astro, `DATABASE_URL`, `PAYLOAD_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL` for Payload.
- Verify Stripe webhooks locally by tunneling or forwarding ports; always validate `STRIPE_SIGNATURE` in API routes.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**📋 For comprehensive guidelines, see [AGENTS.md](./AGENTS.md)**

## Quick Start

```bash
pnpm i                           # install deps (Node 22+)
pnpm dev                         # run both apps (web:4321, cms:3000)
pnpm build                       # build all packages
pnpm --filter @bozchocho/web dev # Astro only
pnpm --filter @bozchocho/cms dev # Payload only
```

## Project Structure

- `apps/web` - Astro 5 SSR site (port 4321)
- `apps/cms` - Payload CMS + Next.js 15 (port 3000)
- `infra/docker` - Local Postgres + MailPit

## Key Points

- **Stack**: Astro 5, Payload CMS 3, Next.js 15, PostgreSQL, Stripe
- **Package manager**: pnpm with workspaces
- **Node version**: 22+ required
- **Environment**: Copy `.env.example` files in each app
- **Local DB**: `docker compose -f infra/docker/docker-compose.yml up -d`
- **Code style**: TypeScript, 2-space indent, kebab-case for Astro, PascalCase for Payload

Run `pnpm build` before commits to ensure everything builds successfully.
# syntax=docker/dockerfile:1
# Production Dockerfile for Railway deployment

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:22-alpine AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Builder
# ============================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.12.2 --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ARG DATABASE_URI
ARG PAYLOAD_SECRET
ARG SITE_URL
ARG STRIPE_SECRET_KEY
ARG STRIPE_PUBLISHABLE_KEY

ENV DATABASE_URI=$DATABASE_URI \
    PAYLOAD_SECRET=$PAYLOAD_SECRET \
    SITE_URL=$SITE_URL \
    STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY \
    STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Generate Payload types, import map, and build
RUN pnpm generate:types && pnpm generate:importmap && pnpm build

# ============================================
# Stage 3: Production Runner
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions
USER nextjs

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

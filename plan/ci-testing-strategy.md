# GitHub Actions CI/CD Testing Strategy for bizcocho.art

## Overview

Implement a production-grade CI/CD pipeline for testing a Next.js + Payload CMS application with both unit tests and integration tests. The strategy uses GitHub Actions with Docker PostgreSQL service containers for ephemeral test databases, runs tests in parallel for optimal performance, and seeds data only for integration tests.

## User Requirements

- **Test types**: Unit tests (existing) + Integration tests (new, API + database)
- **Database**: Docker PostgreSQL service container (ephemeral, clean state per run)
- **Seeding**: Only seed for integration tests, not unit tests
- **Trigger**: On every PR (pull_request event)

## Recommended Approach

### 1. Single Workflow with Parallel Jobs

**File**: `.github/workflows/test.yml`

Create one workflow with two parallel jobs:
- `unit-tests` - Fast, mocked, no database (~10-15s)
- `integration-tests` - Real database, seeded data, full validation (~2-3min)

**Rationale**:
- Parallel execution for faster feedback
- Shared dependency caching
- Single PR status check
- Easier maintenance

### 2. Separate Vitest Configurations

**Files**:
- `vitest.config.unit.mts` - Unit tests (node environment, includes `src/**/*.test.ts`)
- `vitest.config.integration.mts` - Integration tests (node environment, includes `src/tests/integration/**/*.integration.test.ts`)

**Rationale**:
- Clear separation of concerns
- Different timeout settings (unit: fast, integration: longer)
- Different coverage paths
- Easy to run independently in development

### 3. Integration Test Structure

**Directory**: `src/tests/integration/`

**Test files to create**:
1. `home-page.integration.test.ts` - Validate Payload queries for home page data fetching
2. `capacity-service.integration.test.ts` - Test CapacityService with real database

**Note**: API route testing (`api-bookings.integration.test.ts`) is deferred to future implementation.

**Test approach**:
- Initialize real Payload instance with test database
- Use seeded data from `seed-classes.ts` (comprehensive seed with realistic data)
- Test actual database operations (not mocks)
- Validate relationships (depth: 2), localization, filtering

### 4. Database Strategy

**PostgreSQL Service Container**:
- Image: `postgres:16-alpine`
- Health checks with pg_isready
- Credentials: `test_user:test_password`
- Database: `bizcocho_test`
- Ephemeral (destroyed after job)

**Environment variables**:
```yaml
DATABASE_URI: postgres://test_user:test_password@localhost:5432/bizcocho_test
PAYLOAD_SECRET: test-secret-integration-12345678
NODE_ENV: test
LOG_LEVEL: error
PAYLOAD_DROP_DATABASE: true
```

### 5. Seeding Strategy

**Command**: `pnpm seed:test`

**Implementation**: Reuse existing `scripts/seed-classes.ts` with `PAYLOAD_DROP_DATABASE=true`

**What gets seeded**:
- Admin user (admin@bizcocho.art)
- 9 media files
- 6 tags (bilingual)
- 2 instructors
- 3 classes with sessions
- 1 course with sessions

**When to seed**: Only before integration tests, not unit tests

### 6. Test Scripts in package.json

Add separate commands for unit and integration tests:

```json
{
  "test": "vitest run",
  "test:unit": "vitest run --config vitest.config.unit.mts",
  "test:integration": "vitest run --config vitest.config.integration.mts",
  "test:watch:unit": "vitest watch --config vitest.config.unit.mts",
  "test:watch:integration": "vitest watch --config vitest.config.integration.mts",
  "test:coverage:unit": "vitest run --coverage --config vitest.config.unit.mts",
  "test:coverage:integration": "vitest run --coverage --config vitest.config.integration.mts",
  "seed:test": "cross-env NODE_ENV=test tsx scripts/seed-classes.ts"
}
```

## Implementation Steps

### Phase 1: Configuration Files

1. **Create `vitest.config.unit.mts`**
   - Environment: `node`
   - Include: `src/**/*.test.ts` (excludes integration tests)
   - Coverage: Include `src/**/*.ts`, exclude tests and app directory
   - Timeout: 5000ms

2. **Create `vitest.config.integration.mts`**
   - Environment: `node`
   - Include: `src/tests/integration/**/*.integration.test.ts`
   - Setup: `./src/tests/integration/setup.ts`
   - Coverage: Same as unit
   - Timeout: 30000ms (longer for database operations)

3. **Update `package.json`**
   - Add test scripts for unit/integration separation
   - Add `seed:test` command

### Phase 2: Integration Test Setup

4. **Create `src/tests/integration/setup.ts`**
   - Helper functions for Payload initialization
   - Cleanup utilities
   - Common test fixtures

5. **Create `src/tests/integration/home-page.integration.test.ts`**
   - Test: Fetch published classes with depth: 2
   - Test: Fetch published courses with depth: 2
   - Test: Verify localization (en/es)
   - Test: Validate relationships (instructor, media populated)
   - Test: Combined display items (classes + courses)

6. **Create `src/tests/integration/capacity-service.integration.test.ts`**
   - Test: Real database spot reservation
   - Test: Real capacity updates
   - Test: Race condition handling with real DB
   - Test: Rollback with real transactions

**Note**: API route integration tests are deferred and can be added later if needed.

### Phase 3: GitHub Actions Workflow

7. **Create `.github/workflows/test.yml`**

Key components:
- **Trigger**: `on: [pull_request]`
- **Job 1: unit-tests**
  - Node 22, pnpm caching
  - Run `pnpm test:unit`
  - Upload coverage artifact (report only, no thresholds)
  - Timeout: 5 minutes

- **Job 2: integration-tests**
  - PostgreSQL service container with health checks
  - Node 22, pnpm caching
  - Run `pnpm seed:test` (comprehensive seed ~5-10s)
  - Run `pnpm test:integration`
  - Upload coverage artifact (report only, no thresholds)
  - Timeout: 10 minutes

### Phase 4: Validation

8. **Test locally**
   - Run `pnpm test:unit` (should pass immediately)
   - Start local PostgreSQL
   - Run `pnpm seed:test`
   - Run `pnpm test:integration`

9. **Test in CI**
   - Push to feature branch
   - Create PR
   - Verify both jobs pass
   - Check artifacts (coverage reports)

### Phase 5: Branch Protection

10. **Configure GitHub branch protection**
    - Settings > Branches > Branch protection rules
    - Require status checks: `unit-tests`, `integration-tests`
    - Require up-to-date branches

## Critical Files

### Files to Create

1. `.github/workflows/test.yml` - CI/CD workflow definition
2. `vitest.config.unit.mts` - Unit test configuration
3. `vitest.config.integration.mts` - Integration test configuration
4. `src/tests/integration/setup.ts` - Integration test utilities
5. `src/tests/integration/home-page.integration.test.ts` - Home page data fetching tests
6. `src/tests/integration/capacity-service.integration.test.ts` - Capacity service with real DB

**Note**: API route tests (`api-bookings.integration.test.ts`) are not included in initial implementation and can be added later.

### Files to Modify

1. `package.json` - Add test scripts

### Files Referenced (Existing)

1. `src/services/capacity.test.ts` - Existing unit tests (no changes)
2. `scripts/seed-classes.ts` - Seeding script (reuse for tests)
3. `src/payload.config.ts` - Payload configuration
4. `vitest.setup.ts` - Global test setup

## Performance Expectations

- **Unit tests**: ~10-15 seconds (46 tests, all mocked)
- **Integration tests**: ~2-3 minutes (DB setup + seeding + tests)
- **Total CI time**: ~3-4 minutes (parallel execution)
- **Dependency caching**: Saves ~2-3 minutes per run

## Key Technical Decisions

### Decision 1: Separate Vitest Configs
**Choice**: Two separate config files (`unit` and `integration`)
**Alternative**: Single config with environment variables
**Rationale**: Clearer separation, different timeout/setup needs, easier to run independently

### Decision 2: Reuse Existing Seed Script
**Choice**: Reuse `seed-classes.ts` with environment variables (comprehensive seed)
**Alternative**: Create minimal `seed-test.ts` for faster tests
**Rationale**: Realistic test data (~5-10s overhead acceptable), validates full seeding process, already maintained, no need for separate test seed maintenance

### Decision 3: Integration Test Pattern
**Choice**: Direct Payload API access (like server components)
**Alternative**: HTTP requests to API routes
**Rationale**: Tests actual data access pattern used in app, faster than HTTP, validates Payload integration

### Decision 4: Parallel Jobs
**Choice**: Both jobs run in parallel
**Alternative**: Sequential (unit first, then integration)
**Rationale**: Faster feedback, GitHub Actions supports parallel execution well, both jobs independent

### Decision 5: Coverage Thresholds
**Choice**: Report only (no enforced thresholds)
**Alternative**: Enforce thresholds (e.g., 80% lines, 70% branches)
**Rationale**: More flexible development flow, prevents blocking PRs, coverage trends can be monitored via artifacts and reports

## Environment Variables

### Unit Tests
- `PAYLOAD_SECRET`: "test-secret-unit-12345678"
- `NODE_ENV`: test
- `LOG_LEVEL`: error

### Integration Tests
- `DATABASE_URI`: postgres://test_user:test_password@localhost:5432/bizcocho_test
- `PAYLOAD_SECRET`: "test-secret-integration-12345678"
- `NODE_ENV`: test
- `LOG_LEVEL`: error
- `PAYLOAD_DROP_DATABASE`: true

## Success Criteria

- ✅ Unit tests run in < 30 seconds
- ✅ Integration tests run in < 5 minutes
- ✅ Both jobs pass on every PR
- ✅ Coverage artifacts uploaded
- ✅ No flaky tests (clean database state each run)
- ✅ Easy to run locally for development
- ✅ Clear test output and error messages

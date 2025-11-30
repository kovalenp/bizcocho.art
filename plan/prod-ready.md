# Codebase Review: Production Readiness Assessment

## Executive Summary

**Overall Score: B- (72/100)**

- Architecture: B+ (82/100) - Solid service layer, good separation of concerns
- Implementation Quality: B- (75/100) - Type safety good, validation/security gaps
- Production Readiness: C+ (60/100) - Critical issues need addressing before launch

**Verdict: NOT PRODUCTION-READY** - Estimated 40-60 hours to address critical issues.

---

## Critical Issues (Must Fix Before Production)

### 1. Race Condition in Capacity Reservation

**Location:** `src/services/capacity.ts` lines 60-108
**Risk:** Overbooking under concurrent load
**Issue:** Read-modify-write pattern without proper locking

```typescript
// Current: Race window between read and write
const sessions = await payload.find(...) // Read
await payload.update({ availableSpots: currentSpots - N }) // Write with stale data
```

**Fix:** Use atomic SQL update or database-level locking

### 2. Email Sending Has No Error Handling

**Location:** `src/lib/email.ts` line 288, `src/services/notifications.ts` line 75
**Risk:** Silent failures, customers don't receive confirmations
**Issue:** `transporter.sendMail()` can throw but isn't wrapped in try-catch
**Fix:** Add try-catch with retry logic and proper error logging

### 3. CRON Endpoint Unsecured by Default

**Location:** `src/app/api/cron/cleanup-expired-bookings/route.ts` line 23
**Risk:** Unauthorized cleanup trigger, data manipulation
**Issue:** `CRON_SECRET` is optional, logs warning but continues
**Fix:** Make `CRON_SECRET` required, return 401 if missing/invalid

### 4. Missing Authentication on Admin Endpoints

**Location:** `src/app/api/admin/promo-codes/generate/route.ts`
**Risk:** Anyone can generate promo codes if they know the endpoint
**Issue:** No authentication/authorization check
**Fix:** Add Payload admin authentication middleware

### 5. Race Condition in Gift Code Application

**Location:** `src/app/api/checkout/create-session/route.ts` lines 127-199
**Risk:** Gift code value applied multiple times concurrently
**Issue:** Code validated at line 127, booking created at line 180 - another user could apply same code in between
**Fix:** Use database transaction to atomically validate and reserve gift code

---

## High Priority Issues (Should Fix Soon)

### 6. No Health Check Endpoint

**Impact:** Deployment orchestration (K8s, Docker) won't work properly
**Fix:** Create `/api/health` endpoint that tests DB connection

### 7. No Retry Mechanism for External APIs

**Location:** Stripe calls in checkout routes
**Impact:** Transient failures cause booking failures
**Fix:** Add exponential backoff retry wrapper

### 8. No Rate Limiting

**Impact:** API abuse/DoS vulnerability
**Fix:** Add rate limiting middleware (e.g., `next-rate-limit`)

### 9. Code Duplication in Checkout Routes

**Location:** `src/app/api/checkout/create-session/` and `gift-only/`
**Impact:** Maintenance burden, inconsistent bug fixes
**Fix:** Extract common logic to `src/lib/checkout-helpers.ts`

### 10. Stripe Initialization Duplicated

**Location:** 3 files define `getStripe()` function
**Fix:** Extract to `src/lib/stripe.ts`

---

## Medium Priority Issues

### 11. Input Validation Gaps

- Email format not validated (only existence checked)
- Phone number not validated
- Negative `numberOfPeople` not prevented at API level
- Session ID not validated as positive integer

### 12. XSS Risk in Email Templates

**Location:** `src/lib/email.ts` lines 229, 479, 614, 741
**Issue:** User-provided content interpolated directly into HTML
**Fix:** HTML-escape user inputs before interpolation

### 13. Locale Hardcoded to 'en'

**Location:** Collection hooks
**Issue:** Notifications always sent in English
**Fix:** Store locale in booking/gift-certificate metadata

### 14. N+1 Query Pattern

**Location:** `src/services/notifications.ts` lines 39-63
**Issue:** Class fetched separately if not populated
**Fix:** Use `depth: 2` consistently when fetching bookings

### 15. No Database Migrations Strategy

**Issue:** Schema changes not versioned
**Fix:** Set up Payload migrations

---

## Low Priority / Code Quality

### 16. Magic Numbers

- Expiration times (10 minutes) hardcoded in multiple files
- Gift amount presets duplicated in API and component
- Stripe API version hardcoded in 3 files
  **Fix:** Centralize in `src/lib/constants.ts`

### 17. Type Safety Gaps

- `any` types in `src/lib/email.ts` lines 5, 10
- Type assertions without validation
  **Fix:** Replace with proper types

### 18. Inconsistent Error Response Format

**Fix:** Create standardized API response types

### 19. Unused Parameters

- `_classDoc`, `_locale` in notifications.ts
- `previousDocStatus` was in booking.ts (already fixed)

---

## Testing Gaps

**Current Coverage:**

- Services: ~70% (payment, booking, capacity, gift-certificates, notifications)
- API routes: 0%
- Webhooks: 0%
- Email: 0%

**Needed:**

1. Integration tests for complete booking flow
2. API endpoint tests
3. Webhook idempotency tests
4. E2E tests with Playwright

---

## User Preferences

- **Timeline:** Short-term (weeks)
- **Race condition approach:** Keep current verify-and-rollback (acceptable for expected traffic)
- **Focus areas:** Reliability, Code Quality, Testing

---

## Recommended Implementation Order (Based on User Priorities)

### Phase 1: Reliability (8-10 hours)

1. Add email error handling with retry logic in `src/lib/email.ts`
2. Add Stripe retry wrapper with exponential backoff
3. Create health check endpoint `/api/health`
4. Fix silent error swallowing in `src/services/notifications.ts`

### Phase 2: Code Quality (6-8 hours)

5. Extract Stripe client to `src/lib/stripe.ts` (remove duplication from 3 files)
6. Extract common checkout logic to `src/lib/checkout-helpers.ts`
7. Centralize constants in `src/lib/constants.ts` (expiry times, amounts, API version)
8. Fix type safety issues (`any` types in email.ts)
9. Standardize API response format

### Phase 3: Testing (12-16 hours)

10. Add integration tests for complete booking flow
11. Add API endpoint tests for checkout routes
12. Add webhook handler tests
13. Add email service tests (mocked transporter)
14. Target 80%+ coverage on critical paths

### Deferred (Security - Address Later)

- Secure CRON endpoint with required token
- Add admin authentication to promo code endpoint
- Input validation (email, phone format)
- HTML escape in email templates
- Rate limiting middleware

---

## Files Requiring Modification

| Priority | File                                                 | Changes                           |
| -------- | ---------------------------------------------------- | --------------------------------- |
| Critical | `src/services/capacity.ts`                           | Atomic updates for race condition |
| Critical | `src/lib/email.ts`                                   | Add error handling, HTML escaping |
| Critical | `src/services/notifications.ts`                      | Fix silent error swallowing       |
| Critical | `src/app/api/cron/cleanup-expired-bookings/route.ts` | Require auth                      |
| Critical | `src/app/api/admin/promo-codes/generate/route.ts`    | Add auth                          |
| Critical | `src/app/api/checkout/create-session/route.ts`       | Transaction for gift code         |
| High     | `src/app/api/health/route.ts`                        | New file - health check           |
| High     | `src/lib/stripe.ts`                                  | New file - centralized Stripe     |
| High     | `src/lib/checkout-helpers.ts`                        | New file - shared checkout logic  |
| High     | `src/middleware.ts`                                  | Add rate limiting                 |
| Medium   | `src/lib/constants.ts`                               | New file - centralized constants  |
| Medium   | `src/app/api/gift-certificates/purchase/route.ts`    | Input validation                  |
| Medium   | `src/collections/hooks/bookings.ts`                  | Locale from metadata              |

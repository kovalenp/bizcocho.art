# Refactoring Strategy: Production-Grade Architecture

## Executive Summary
This document outlines the architectural refactoring required to elevate the `bizcocho.art` codebase to a production-grade, open-source ready standard. The primary objective is to decouple business logic from the data access layer (Payload CMS Collections) and the presentation layer (UI Components), centralizing it into a robust, testable Service Layer.

## 1. Service Layer (The Core Fix)
Currently, the application suffers from the "Fat Model" anti-pattern, where critical business logic (capacity management, session generation) resides in Payload Collection hooks. This makes the system brittle, hard to test, and prone to race conditions.

### 1.1. `CapacityService` (Refactor)
*   **Current State:** Basic class in `src/services/capacity.ts` with manual rollback logic.
*   **Goal:** robust, atomic capacity management.
*   **Actions:**
    *   Implement atomic database operations ($inc operator) instead of read-modify-write to prevent race conditions.
    *   Add specific methods for `adjustCapacity(sessionId, delta)`.
    *   Remove `Payload` dependency injection in favor of a singleton pattern or context-based injection if possible, or strictly type the dependency.

### 1.2. `SessionManagementService` (New)
*   **Current State:** Logic buried in `Classes.ts` `afterChange` hook (200+ lines).
*   **Goal:** Centralized session lifecycle management.
*   **Actions:**
    *   Extract session generation logic from `Classes.ts`.
    *   Create `generateSessions(classId, scheduleConfig)` method.
    *   Handle edge cases like "modifying a schedule with existing bookings" (currently throws error in `beforeDelete` but needs graceful handling).

### 1.3. `BookingService` (New)
*   **Current State:** Logic split between `Bookings.ts` hooks and API routes (`api/checkout/*`).
*   **Goal:** Unified booking lifecycle.
*   **Actions:**
    *   Centralize `createBooking`, `confirmBooking`, `cancelBooking`, `handleTimeout`.
    *   Ensure `cancelBooking` automatically calls `CapacityService.releaseSpots`.
    *   Ensure `handleTimeout` (cron job) uses the same logic as user-initiated cancellation.

### 1.4. `PaymentService` (New)
*   **Current State:** Direct Stripe calls in API routes.
*   **Goal:** Abstraction over payment provider.
*   **Actions:**
    *   Wrap Stripe interactions.
    *   Handle webhook processing in a dedicated method `handleWebhook(event)`.

## 2. Collections (Slimming Down)
Payload collections should strictly define the *Data Schema* and *Access Control*. They should not contain business rules.

### 2.1. Refactoring Hooks
*   **Pattern:** Hooks should be simple event triggers that delegate to services.
*   **Example (`Bookings.ts`):**
    ```typescript
    // Before: Complex logic checking status changes and loop-updating sessions
    afterChange: [async ({ doc, previousDoc }) => { ...complex logic... }]

    // After: Delegation
    afterChange: [async ({ doc, previousDoc }) => {
        if (doc.status === 'cancelled' && previousDoc.status !== 'cancelled') {
             await bookingService.handleCancellation(doc);
        }
    }]
    ```
*   **Targets:** `Classes.ts` (schedule logic), `Bookings.ts` (capacity logic).

## 3. UI Components (Composition & SRP)
Components like `BookingWidget.tsx` are overloaded with responsibilities (UI rendering, API calls, error handling, form state).

### 3.1. Component Architecture Rules
*   **Presentational vs. Container:** strict separation.
*   **Custom Hooks:** Logic must reside in hooks.

### 3.2. `BookingWidget` Refactor
*   **Extract Hook:** `useBookingProcess`
    *   Manages: `step` (selection, details, payment), `isLoading`, `error`.
    *   Exposes: `submitBooking(data)`.
*   **Sub-components:**
    *   `BookingPriceDisplay`: Pure component for calculating totals.
    *   `GiftCodeForm`: Isolate gift code validation logic.
    *   `BookingStatusMessage`: Success/Error states.

### 3.3. `ClassDetailLayout`
*   **Improvement:** Remove redundant `localSessions` state. Use `useMemo` to filter sessions if needed, but source of truth should be props or a React Context if the tree gets deeper.

## 4. Open Source Readiness
To prepare for public release:

*   **Environment Variables:** Create a robust `env.validation.ts` (using Zod) to fail fast if keys are missing.
*   **Secrets Management:** Ensure no hardcoded secrets in `stripe` webhooks or Payload config.
*   **Documentation:**
    *   `CONTRIBUTING.md`: Code standards, how to run tests.
    *   `ARCHITECTURE.md`: High-level diagram of the Service-Collection relationship.
*   **License:** Add MIT or appropriate license.

## Implementation Roadmap

1.  **Phase 1: Service Extraction (High Priority)**
    *   Create `src/services/session-manager.ts` & `src/services/booking-manager.ts`.
    *   Move logic from `Classes.ts` and `Bookings.ts`.
    *   Write unit tests for these services (Vitest).

2.  **Phase 2: API & Hook Wiring**
    *   Update `api/checkout/*` to use new services.
    *   Update Collection hooks to use new services.

3.  **Phase 3: UI Refactor**
    *   Refactor `BookingWidget` and `ClassDetailLayout`.

4.  **Phase 4: Cleanup & Docs**
    *   Standardize logging.
    *   Write documentation.

# Refactoring Summary

## Current Status
The codebase functions but follows a "Monolithic/Fat Model" architecture where Payload CMS Collections contain excessive business logic. This creates:
1.  **Tight Coupling:** Collections depend on each other's implementation details.
2.  **Race Conditions:** `Bookings.ts` and `CapacityService` have windows for overbooking.
3.  **Low Testability:** Logic inside hooks is hard to test in isolation.

## Key Recommendations

1.  **Adopt Service-Oriented Architecture (SOA):** Move logic from `src/collections/*.ts` to `src/services/*.ts`.
    *   **Action:** Create `BookingService`, `SessionService`, `PaymentService`.
2.  **Implement Atomic Capacity Management:** Replace read-modify-write patterns with atomic database operators ($inc) to guarantee data integrity.
3.  **Refactor UI with Custom Hooks:** Extract API integration and complex state from `BookingWidget.tsx` into `useBooking` hooks.
4.  **Standardize Error Handling:** Use a Result pattern or typed Errors across services.

## Next Steps
Start Phase 1 of the [Strategy](./refactoring-strategy.md): Extracting Session Generation logic from `Classes.ts`.

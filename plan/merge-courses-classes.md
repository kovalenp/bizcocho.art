# Plan: Merge Courses and Classes into Single Collection

## Goal
Consolidate `Courses` and `Classes` collections into a single `Classes` collection with a `type` discriminator field. This reduces field duplication while keeping the distinct booking behaviors.

## Key Insight
The only meaningful difference is **booking behavior**:
- `type: 'class'` → Book individual sessions (1 or many - doesn't matter)
- `type: 'course'` → Book enrollment (all sessions at once)

A class with 1 session vs 20 sessions is the same thing - just different schedule. No need for separate "recurring" type.

Sessions inherit price from parent. The `type` field drives:
1. Whether booking reserves 1 session or ALL sessions
2. Email templates (single session vs full schedule)

---

## Implementation Steps

### Phase 1: Update Classes Collection
**File:** `src/collections/Classes.ts`

1. Replace `classType` with `type`:
   ```typescript
   {
     name: 'type',
     type: 'select',
     required: true,
     defaultValue: 'class',
     options: [
       { label: 'Class', value: 'class' },
       { label: 'Course', value: 'course' },
     ],
     admin: {
       description: 'Class: book individual sessions. Course: book enrollment (all sessions).',
     },
   }
   ```

2. Schedule is always visible after save (remove `classType === 'recurring'` condition):
   ```typescript
   condition: (data) => !!data?.id
   ```

3. Update `afterChange` hook:
   - Generate sessions for BOTH types when schedule is configured
   - Same logic for class and course session generation

4. Update `beforeDelete` hook:
   - Simple check - find bookings with any of this class's sessions:
     ```typescript
     where: { sessions: { in: sessionIds } }
     ```

### Phase 2: Update Sessions Collection
**File:** `src/collections/Sessions.ts`

1. Remove `course` relationship field entirely
2. Keep only `class` relationship (works for both types)
3. Update `sessionType` field options:
   ```typescript
   options: [
     { label: 'Class', value: 'class' },
     { label: 'Course', value: 'course' },
   ]
   ```
   This mirrors the parent class's type.

### Phase 3: Update Bookings Collection
**File:** `src/collections/Bookings.ts`

1. Remove both `course` and `session` (singular) fields
2. Add `sessions` as array relationship:
   ```typescript
   {
     name: 'sessions',
     type: 'relationship',
     relationTo: 'sessions',
     hasMany: true,
     required: true,
   }
   ```
   - Class booking: `[sessionId]` (1 session)
   - Course booking: `[session1, session2, ...]` (all sessions)

3. Keep `bookingType` for clarity (helps with email templates, UI):
   ```typescript
   options: [
     { label: 'Class Booking', value: 'class' },
     { label: 'Course Enrollment', value: 'course' },
   ]
   ```

4. Update `beforeValidate` hook:
   - Must have at least one session
   - Auto-set `bookingType` based on parent class type

5. Update `afterChange` hook for capacity sync:
   - Iterate through `booking.sessions` array
   - Update capacity for each session

### Phase 4: Unify Checkout Routes

**Delete:** `src/app/api/checkout/create-course-session/route.ts`

**Update:** `src/app/api/checkout/create-session/route.ts`
- Accept both `classId` and optional `sessionId`
- Logic based on class type:
  ```typescript
  if (classDoc.type === 'course') {
    // Book ALL sessions for this class
    sessionsToBook = await getAllClassSessions(classId)
  } else {
    // Book specific session (sessionId required)
    sessionsToBook = [await getSession(sessionId)]
  }
  ```
- Create booking with `sessions: sessionsToBook.map(s => s.id)`
- Single code path for capacity, Stripe, etc.

### Phase 5: Simplify Capacity Service
**File:** `src/services/capacity.ts`

With `sessions[]` array, unify into single methods:
1. `reserveSpots(sessionIds: number[])` - works for 1 or N sessions
2. `releaseSpots(sessionIds: number[])` - works for 1 or N sessions
3. Remove separate class/course methods - same logic for both
4. `getAvailability(sessionIds)` - returns min availability across sessions

### Phase 6: Simplify Webhook Handler
**File:** `src/app/api/webhooks/stripe/route.ts`

With `sessions[]` in bookings, single code path:
1. On payment success: booking already has `sessions[]`, just confirm
2. On expiration: iterate `booking.sessions`, restore capacity for each
3. Update metadata: store `classId` + `bookingType`
4. Email: check `bookingType` for template selection

### Phase 7: Simplify Cron Job
**File:** `src/app/api/cron/cleanup-expired-bookings/route.ts`

Single code path:
1. Find expired bookings
2. For each: iterate `booking.sessions`, restore capacity
3. Delete booking
4. No type-specific branching needed

### Phase 8: Consolidate Frontend

**Rename URL structure:** `/classes/*` and `/courses/*` → `/offerings/*`

**Files:**
- DELETE `src/app/(app)/[locale]/courses/` (entire folder)
- DELETE `src/app/(app)/[locale]/classes/` (entire folder)
- CREATE `src/app/(app)/[locale]/offerings/[slug]/page.tsx`
  - Fetch class by slug
  - Conditional rendering based on `class.type`:
    - **class**: Session picker + "Book Session" button
    - **course**: Schedule display + "Enroll" button
  - Shared: title, description, instructor, gallery, price

- UPDATE `src/app/(app)/[locale]/page.tsx`
  - Single query to `classes` collection
  - Display all offerings, can filter by type

- CONSOLIDATE components:
  - `src/components/course/CourseBookingButton.tsx` → `src/components/BookingButton.tsx`
  - Props: `classId`, `sessionId?` (optional for courses)
  - Logic: if course type → book all sessions, else book specific session

### Phase 9: Delete Courses Collection
**File:** `src/collections/Courses.ts` → DELETE

**File:** `src/payload.config.ts`
- Remove `Courses` from collections array

### Phase 10: Update Types
- Regenerate Payload types: `pnpm generate:types`
- Update `src/types/display.ts` discriminated union

### Phase 11: Update Capacity Service Tests
**File:** `src/services/capacity.test.ts`

- Update test fixtures to use new `sessions[]` array model
- Remove separate class/course test cases - unify into single test suite
- Test `reserveSpots([sessionId])` for single session
- Test `reserveSpots([s1, s2, s3])` for multiple sessions (course)
- Test `releaseSpots()` with array
- Test `getAvailability()` returns min across sessions

### Phase 12: Update Seed Script
**File:** `src/seed.ts` (or wherever seeding logic lives)

- Remove course seeding (no separate collection)
- Update class seeding to include `type` field:
  ```typescript
  { ...classData, type: 'class' }
  { ...courseData, type: 'course' }
  ```
- Update booking seeds to use `sessions: [...]` array instead of `session`/`course`
- Ensure seed creates both class-type and course-type offerings for testing

---

## Files to Modify (Summary)

| File | Action |
|------|--------|
| `src/collections/Classes.ts` | Add `type` field, unify hooks |
| `src/collections/Sessions.ts` | Remove `course` field |
| `src/collections/Bookings.ts` | Replace `session`/`course` with `sessions[]` |
| `src/collections/Courses.ts` | DELETE |
| `src/payload.config.ts` | Remove Courses import |
| `src/services/capacity.ts` | Unify to `reserveSpots(sessionIds[])` |
| `src/app/api/checkout/create-course-session/` | DELETE |
| `src/app/api/checkout/create-session/route.ts` | Handle both types |
| `src/app/api/webhooks/stripe/route.ts` | Simplify to single code path |
| `src/app/api/cron/cleanup-expired-bookings/route.ts` | Simplify to single code path |
| `src/app/(app)/[locale]/courses/` | DELETE folder |
| `src/app/(app)/[locale]/classes/` | DELETE folder |
| `src/app/(app)/[locale]/offerings/` | CREATE unified page |
| `src/app/(app)/[locale]/page.tsx` | Single collection query |
| `src/components/BookingButton.tsx` | CREATE unified component |
| `src/components/course/` | DELETE folder |
| `src/types/display.ts` | Simplify (optional) |
| `src/services/capacity.test.ts` | Update tests for unified model |
| `src/seed.ts` | Update for `type` field and `sessions[]` |

---

## Migration Notes

If there's existing data in the `courses` collection:
1. Create migration script to copy courses to classes with `type: 'course'`
2. Update session references from `course` to `class`
3. Update booking references from `course` to `class`
4. Run migration before deploying code changes

---

## Result

**Before:** 2 collections (Classes, Courses) with 95% field overlap, dual relationships in Sessions/Bookings

**After:** 1 collection (Classes) with `type: 'class' | 'course'`, single relationship chain

### Simplified Mental Model
```
Classes (type: 'class' | 'course')
    └── Sessions (inherits type from parent)
            └── Bookings
                  - sessions: [session1, session2, ...]  (always array)
                  - class booking: 1 session in array
                  - course booking: all sessions in array
```

### Key Simplifications
- No dual relationships anywhere (no `course` field in Sessions or Bookings)
- Bookings always reference sessions (array), never classes directly
- One code path for capacity management (iterate sessions array)
- `bookingType` kept for UI/emails but logic is uniform

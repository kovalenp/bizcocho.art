# Collections Documentation

This document explains the data model for the bozchocho.art class booking system.

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Collections](#collections)
  - [Users](#users)
  - [Instructors](#instructors)
  - [ClassTemplates](#classtemplates)
  - [ClassSessions](#classsessions)
  - [Bookings](#bookings)
  - [Memberships](#memberships)
  - [MembershipSchedules](#membershipschedules)
  - [Subscriptions](#subscriptions)
  - [Media](#media)
- [Data Flow Examples](#data-flow-examples)

---

## Overview

The system supports two revenue models:
1. **Pay-per-class**: Users book individual class sessions
2. **Subscriptions**: Users subscribe to memberships for recurring access

---

## Core Concepts

### Class Template vs Class Session

- **ClassTemplate**: The blueprint/definition of what can be taught (e.g., "Watercolor Basics")
- **ClassSession**: A specific scheduled occurrence (e.g., "Watercolor Basics on Dec 15, 2025 at 2:00 PM")

### Membership vs Subscription

- **Membership**: A subscription program offering access to multiple class types (e.g., "Monthly Ceramics Membership")
- **Subscription**: A user's enrollment in a membership (e.g., "John's subscription to Monthly Ceramics")

---

## Collections

### Users

Represents customers who can book classes or subscribe to memberships.

**Key Fields:**
- `email` - User email (unique)
- `firstName`, `lastName` - User name
- `role` - User role (admin, user)

**Example:**
```json
{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user"
}
```

---

### Instructors

Represents teaching staff who lead classes.

**Key Fields:**
- `name` - Full name
- `slug` - URL-friendly identifier
- `bio` - Biography (localized)
- `email` - Contact email
- `phone` - Contact phone
- `specialties` - Areas of expertise (localized)
- `photo` - Profile photo (relationship to Media)
- `isActive` - Whether instructor is currently active

**Example:**
```json
{
  "name": "María García",
  "slug": "maria-garcia",
  "bio": {
    "en": "Professional watercolor artist with 15 years of teaching experience.",
    "es": "Artista profesional de acuarela con 15 años de experiencia."
  },
  "email": "maria@bozchocho.art",
  "phone": "+34 612 345 678",
  "specialties": {
    "en": "Watercolor, Botanical Art, Landscapes",
    "es": "Acuarela, Arte Botánico, Paisajes"
  },
  "photo": "64a1b2c3d4e5f6g7h8i9j0k1",
  "isActive": true
}
```

---

### ClassTemplates

Defines the blueprint for classes/workshops that can be taught.

**Key Fields:**
- `title` - Class name (localized)
- `slug` - URL-friendly identifier (localized)
- `classType` - Type of class:
  - `one-time` - Single event
  - `recurring` - Repeating schedule
  - `membership-template` - Part of a subscription membership
- `description` - Class description (localized)
- `instructor` - Assigned instructor (relationship)
- `featuredImage` - Main image (relationship to Media)
- `gallery` - Additional images (relationship to Media)
- `priceCents` - Price per session in cents
- `currency` - Currency code (default: 'eur')
- `durationMinutes` - Duration in minutes
- `maxCapacity` - Maximum participants
- `location` - Venue/location (localized)
- `recurrencePatterns` - Array of recurring schedules (only for `recurring` type)
- `isPublished` - Visibility status

**Recurrence Pattern Fields:**
- `frequency` - `weekly`, `biweekly`, or `monthly`
- `daysOfWeek` - Array of day numbers (0=Sunday, 1=Monday, etc.)
- `startTime` - Start time in HH:MM format (e.g., "18:00")
- `startDate` - When recurrence starts
- `endDate` - When recurrence ends (optional)
- `timezone` - Timezone (e.g., "Europe/Madrid")
- `isActive` - Whether this pattern is active

**Example 1: One-Time Class**
```json
{
  "title": {
    "en": "Watercolor Basics",
    "es": "Fundamentos de Acuarela"
  },
  "slug": {
    "en": "watercolor-basics",
    "es": "fundamentos-acuarela"
  },
  "classType": "one-time",
  "description": {
    "en": "Learn the fundamentals of watercolor painting.",
    "es": "Aprende los fundamentos de la pintura con acuarela."
  },
  "instructor": "instructor_id_123",
  "priceCents": 4500,
  "durationMinutes": 180,
  "maxCapacity": 8,
  "location": {
    "en": "Studio A",
    "es": "Estudio A"
  },
  "isPublished": true
}
```

**Example 2: Recurring Class**
```json
{
  "title": "Paint & Drink Wine",
  "slug": "paint-drink-wine",
  "classType": "recurring",
  "description": "Relax and paint while enjoying a glass of wine.",
  "instructor": "instructor_id_456",
  "priceCents": 3500,
  "durationMinutes": 120,
  "maxCapacity": 12,
  "recurrencePatterns": [
    {
      "frequency": "weekly",
      "daysOfWeek": ["4"],
      "startTime": "18:00",
      "startDate": "2025-12-01",
      "endDate": "2026-02-28",
      "timezone": "Europe/Madrid",
      "isActive": true
    }
  ],
  "isPublished": true
}
```

---

### ClassSessions

Represents specific scheduled occurrences of class templates.

**Key Fields:**
- `classTemplate` - Parent template (relationship)
- `startDateTime` - Start date/time (UTC)
- `endDateTime` - End date/time (UTC)
- `timezone` - Display timezone
- `status` - `scheduled`, `cancelled`, or `completed`
- `availableSpots` - Remaining capacity (calculated via hooks)
- `notes` - Internal notes

**Example:**
```json
{
  "classTemplate": "class_template_id_123",
  "startDateTime": "2025-12-15T14:00:00.000Z",
  "endDateTime": "2025-12-15T17:00:00.000Z",
  "timezone": "Europe/Madrid",
  "status": "scheduled",
  "availableSpots": 8,
  "notes": "Remember to prepare materials"
}
```

**Usage:**
- For one-time classes: Create 1 session
- For recurring classes: Auto-generated from recurrence patterns
- For membership templates: Created and linked via MembershipSchedules

---

### Bookings

Tracks individual pay-per-class reservations.

**Key Fields:**
- `user` - Booking user (relationship)
- `classSession` - Booked session (relationship)
- `quantity` - Number of spots reserved
- `status` - `pending`, `confirmed`, `cancelled`, `attended`, `no-show`
- `paymentStatus` - `unpaid`, `paid`, `refunded`, `failed`
- `stripePaymentIntentId` - Stripe payment reference
- `bookingDate` - When booking was made
- `checkedIn` - Attendance flag
- `notes` - Special requests or notes

**Example:**
```json
{
  "user": "user_id_789",
  "classSession": "session_id_123",
  "quantity": 2,
  "status": "confirmed",
  "paymentStatus": "paid",
  "stripePaymentIntentId": "pi_1234567890",
  "bookingDate": "2025-12-01T10:30:00.000Z",
  "checkedIn": false,
  "notes": "Vegetarian option needed for lunch"
}
```

---

### Memberships

Defines subscription programs that bundle multiple class templates.

**Key Fields:**
- `title` - Membership name (localized)
- `slug` - URL-friendly identifier (localized)
- `description` - Program description (localized)
- `classTemplates` - Included class types (relationship)
- `featuredImage` - Main image (relationship to Media)
- `monthlyPriceCents` - Subscription price in cents
- `currency` - Currency code
- `billingCycle` - `monthly`, `quarterly`, or `annual`
- `maxEnrollments` - Maximum active subscribers
- `isPublished` - Visibility status

**Example:**
```json
{
  "title": {
    "en": "Monthly Ceramics Membership",
    "es": "Membresía Mensual de Cerámica"
  },
  "slug": {
    "en": "monthly-ceramics",
    "es": "ceramica-mensual"
  },
  "description": {
    "en": "Access to all ceramics classes throughout the month.",
    "es": "Acceso a todas las clases de cerámica durante el mes."
  },
  "classTemplates": ["template_id_1", "template_id_2", "template_id_3"],
  "monthlyPriceCents": 12000,
  "billingCycle": "monthly",
  "maxEnrollments": 20,
  "isPublished": true
}
```

---

### MembershipSchedules

Links memberships to available class sessions during a period.

**Key Fields:**
- `membership` - Parent membership (relationship)
- `classSessions` - Available sessions (relationship, many)
- `startDate` - Schedule period start
- `endDate` - Schedule period end
- `isActive` - Whether schedule is active

**Example:**
```json
{
  "membership": "membership_id_123",
  "classSessions": [
    "session_id_1",
    "session_id_2",
    "session_id_3",
    "session_id_4"
  ],
  "startDate": "2025-12-01",
  "endDate": "2025-12-31",
  "isActive": true
}
```

**Usage:**
Defines which specific sessions are available to membership subscribers during December 2025. Admins can create different schedules for different months.

---

### Subscriptions

Tracks user enrollments in memberships.

**Key Fields:**
- `user` - Subscriber (relationship)
- `membership` - Subscribed membership (relationship)
- `enrollmentDate` - When subscription started
- `status` - `active`, `paused`, `cancelled`, `expired`
- `paymentStatus` - `pending`, `paid`, `failed`, `refunded`
- `stripeSubscriptionId` - Stripe subscription reference
- `nextBillingDate` - Next payment date
- `cancellationDate` - When cancelled (if applicable)
- `notes` - Internal notes

**Example:**
```json
{
  "user": "user_id_789",
  "membership": "membership_id_123",
  "enrollmentDate": "2025-12-01T09:00:00.000Z",
  "status": "active",
  "paymentStatus": "paid",
  "stripeSubscriptionId": "sub_1234567890",
  "nextBillingDate": "2026-01-01",
  "notes": "Premium tier subscriber"
}
```

---

### Media

Stores uploaded files (images, etc.).

**Key Fields:**
- `alt` - Alternative text (localized)
- `url` - File URL (auto-generated by Payload)
- `filename` - Original filename
- `mimeType` - File type
- `filesize` - File size in bytes
- `width`, `height` - Image dimensions

**Example:**
```json
{
  "alt": {
    "en": "Watercolor class image",
    "es": "Imagen de clase de acuarela"
  },
  "filename": "watercolor-class.jpg",
  "mimeType": "image/jpeg",
  "filesize": 37439,
  "width": 800,
  "height": 600,
  "url": "/media/watercolor-class.jpg"
}
```

---

## Data Flow Examples

### Example 1: Pay-Per-Class Booking

1. **Admin creates a class template:**
   ```
   ClassTemplate: "Watercolor Basics" (one-time)
   ```

2. **Admin creates a class session:**
   ```
   ClassSession: Dec 15, 2025 at 2:00 PM
   → classTemplate: "Watercolor Basics"
   → availableSpots: 8
   ```

3. **User books the session:**
   ```
   Booking:
   → user: "John Doe"
   → classSession: Dec 15, 2025 at 2:00 PM
   → quantity: 2
   → status: "confirmed"
   → paymentStatus: "paid"
   ```

4. **System updates availability:**
   ```
   ClassSession.availableSpots: 8 → 6 (via hook)
   ```

---

### Example 2: Recurring Class

1. **Admin creates recurring class template:**
   ```
   ClassTemplate: "Paint & Drink Wine" (recurring)
   → recurrencePatterns: [Every Thursday at 18:00]
   ```

2. **System auto-generates sessions:**
   ```
   ClassSession: Dec 4, 2025 at 18:00
   ClassSession: Dec 11, 2025 at 18:00
   ClassSession: Dec 18, 2025 at 18:00
   ClassSession: Dec 25, 2025 at 18:00
   (all linked to "Paint & Drink Wine" template)
   ```

3. **Users book individual sessions as needed**

---

### Example 3: Membership Subscription

1. **Admin creates class templates:**
   ```
   ClassTemplate: "Wheel Throwing" (membership-template)
   ClassTemplate: "Hand Building" (membership-template)
   ClassTemplate: "Glazing" (membership-template)
   ```

2. **Admin creates membership:**
   ```
   Membership: "Monthly Ceramics"
   → classTemplates: [Wheel Throwing, Hand Building, Glazing]
   → monthlyPriceCents: 12000
   ```

3. **Admin creates sessions and schedule:**
   ```
   ClassSession: Wheel Throwing - Dec 5 at 18:00
   ClassSession: Hand Building - Dec 8 at 14:00
   ClassSession: Glazing - Dec 10 at 19:00
   ...more sessions...

   MembershipSchedule:
   → membership: "Monthly Ceramics"
   → classSessions: [all December sessions]
   → startDate: Dec 1, 2025
   → endDate: Dec 31, 2025
   ```

4. **User subscribes:**
   ```
   Subscription:
   → user: "Sarah Smith"
   → membership: "Monthly Ceramics"
   → status: "active"
   → stripeSubscriptionId: "sub_xxx"
   ```

5. **User can attend any session in their membership schedule** without additional payment

---

## Notes

### Localization
Most text fields support localization (English/Spanish):
- `en` - English
- `es` - Spanish (Español)

### Timezone Handling
- All dates are stored in UTC
- Display timezone is stored separately for proper rendering
- Default timezone: `Europe/Madrid`

### Pricing
- All prices stored in cents (e.g., 4500 = €45.00)
- Default currency: EUR

### Status Flow

**Booking Status:**
`pending` → `confirmed` → `attended` / `cancelled` / `no-show`

**Subscription Status:**
`active` → `paused` / `cancelled` / `expired`

**ClassSession Status:**
`scheduled` → `completed` / `cancelled`

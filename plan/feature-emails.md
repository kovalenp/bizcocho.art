# Feature: Email Notifications System

## 1. Architecture & Technology Stack

### Service Layer Architecture

```
src/
├── lib/
│   └── email.ts              # Transport only (nodemailer config, sendMailWithRetry)
├── emails/
│   ├── components/           # Reusable UI pieces
│   │   ├── Layout.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── Button.tsx
│   ├── templates/            # Full email templates
│   │   ├── BookingConfirmation.tsx
│   │   ├── CourseConfirmation.tsx
│   │   ├── BookingCancellation.tsx
│   │   ├── BookingReminder.tsx
│   │   ├── SessionCancellation.tsx
│   │   ├── GiftCertificateRecipient.tsx
│   │   └── GiftCertificatePurchase.tsx
│   └── translations/         # Extracted i18n strings
│       ├── booking-confirmation.ts
│       ├── course-confirmation.ts
│       ├── booking-cancellation.ts
│       ├── booking-reminder.ts
│       ├── session-cancellation.ts
│       └── gift-certificate.ts
└── services/
    └── notifications.ts      # Orchestrates rendering + sending
```

### Responsibility Separation

| Layer | File | Responsibility |
|-------|------|----------------|
| Transport | `src/lib/email.ts` | Nodemailer config, retry logic, provider switching |
| Templates | `src/emails/templates/*.tsx` | React Email components, visual structure |
| Translations | `src/emails/translations/*.ts` | i18n strings per template |
| Orchestration | `src/services/notifications.ts` | Renders templates, calls transport, business logic |

### Technology Choices

*   **Templating:** React Email (`@react-email/components`, `@react-email/render`)
    *   Type-safe, composable components
    *   Built-in plaintext generation
    *   Preview server for development
*   **Transport Layer:**
    *   **Development:** Mailpit (SMTP on `localhost:1025`, UI at `localhost:8025`)
    *   **Production:** Resend (high deliverability, analytics)

---

## 2. Implementation Roadmap

### Phase 0: Infrastructure Setup
*   **Goal:** Set up development tooling and environment.
*   **Tasks:**
    *   Add Mailpit to `docker-compose.yml`
    *   Document env vars in `.env.example`
    *   Add `email:dev` script for React Email preview server
    *   Install dependencies

### Phase 1: React Email Integration (Refactor)
*   **Goal:** Replace hardcoded HTML strings with React Email components.
*   **Tasks:**
    *   Create base components (Layout, Header, Footer, Button)
    *   Extract translations to separate files
    *   Port existing templates:
        *   `BookingConfirmation`
        *   `CourseConfirmation`
        *   `GiftCertificateRecipient`
        *   `GiftCertificatePurchaseConfirmation`
    *   Refactor `src/lib/email.ts` to transport-only
    *   Update `NotificationService` to render + send

### Phase 2: New Notification Types
*   **Goal:** Add templates and service methods for missing lifecycle events.
*   **New Templates:**
    1.  `BookingCancellation` - Sent to user when they cancel their booking
    2.  `BookingReminder` - Sent 24h before the class
    3.  `SessionCancellation` - Sent to all attendees if admin cancels a session
*   **New Service Methods:**
    *   `sendBookingCancellation(bookingId, options)`
    *   `sendBookingReminder(bookingId, options)`
    *   `sendSessionCancellationToAllAttendees(sessionId, reason, options)` - Bulk send
*   **Scope Note:** Cron jobs/scheduled tasks for Reminders are **out of scope**.

### Phase 3: Provider Switching & Error Handling
*   **Goal:** Production-ready transport configuration.
*   **Tasks:**
    *   Implement environment-based provider switching
    *   Add render error handling (separate from transport errors)
    *   Add rate limiting for bulk sends

---

## 3. Detailed Task List

### Phase 0: Infrastructure Setup

1.  [ ] **Docker:** Add Mailpit service to `docker-compose.yml`:
    ```yaml
    mailpit:
      image: axllent/mailpit
      ports:
        - "1025:1025"  # SMTP
        - "8025:8025"  # Web UI
    ```

2.  [ ] **Env Vars:** Document in `.env.example`:
    ```bash
    # Email - Development (Mailpit)
    SMTP_HOST=localhost
    SMTP_PORT=1025
    SMTP_FROM="bizcocho.art" <noreply@bizcocho.art>

    # Email - Production (Resend)
    # RESEND_API_KEY=re_xxxxx
    # OR use SMTP:
    # SMTP_HOST=smtp.resend.com
    # SMTP_PORT=465
    # SMTP_USER=resend
    # SMTP_PASS=re_xxxxx
    ```

3.  [ ] **Dependencies:** Install packages:
    ```bash
    pnpm add @react-email/components @react-email/render resend
    pnpm add -D react-email
    ```

4.  [ ] **Scripts:** Add to `package.json`:
    ```json
    "email:dev": "email dev --dir src/emails/templates --port 3333"
    ```

### Phase 1: React Email Integration

5.  [ ] **Components:** Create `src/emails/components/Layout.tsx`:
    *   Consistent wrapper with max-width, padding, background
    *   Includes Header (logo) and Footer (links, unsubscribe)
    *   Accepts `locale` prop for RTL/language support

6.  [ ] **Components:** Create `src/emails/components/Header.tsx`:
    *   Logo image (hosted URL or base64)
    *   Brand colors (#10b981 green accent)

7.  [ ] **Components:** Create `src/emails/components/Footer.tsx`:
    *   Contact info, website link
    *   Unsubscribe placeholder (for marketing emails later)

8.  [ ] **Components:** Create `src/emails/components/Button.tsx`:
    *   Reusable CTA button with consistent styling

9.  [ ] **Translations:** Create `src/emails/translations/booking-confirmation.ts`:
    ```typescript
    export const translations = {
      en: {
        subject: 'Booking Confirmation - bizcocho.art',
        title: 'Booking Confirmed!',
        intro: 'Thank you for your booking...',
        // ... all strings
      },
      es: {
        subject: 'Confirmación de Reserva - bizcocho.art',
        title: '¡Reserva Confirmada!',
        // ... all strings
      },
    } as const

    export type BookingConfirmationTranslations = typeof translations.en
    ```

10. [ ] **Translations:** Create translation files for all existing templates:
    *   `course-confirmation.ts`
    *   `gift-certificate-recipient.ts`
    *   `gift-certificate-purchase.ts`

11. [ ] **Template:** Create `src/emails/templates/BookingConfirmation.tsx`:
    *   Import translations and Layout
    *   Accept typed props (booking details, locale)
    *   Render both single-session and course variants OR split into two

12. [ ] **Template:** Create `src/emails/templates/CourseConfirmation.tsx`:
    *   Session schedule list
    *   Course-specific copy

13. [ ] **Template:** Create `src/emails/templates/GiftCertificateRecipient.tsx`:
    *   Gradient gift card visual
    *   Code display, expiry, personal message

14. [ ] **Template:** Create `src/emails/templates/GiftCertificatePurchase.tsx`:
    *   Purchase summary
    *   Recipient info

15. [ ] **Transport Refactor:** Simplify `src/lib/email.ts`:
    *   Remove all HTML generation
    *   Keep only: `createTransporter()`, `sendMailWithRetry()`, `sendEmail(to, subject, html, text)`
    *   Export clean interface

16. [ ] **Service Update:** Update `src/services/notifications.ts`:
    *   Import React Email `render` function
    *   Render templates to HTML + plaintext:
      ```typescript
      import { render } from '@react-email/render'

      const html = await render(<BookingConfirmation {...props} />)
      const text = await render(<BookingConfirmation {...props} />, { plainText: true })
      ```
    *   Add render error handling (try/catch around render, log + graceful fail)

### Phase 2: New Notification Types

17. [ ] **Translations:** Create `src/emails/translations/booking-cancellation.ts`

18. [ ] **Template:** Create `src/emails/templates/BookingCancellation.tsx`:
    *   Cancellation confirmation
    *   Refund info (if applicable)
    *   Re-booking CTA

19. [ ] **Service:** Add `sendBookingCancellation(bookingId, options)` to NotificationService

20. [ ] **Translations:** Create `src/emails/translations/booking-reminder.ts`

21. [ ] **Template:** Create `src/emails/templates/BookingReminder.tsx`:
    *   "Your class is tomorrow!" messaging
    *   Class details, location, what to bring
    *   Calendar add link (optional)

22. [ ] **Service:** Add `sendBookingReminder(bookingId, options)` to NotificationService

23. [ ] **Translations:** Create `src/emails/translations/session-cancellation.ts`

24. [ ] **Template:** Create `src/emails/templates/SessionCancellation.tsx`:
    *   Apology messaging
    *   Cancellation reason (optional)
    *   Refund/reschedule info
    *   Contact support CTA

25. [ ] **Service:** Add bulk send method to NotificationService:
    ```typescript
    async sendSessionCancellationToAllAttendees(
      sessionId: number,
      reason?: string,
      options?: NotificationOptions
    ): Promise<{ sent: number; failed: number }> {
      // 1. Query all bookings for this session
      // 2. Loop with rate limiting (e.g., 10/sec)
      // 3. Track success/failure counts
      // 4. Log summary
    }
    ```

### Phase 3: Provider Switching & Error Handling

26. [ ] **Transport Config:** Update `src/lib/email.ts` for provider switching:
    ```typescript
    import type { Transporter } from 'nodemailer'
    import { Resend } from 'resend'

    // Discriminated union for type-safe transport handling
    type EmailTransport =
      | { type: 'nodemailer'; transporter: Transporter }
      | { type: 'resend'; client: Resend }

    function createTransport(): EmailTransport {
      const isDev = process.env.NODE_ENV !== 'production'

      if (isDev) {
        // Development: Mailpit
        return {
          type: 'nodemailer',
          transporter: nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT || '1025', 10),
            secure: false,
          }),
        }
      }

      // Production: Prefer Resend SDK for analytics
      if (process.env.RESEND_API_KEY) {
        return {
          type: 'resend',
          client: new Resend(process.env.RESEND_API_KEY),
        }
      }

      // Fallback: SMTP (works with Resend SMTP or other providers)
      return {
        type: 'nodemailer',
        transporter: nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '465', 10),
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        }),
      }
    }

    // Usage in sendEmail:
    async function sendEmail(options: EmailOptions): Promise<void> {
      const transport = createTransport()

      if (transport.type === 'resend') {
        await transport.client.emails.send({
          from: options.from,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        })
      } else {
        await transport.transporter.sendMail(options)
      }
    }
    ```

27. [ ] **Error Handling:** Add render error handling in NotificationService:
    ```typescript
    private async renderTemplate<P>(
      Template: React.ComponentType<P>,
      props: P
    ): Promise<{ html: string; text: string }> {
      try {
        const html = await render(<Template {...props} />)
        const text = await render(<Template {...props} />, { plainText: true })
        return { html, text }
      } catch (error) {
        logError('Failed to render email template', error, {
          template: Template.name,
          props
        })
        throw new EmailRenderError(`Failed to render ${Template.name}`, error)
      }
    }
    ```

28. [ ] **Rate Limiting:** Add rate limiter for bulk sends:
    ```typescript
    // Simple token bucket or use p-limit
    import pLimit from 'p-limit'

    const emailRateLimit = pLimit(10) // 10 concurrent

    // In bulk send:
    await Promise.all(
      bookings.map(booking =>
        emailRateLimit(() => this.sendSessionCancellation(booking, reason, options))
      )
    )
    ```

29. [ ] **Resend SDK Integration (Optional):** For better analytics:
    ```typescript
    import { Resend } from 'resend'

    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: 'bizcocho.art <noreply@bizcocho.art>',
      to: [recipient],
      subject,
      html,
      text,
    })
    ```

---

## 4. Environment Variables Reference

| Variable | Dev Default | Production | Description |
|----------|-------------|------------|-------------|
| `NODE_ENV` | `development` | `production` | Determines provider |
| `SMTP_HOST` | `localhost` | `smtp.resend.com` | SMTP server |
| `SMTP_PORT` | `1025` | `465` | SMTP port |
| `SMTP_USER` | - | `resend` | SMTP auth user |
| `SMTP_PASS` | - | `re_xxxxx` | SMTP auth pass |
| `SMTP_FROM` | `noreply@bizcocho.art` | same | Sender address |
| `RESEND_API_KEY` | - | `re_xxxxx` | Resend API (if using SDK) |

---

## 5. Testing Strategy

### Unit Tests
*   Test each template renders without error
*   Test translations exist for all locales
*   Test props validation

### Integration Tests
*   Test NotificationService methods with mocked transport
*   Test bulk send with rate limiting

### Visual Testing
*   Use `pnpm email:dev` preview server during development
*   Screenshot comparison for visual regression (optional, via Playwright)

### Manual Testing
*   Send test emails via Mailpit UI
*   Verify HTML + plaintext rendering
*   Test on multiple email clients (Gmail, Outlook, Apple Mail)

---

## 6. Rollback Plan

If issues arise in production:

1. **Immediate:** Revert to previous email.ts (HTML strings) via git
2. **Transport failure:** Switch from Resend SDK to SMTP fallback
3. **Template bug:** Fix and deploy, or temporarily use inline HTML

Keep the old `src/lib/email.ts` functions available (deprecated) for 1 release cycle.

---

## 7. Out of Scope

*   Cron jobs / scheduled tasks for reminders
*   SMS notifications (stub exists, not implemented)
*   Marketing emails / newsletter
*   Email analytics dashboard
*   Unsubscribe management

---

## 8. Dependencies to Add

```bash
# Production
pnpm add @react-email/components @react-email/render resend p-limit

# Development
pnpm add -D react-email
```

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| React Email render fails silently | Emails not sent | Add explicit error handling + logging |
| Bulk send overwhelms provider | Rate limited / blocked | Implement rate limiting (10/sec) |
| Translations missing keys | Runtime error | TypeScript strict types on translation objects |
| Mailpit not running in dev | Silent failure | Add healthcheck, log warning if unreachable |
| Resend API key exposed | Security breach | Use env vars, never commit |

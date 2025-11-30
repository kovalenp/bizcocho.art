# Plan: Gift Certificates Feature

## Goal
Implement gift certificates with partial balance tracking, Stripe payment for purchases, and redemption at checkout.

## Business Requirements
1. **Purchasable vouchers**: 25, 50, 100 EUR + custom amount (10-500 EUR range)
2. **Stripe checkout** for purchasing vouchers
3. **Gift delivery**: Buyer can send to recipient's email with personal message
4. **Partial redemption**: 50€ voucher on 30€ course = 20€ remaining
5. **12-month validity** from purchase
6. **Admin codes**: 100% discount codes for influencers/friends (any offering)

## Technical Approach
Stripe doesn't support partial balance tracking natively. Solution:
- **Custom `GiftCertificates` collection** in Payload for balance tracking
- **Stripe for purchases** (selling vouchers)
- **Apply as discount** at checkout (reduce Stripe charge or skip entirely)

---

## Phase 1: Core Infrastructure

### 1.1 GiftCertificates Collection
**File:** `src/collections/GiftCertificates.ts`

```typescript
// Key fields:
- code: string (unique, indexed) - e.g., "GIFT-ABCD-1234"
- type: 'purchased' | 'admin'
- status: 'pending' | 'active' | 'partial' | 'redeemed' | 'expired'
- initialValueCents: number
- currentBalanceCents: number
- currency: 'eur' | 'usd'
- purchaser: { email, firstName, lastName, phone }
- recipient: { email, name, personalMessage }
- adminCodeSettings: { maxUses, currentUses, notes } // for admin codes
- expiresAt: date (12 months from purchase)
- stripePaymentIntentId: string
- redemptions: array [{ bookingId, amountCents, redeemedAt, classTitle }]
```

### 1.2 Code Generation Utility
**File:** `src/lib/gift-codes.ts`

```typescript
// Generate: GIFT-XXXX-XXXX (no confusing chars: 0/O, 1/I/L)
export function generateGiftCode(): string
export function normalizeCode(code: string): string // uppercase, trim
```

### 1.3 Gift Certificate Service
**File:** `src/services/gift-certificates.ts`

```typescript
export async function validateGiftCode(code: string): Promise<GiftCodeValidation>
export async function applyGiftCode(params: {
  code: string
  bookingAmountCents: number
  bookingId: number
  classTitle: string
}): Promise<{ discountApplied, remainingToPay, newGiftBalance }>
export async function revertGiftCodeUsage(params): Promise<void> // for cancellations
```

---

## Phase 2: Purchase Flow

### 2.1 Purchase API
**File:** `src/app/api/gift-certificates/purchase/route.ts`

Request body:
```typescript
{
  amountCents: number,      // 2500, 5000, 10000, or custom (1000-50000)
  purchaserEmail, purchaserFirstName, purchaserLastName, purchaserPhone,
  recipientEmail, recipientName?, personalMessage?,
  locale: 'en' | 'es'
}
```

Flow:
1. Validate amount (preset or within custom range)
2. Create pending GiftCertificate with generated code
3. Set expiresAt = now + 12 months
4. Create Stripe Checkout Session with metadata: `purchaseType: 'gift_certificate'`
5. Return checkout URL

### 2.2 Webhook Handling (Gift Purchase)
**File:** `src/app/api/webhooks/stripe/route.ts` (modify)

On `checkout.session.completed` where `purchaseType === 'gift_certificate'`:
1. Activate gift certificate (status: 'active')
2. Send gift certificate email to recipient
3. Send purchase confirmation to buyer

On `checkout.session.expired`:
1. Delete pending gift certificate

### 2.3 Email Templates
**File:** `src/lib/email.ts` (modify)

Add:
- `sendGiftCertificateEmail()` - to recipient with code, value, expiry, personal message
- `sendGiftCertificatePurchaseConfirmation()` - to buyer with receipt

---

## Phase 3: Redemption Flow

### 3.1 Validation API
**File:** `src/app/api/gift-certificates/validate/route.ts`

```typescript
POST { code: string }
Returns: { valid, currentBalanceCents, currency, expiresAt } or { valid: false, error }
```

Checks:
- Code exists
- Status is 'active' or 'partial'
- Not expired
- Admin codes: currentUses < maxUses

### 3.2 Checkout Modifications
**File:** `src/app/api/checkout/create-session/route.ts` (modify)

Add to request body: `giftCode?: string`

Modified flow:
```typescript
if (giftCode) {
  validate gift code
  calculate: giftDiscount = min(giftBalance, totalPrice)
  amountToCharge = totalPrice - giftDiscount
}

if (amountToCharge === 0) {
  // Gift covers full amount → gift-only flow (no Stripe)
  redirect to /api/checkout/gift-only
} else {
  // Partial coverage → charge remaining via Stripe
  // Store in metadata: giftCode, giftAmountCents, originalPriceCents
}
```

### 3.3 Gift-Only Checkout (Zero Amount)
**File:** `src/app/api/checkout/gift-only/route.ts` (new)

When gift code covers 100% of cost:
1. Reserve session spots
2. Validate gift code has sufficient balance
3. Apply gift code (deduct balance)
4. Create confirmed booking with paymentStatus: 'paid'
5. Send confirmation email
6. Return success

### 3.4 Bookings Collection Updates
**File:** `src/collections/Bookings.ts` (modify)

Add fields:
```typescript
- giftCertificateCode: string
- giftCertificateAmountCents: number
- stripeAmountCents: number
- originalPriceCents: number
```

### 3.5 Webhook (Redemption)
**File:** `src/app/api/webhooks/stripe/route.ts` (modify)

On booking payment success with giftCode in metadata:
1. Apply gift code deduction via `applyGiftCode()`
2. Update booking with gift code info
3. Include discount info in confirmation email

---

## Phase 4: Frontend

### 4.1 Gift Certificate Purchase Page
**File:** `src/app/(app)/[locale]/gift-certificates/page.tsx` (replace placeholder)

Components:
- Amount selector (25, 50, 100 EUR buttons + custom input)
- Purchaser form (your details)
- Recipient form (gift recipient email, name, message)
- Price summary
- Purchase button → Stripe

### 4.2 Amount Selector Component
**File:** `src/components/gift-certificates/AmountSelector.tsx`

- Three preset buttons
- "Custom Amount" option with input
- Validation: min 10€, max 500€

### 4.3 Gift Code Input Component
**File:** `src/components/booking/GiftCodeInput.tsx`

For use in BookingWidget:
- Code input field
- "Apply" button → calls validate API
- Shows discount applied or error message
- "Remove" button to clear

### 4.4 Modified BookingWidget
**File:** `src/components/booking/BookingWidget.tsx` (modify)

Add:
- GiftCodeInput component before price
- Calculate adjusted price: `total - giftDiscount`
- Pass `giftCode` to checkout API

### 4.5 Additional Pages
- `src/app/(app)/[locale]/gift-certificates/success/page.tsx` - purchase confirmation
- `src/app/(app)/[locale]/gift-certificates/balance/page.tsx` - check balance

### 4.6 i18n
**Files:** `src/i18n/messages/en.ts`, `src/i18n/messages/es.ts`

Add translations for:
- Gift certificate purchase page
- Gift code input labels/errors
- Email templates

---

## Files Summary

### Create:
| File | Description |
|------|-------------|
| `src/collections/GiftCertificates.ts` | Payload collection |
| `src/lib/gift-codes.ts` | Code generation |
| `src/services/gift-certificates.ts` | Validation & redemption logic |
| `src/app/api/gift-certificates/purchase/route.ts` | Purchase API |
| `src/app/api/gift-certificates/validate/route.ts` | Validation API |
| `src/app/api/checkout/gift-only/route.ts` | Zero-amount checkout |
| `src/components/gift-certificates/AmountSelector.tsx` | Amount UI |
| `src/components/gift-certificates/GiftCertificateForm.tsx` | Purchase form |
| `src/components/booking/GiftCodeInput.tsx` | Code input |
| `src/app/(app)/[locale]/gift-certificates/success/page.tsx` | Success page |
| `src/app/(app)/[locale]/gift-certificates/balance/page.tsx` | Balance check |

### Modify:
| File | Changes |
|------|---------|
| `src/payload.config.ts` | Add GiftCertificates collection |
| `src/collections/Bookings.ts` | Add gift code tracking fields |
| `src/app/api/checkout/create-session/route.ts` | Handle gift codes |
| `src/app/api/webhooks/stripe/route.ts` | Process purchases & redemptions |
| `src/lib/email.ts` | Add email templates |
| `src/components/booking/BookingWidget.tsx` | Add gift code input |
| `src/app/(app)/[locale]/gift-certificates/page.tsx` | Replace placeholder |
| `src/i18n/messages/en.ts` | Add translations |
| `src/i18n/messages/es.ts` | Add Spanish translations |

---

## Implementation Order

1. **Core** - Collection, code generator, service
2. **Purchase** - API, webhook handling, emails
3. **Redemption** - Validate API, checkout modifications, gift-only flow
4. **Frontend** - Purchase page, code input, booking widget integration
5. **Polish** - Balance page, i18n, testing

---

## Edge Cases

### Partial Redemption
```
50€ gift card on 30€ class:
→ Deduct 30€, new balance: 20€, status: 'partial'
→ Customer pays 0€ (gift-only flow)
```

### Mixed Payment
```
50€ gift card on 75€ class:
→ Reserve 50€ from card
→ Customer pays 25€ via Stripe
→ On success: deduct 50€, card status: 'redeemed'
```

### Admin Codes
```
100% discount code for influencer:
→ type: 'admin', initialValueCents: 9999900 (effectively unlimited)
→ maxUses: 1 (single use)
→ Works for any offering
```

### Cancellation
```
If booking with gift code is cancelled:
→ Call revertGiftCodeUsage()
→ Restore balance to gift certificate
→ Remove redemption record
```

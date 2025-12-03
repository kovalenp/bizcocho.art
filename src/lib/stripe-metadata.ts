/**
 * Typed helpers for Stripe checkout session metadata.
 * Provides type-safe encoding and decoding of metadata.
 *
 * Stripe metadata values must be strings with max 500 chars.
 * These helpers ensure consistent serialization/deserialization.
 */

import type { Locale } from '../i18n/config'

// Purchase type discriminator
export type PurchaseType = 'booking' | 'gift_certificate'

// Base metadata for all purchases
export interface BaseMetadata {
  purchaseType: PurchaseType
  locale: Locale
}

// Booking metadata
export interface BookingMetadata extends BaseMetadata {
  purchaseType: 'booking'
  bookingId: number
  bookingType: 'class' | 'course'
  classId: number
  sessionIds: number[]
  firstName: string
  lastName: string
  phone: string
  numberOfPeople: number
  giftCode?: string
  giftDiscountCents?: number
  originalPriceCents?: number
}

// Gift certificate purchase metadata
export interface GiftCertificateMetadata extends BaseMetadata {
  purchaseType: 'gift_certificate'
  giftCertificateId: number
  code: string
  amountCents: number
  purchaserEmail: string
  purchaserFirstName: string
  purchaserLastName: string
  recipientEmail: string
  recipientName?: string
}

// Union type for all metadata
export type StripeMetadata = BookingMetadata | GiftCertificateMetadata

// Raw Stripe metadata (all values are strings)
export type RawStripeMetadata = Record<string, string>

/**
 * Encode booking metadata for Stripe.
 * Converts typed data to string key-value pairs.
 */
export function encodeBookingMetadata(data: Omit<BookingMetadata, 'purchaseType'>): RawStripeMetadata {
  const metadata: RawStripeMetadata = {
    purchaseType: 'booking',
    bookingId: data.bookingId.toString(),
    bookingType: data.bookingType,
    classId: data.classId.toString(),
    sessionIds: data.sessionIds.join(','),
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    numberOfPeople: data.numberOfPeople.toString(),
    locale: data.locale,
  }

  if (data.giftCode) {
    metadata.giftCode = data.giftCode
  }
  if (data.giftDiscountCents !== undefined) {
    metadata.giftDiscountCents = data.giftDiscountCents.toString()
  }
  if (data.originalPriceCents !== undefined) {
    metadata.originalPriceCents = data.originalPriceCents.toString()
  }

  return metadata
}

/**
 * Encode gift certificate metadata for Stripe.
 */
export function encodeGiftCertificateMetadata(
  data: Omit<GiftCertificateMetadata, 'purchaseType'>
): RawStripeMetadata {
  const metadata: RawStripeMetadata = {
    purchaseType: 'gift_certificate',
    giftCertificateId: data.giftCertificateId.toString(),
    code: data.code,
    amountCents: data.amountCents.toString(),
    purchaserEmail: data.purchaserEmail,
    purchaserFirstName: data.purchaserFirstName,
    purchaserLastName: data.purchaserLastName,
    recipientEmail: data.recipientEmail,
    locale: data.locale,
  }

  if (data.recipientName) {
    metadata.recipientName = data.recipientName
  }

  return metadata
}

/**
 * Decode raw Stripe metadata into typed data.
 * Returns null if metadata is invalid or missing required fields.
 */
export function decodeMetadata(raw: RawStripeMetadata | null | undefined): StripeMetadata | null {
  if (!raw) return null

  const purchaseType = raw.purchaseType as PurchaseType | undefined

  if (purchaseType === 'gift_certificate') {
    return decodeGiftCertificateMetadata(raw)
  }

  // Default to booking (for backwards compatibility)
  return decodeBookingMetadata(raw)
}

/**
 * Decode booking metadata from raw Stripe metadata.
 */
export function decodeBookingMetadata(raw: RawStripeMetadata): BookingMetadata | null {
  const bookingId = raw.bookingId ? parseInt(raw.bookingId, 10) : NaN
  if (isNaN(bookingId)) return null

  const classId = raw.classId ? parseInt(raw.classId, 10) : NaN
  const numberOfPeople = raw.numberOfPeople ? parseInt(raw.numberOfPeople, 10) : NaN

  const sessionIds = raw.sessionIds
    ? raw.sessionIds.split(',').map((id) => parseInt(id, 10)).filter((id) => !isNaN(id))
    : []

  const metadata: BookingMetadata = {
    purchaseType: 'booking',
    bookingId,
    bookingType: (raw.bookingType as 'class' | 'course') || 'class',
    classId: isNaN(classId) ? 0 : classId,
    sessionIds,
    firstName: raw.firstName || '',
    lastName: raw.lastName || '',
    phone: raw.phone || '',
    numberOfPeople: isNaN(numberOfPeople) ? 1 : numberOfPeople,
    locale: (raw.locale as Locale) || 'en',
  }

  if (raw.giftCode) {
    metadata.giftCode = raw.giftCode
  }
  if (raw.giftDiscountCents) {
    const discount = parseInt(raw.giftDiscountCents, 10)
    if (!isNaN(discount)) {
      metadata.giftDiscountCents = discount
    }
  }
  if (raw.originalPriceCents) {
    const original = parseInt(raw.originalPriceCents, 10)
    if (!isNaN(original)) {
      metadata.originalPriceCents = original
    }
  }

  return metadata
}

/**
 * Decode gift certificate metadata from raw Stripe metadata.
 */
export function decodeGiftCertificateMetadata(raw: RawStripeMetadata): GiftCertificateMetadata | null {
  const giftCertificateId = raw.giftCertificateId ? parseInt(raw.giftCertificateId, 10) : NaN
  if (isNaN(giftCertificateId)) return null

  const amountCents = raw.amountCents ? parseInt(raw.amountCents, 10) : NaN

  const metadata: GiftCertificateMetadata = {
    purchaseType: 'gift_certificate',
    giftCertificateId,
    code: raw.code || '',
    amountCents: isNaN(amountCents) ? 0 : amountCents,
    purchaserEmail: raw.purchaserEmail || '',
    purchaserFirstName: raw.purchaserFirstName || '',
    purchaserLastName: raw.purchaserLastName || '',
    recipientEmail: raw.recipientEmail || '',
    locale: (raw.locale as Locale) || 'en',
  }

  if (raw.recipientName) {
    metadata.recipientName = raw.recipientName
  }

  return metadata
}

/**
 * Type guard for booking metadata.
 */
export function isBookingMetadata(metadata: StripeMetadata | null): metadata is BookingMetadata {
  return metadata?.purchaseType === 'booking'
}

/**
 * Type guard for gift certificate metadata.
 */
export function isGiftCertificateMetadata(
  metadata: StripeMetadata | null
): metadata is GiftCertificateMetadata {
  return metadata?.purchaseType === 'gift_certificate'
}

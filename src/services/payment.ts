import Stripe from 'stripe'
import type { Payload, PayloadRequest } from 'payload'
import type { Booking, Class, Session } from '../payload-types'
import { createBookingService, BookingService } from './booking'
import { createGiftCertificateService, GiftCertificateService } from './gift-certificates'
import { logError, logInfo, logDebug } from '../lib/logger'
import { getMessages } from '../i18n/messages'
import type { Locale } from '../i18n/config'
import {
  encodeBookingMetadata,
  decodeMetadata,
  isBookingMetadata,
  isGiftCertificateMetadata,
  type RawStripeMetadata,
} from '../lib/stripe-metadata'

export type CreateCheckoutParams = {
  booking: Booking
  classDoc: Class
  sessions: Session[]
  locale: 'en' | 'es'
  amountCents: number
  giftCode?: string
  giftDiscountCents?: number
}

export type CreateCheckoutResult = {
  success: boolean
  error?: string
  checkoutUrl?: string
  sessionId?: string
}

export type WebhookResult = {
  success: boolean
  error?: string
  action?: 'booking_confirmed' | 'booking_expired' | 'gift_activated' | 'gift_expired' | 'ignored'
  data?: Record<string, unknown>
}

/**
 * Centralized service for payment processing.
 * Wraps Stripe interactions and handles webhook events.
 */
export class PaymentService {
  private stripe: Stripe
  private bookingService: BookingService
  private giftService: GiftCertificateService

  constructor(
    private payload: Payload,
    stripeSecretKey?: string
  ) {
    const secretKey = stripeSecretKey || process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-11-17.clover',
    })

    this.bookingService = createBookingService(payload)
    this.giftService = createGiftCertificateService(payload)
  }

  /**
   * Create a Stripe Checkout session for a booking.
   */
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
    const {
      booking,
      classDoc,
      sessions,
      locale,
      amountCents,
      giftCode,
      giftDiscountCents,
    } = params

    try {
      const currency = classDoc.currency || 'eur'
      const classTitle = (classDoc.title as string) || 'Booking'
      const bookingType = booking.bookingType || 'class'

      // Build description
      let description: string
      if (bookingType === 'course') {
        description = `Full course enrollment - ${sessions.length} sessions, ${booking.numberOfPeople} ${booking.numberOfPeople === 1 ? 'person' : 'people'}`
      } else {
        const firstSession = sessions[0]
        const startDateTime = new Date(firstSession.startDateTime)
        const sessionDate = startDateTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
        const sessionTime = startDateTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
        description = `${sessionDate} at ${sessionTime} - ${booking.numberOfPeople} ${booking.numberOfPeople === 1 ? 'person' : 'people'}`
      }

      // Add discount info to description
      let stripeDescription = description
      if (giftDiscountCents && giftDiscountCents > 0) {
        const messages = getMessages(locale as Locale)
        const discountFormatted = (giftDiscountCents / 100).toFixed(2)
        stripeDescription += ` (${messages.payment.discountApplied} €${discountFormatted})`
      }

      const siteUrl = process.env.SITE_URL || 'http://localhost:3000'

      // Build typed metadata
      const metadata = encodeBookingMetadata({
        bookingId: booking.id,
        bookingType,
        classId: classDoc.id,
        sessionIds: sessions.map((s) => s.id),
        firstName: booking.firstName,
        lastName: booking.lastName,
        phone: booking.phone,
        numberOfPeople: booking.numberOfPeople,
        locale: locale as 'en' | 'es',
        giftCode,
        giftDiscountCents,
        originalPriceCents: booking.originalPriceCents ?? undefined,
      })

      const stripeSession = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: classTitle,
                description: stripeDescription,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${siteUrl}/${locale}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/${locale}/booking/cancel?session_id={CHECKOUT_SESSION_ID}`,
        customer_email: booking.email,
        metadata,
      })

      logInfo('Stripe checkout session created', {
        bookingId: booking.id,
        stripeSessionId: stripeSession.id,
        amountCents,
      })

      return {
        success: true,
        checkoutUrl: stripeSession.url || undefined,
        sessionId: stripeSession.id,
      }
    } catch (error) {
      logError('Failed to create Stripe checkout session', error, { bookingId: booking.id })
      return { success: false, error: 'Failed to create checkout session' }
    }
  }

  /**
   * Verify webhook signature and construct event.
   */
  verifyWebhookSignature(body: string, signature: string, webhookSecret: string): Stripe.Event | null {
    try {
      return this.stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (error) {
      logError('Webhook signature verification failed', error)
      return null
    }
  }

  /**
   * Handle Stripe webhook event.
   * Processes checkout.session.completed and checkout.session.expired events.
   */
  async handleWebhook(event: Stripe.Event): Promise<WebhookResult> {
    logDebug('Processing webhook', { eventType: event.type })

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          return this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)

        case 'checkout.session.expired':
          return this.handleCheckoutExpired(event.data.object as Stripe.Checkout.Session)

        default:
          logDebug('Unhandled event type', { eventType: event.type })
          return { success: true, action: 'ignored' }
      }
    } catch (error) {
      logError('Webhook handler failed', error, { eventType: event.type })
      return { success: false, error: 'Webhook handler failed' }
    }
  }

  /**
   * Handle successful checkout completion.
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<WebhookResult> {
    const metadata = decodeMetadata(session.metadata as RawStripeMetadata)

    // Handle gift certificate purchase
    if (isGiftCertificateMetadata(metadata)) {
      return this.handleGiftCertificateActivation(session, metadata)
    }

    // Handle regular booking (decodeMetadata defaults to booking for backwards compatibility)
    if (isBookingMetadata(metadata)) {
      return this.handleBookingConfirmation(session, metadata)
    }

    // Should not reach here - decodeMetadata always returns booking or gift_certificate
    logError('Unknown metadata format in checkout session', new Error('Invalid metadata'), {
      sessionId: session.id,
      metadata: session.metadata,
    })
    return { success: false, error: 'Invalid checkout session metadata' }
  }

  /**
   * Handle booking confirmation after payment (typed metadata).
   * Uses transaction to ensure atomicity of confirmation and gift code application.
   */
  private async handleBookingConfirmation(
    session: Stripe.Checkout.Session,
    metadata: ReturnType<typeof decodeMetadata> & { purchaseType: 'booking' }
  ): Promise<WebhookResult> {
    const { bookingId, giftCode, giftDiscountCents } = metadata
    
    let transactionID: string | number | null = null
    try {
        // Start transaction
        transactionID = await this.payload.db.beginTransaction()
        if (!transactionID) {
          return { success: false, error: 'Failed to start database transaction' }
        }
        const req = { payload: this.payload, transactionID } as PayloadRequest

        // Build additional data for confirmation
        const additionalData: Record<string, unknown> = {}
        if (giftCode && giftDiscountCents) {
          additionalData.giftCertificateCode = giftCode
          additionalData.giftCertificateAmountCents = giftDiscountCents
          additionalData.stripeAmountCents = session.amount_total || 0
        }

        // Confirm the booking
        const confirmResult = await this.bookingService.confirmBooking(
          bookingId,
          session.payment_intent as string,
          additionalData,
          req
        )

        if (!confirmResult.success) {
           await this.payload.db.rollbackTransaction(transactionID)
           return { success: false, error: confirmResult.error }
        }

        // Apply gift code if used
        if (giftCode && giftDiscountCents) {
          const applyResult = await this.giftService.applyCode({
            code: giftCode,
            bookingId,
            amountCents: giftDiscountCents,
            req
          })

          if (!applyResult.success) {
            logError('Failed to apply gift code', new Error(applyResult.error || 'Unknown'), {
              bookingId,
              giftCode,
            })
            await this.payload.db.rollbackTransaction(transactionID)
            return { success: false, error: `Failed to apply gift code: ${applyResult.error}` }
          }
        }

        await this.payload.db.commitTransaction(transactionID)

        logInfo('Booking confirmed via webhook', { bookingId })
        // Note: Confirmation emails are sent via Payload afterChange hook on Bookings collection

        return { success: true, action: 'booking_confirmed' }

    } catch (error) {
        if (transactionID) await this.payload.db.rollbackTransaction(transactionID)
        throw error
    }
  }

  /**
   * Handle gift certificate activation after payment.
   * Note: Activation emails are sent via Payload afterChange hook on GiftCertificates collection.
   */
  private async handleGiftCertificateActivation(
    session: Stripe.Checkout.Session,
    metadata: ReturnType<typeof decodeMetadata> & { purchaseType: 'gift_certificate' }
  ): Promise<WebhookResult> {
    const { giftCertificateId } = metadata

    // Check if already activated (idempotency)
    const existingCert = await this.payload.findByID({
      collection: 'gift-certificates',
      id: giftCertificateId,
    })

    if (existingCert?.status === 'active') {
      logInfo('Gift certificate already active, skipping', { giftCertificateId })
      return { success: true, action: 'gift_activated' }
    }

    // Activate the certificate - afterChange hook will send notifications
    await this.payload.update({
      collection: 'gift-certificates',
      id: giftCertificateId,
      data: {
        status: 'active',
        stripePaymentIntentId: session.payment_intent as string,
      },
    })

    logInfo('Gift certificate activated', { giftCertificateId })
    return { success: true, action: 'gift_activated', data: { giftCertificateId } }
  }

  /**
   * Handle expired checkout session.
   */
  private async handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<WebhookResult> {
    const purchaseType = session.metadata?.purchaseType

    // Handle expired gift certificate purchase
    if (purchaseType === 'gift_certificate') {
      return this.handleGiftCertificateExpiration(session)
    }

    // Handle expired booking checkout
    return this.handleBookingExpiration(session)
  }

  /**
   * Handle booking expiration (checkout abandoned).
   */
  private async handleBookingExpiration(session: Stripe.Checkout.Session): Promise<WebhookResult> {
    const bookingId = session.metadata?.bookingId

    if (!bookingId) {
      logError('Missing booking ID in expired session', new Error('Missing bookingId'))
      return { success: true, action: 'ignored' }
    }

    const bookingIdNum = parseInt(bookingId, 10)

    // Cancel the booking (releases capacity)
    const cancelResult = await this.bookingService.cancelBooking(bookingIdNum)

    if (!cancelResult.success) {
      // Booking may have already been deleted
      logInfo('Could not cancel expired booking (may already be deleted)', { bookingId })
    }

    // Delete the booking entirely
    try {
      await this.payload.delete({
        collection: 'bookings',
        id: bookingIdNum,
      })
    } catch {
      // Already deleted, that's fine
    }

    logInfo('Expired booking cleaned up', { bookingId })
    return { success: true, action: 'booking_expired' }
  }

  /**
   * Handle gift certificate expiration (checkout abandoned).
   */
  private async handleGiftCertificateExpiration(session: Stripe.Checkout.Session): Promise<WebhookResult> {
    const giftCertificateId = session.metadata?.giftCertificateId

    if (!giftCertificateId) {
      return { success: true, action: 'ignored' }
    }

    try {
      await this.payload.delete({
        collection: 'gift-certificates',
        id: parseInt(giftCertificateId, 10),
      })
      logInfo('Expired gift certificate deleted', { giftCertificateId })
    } catch (error) {
      logError('Failed to delete expired gift certificate', error, { giftCertificateId })
    }

    return { success: true, action: 'gift_expired' }
  }
}

/**
 * Factory function to create a PaymentService instance.
 */
export function createPaymentService(payload: Payload, stripeSecretKey?: string): PaymentService {
  return new PaymentService(payload, stripeSecretKey)
}
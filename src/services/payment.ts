import Stripe from 'stripe'
import type { Payload } from 'payload'
import type { Booking, Class, Session } from '../payload-types'
import { createBookingService, BookingService } from './booking'
import { createGiftCertificateService, GiftCertificateService } from './gift-certificates'
import { logError, logInfo, logDebug } from '../lib/logger'

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
        const discountFormatted = (giftDiscountCents / 100).toFixed(2)
        stripeDescription += locale === 'es'
          ? ` (Descuento aplicado: €${discountFormatted})`
          : ` (Discount applied: €${discountFormatted})`
      }

      const sessionIds = sessions.map((s) => s.id).join(',')
      const siteUrl = process.env.SITE_URL || 'http://localhost:3000'

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
        metadata: {
          bookingId: booking.id.toString(),
          bookingType,
          classId: classDoc.id.toString(),
          sessionIds,
          firstName: booking.firstName,
          lastName: booking.lastName,
          phone: booking.phone,
          numberOfPeople: booking.numberOfPeople.toString(),
          locale,
          giftCode: giftCode || '',
          giftDiscountCents: (giftDiscountCents || 0).toString(),
          originalPriceCents: (booking.originalPriceCents || 0).toString(),
        },
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
    const purchaseType = session.metadata?.purchaseType

    // Handle gift certificate purchase
    if (purchaseType === 'gift_certificate') {
      return this.handleGiftCertificateActivation(session)
    }

    // Handle regular booking
    return this.handleBookingConfirmation(session)
  }

  /**
   * Handle booking confirmation after payment.
   */
  private async handleBookingConfirmation(session: Stripe.Checkout.Session): Promise<WebhookResult> {
    const bookingId = session.metadata?.bookingId
    const giftCode = session.metadata?.giftCode
    const giftDiscountCents = session.metadata?.giftDiscountCents
      ? parseInt(session.metadata.giftDiscountCents, 10)
      : undefined

    if (!bookingId) {
      logError('No booking ID in session metadata', new Error('Missing bookingId'))
      return { success: false, error: 'Missing booking ID' }
    }

    const bookingIdNum = parseInt(bookingId, 10)

    // Build additional data for confirmation
    const additionalData: Record<string, unknown> = {}
    if (giftCode && giftDiscountCents) {
      additionalData.giftCertificateCode = giftCode
      additionalData.giftCertificateAmountCents = giftDiscountCents
      additionalData.stripeAmountCents = session.amount_total || 0
    }

    // Confirm the booking
    const confirmResult = await this.bookingService.confirmBooking(
      bookingIdNum,
      session.payment_intent as string,
      additionalData
    )

    if (!confirmResult.success) {
      return { success: false, error: confirmResult.error }
    }

    // Apply gift code if used
    if (giftCode && giftDiscountCents) {
      const applyResult = await this.giftService.applyCode({
        code: giftCode,
        bookingId: bookingIdNum,
        amountCents: giftDiscountCents,
      })

      if (!applyResult.success) {
        logError('Failed to apply gift code', new Error(applyResult.error || 'Unknown'), {
          bookingId: bookingIdNum,
          giftCode,
        })
        // Don't fail the webhook - booking is already confirmed
      }
    }

    logInfo('Booking confirmed via webhook', { bookingId: bookingIdNum })
    return { success: true, action: 'booking_confirmed' }
  }

  /**
   * Handle gift certificate activation after payment.
   */
  private async handleGiftCertificateActivation(session: Stripe.Checkout.Session): Promise<WebhookResult> {
    const giftCertificateId = session.metadata?.giftCertificateId

    if (!giftCertificateId) {
      logError('No gift certificate ID in session metadata', new Error('Missing giftCertificateId'))
      return { success: false, error: 'Missing gift certificate ID' }
    }

    const certIdNum = parseInt(giftCertificateId, 10)

    // Check if already activated (idempotency)
    const existingCert = await this.payload.findByID({
      collection: 'gift-certificates',
      id: certIdNum,
    })

    if (existingCert?.status === 'active') {
      logInfo('Gift certificate already active, skipping', { giftCertificateId })
      return { success: true, action: 'gift_activated' }
    }

    // Activate the certificate
    await this.payload.update({
      collection: 'gift-certificates',
      id: certIdNum,
      data: {
        status: 'active',
        stripePaymentIntentId: session.payment_intent as string,
      },
    })

    logInfo('Gift certificate activated', { giftCertificateId })
    return { success: true, action: 'gift_activated' }
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

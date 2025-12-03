import type { Payload } from 'payload'
import type { Booking, Class, Session } from '../payload-types'
import { getStripe } from '../lib/stripe'
import { createCapacityService, CapacityService } from './capacity'
import { createGiftCertificateService, GiftCertificateService } from './gift-certificates'
import { logError, logInfo } from '../lib/logger'
import { getMessages } from '../i18n/messages'
import type { Locale } from '../i18n/config'

// Input types
export type CustomerInfo = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export type CheckoutInput = {
  classId: number
  sessionId?: number // Required for class bookings, optional for courses
  customer: CustomerInfo
  numberOfPeople: number
  locale: 'en' | 'es'
  giftCode?: string
}

// Internal validated data
type ValidatedCheckoutData = {
  classDoc: Class
  sessions: Session[]
  sessionIds: number[]
  bookingType: 'class' | 'course'
  totalPriceCents: number
  currency: string
  giftDiscountCents: number
  amountToChargeCents: number
}

// Result types
export type CheckoutResult = {
  success: boolean
  error?: string
  status?: number // HTTP status code for errors
  // For Stripe checkout
  checkoutUrl?: string
  bookingId?: number
  // For gift-only checkout (no payment needed)
  confirmed?: boolean
  redirectUrl?: string
  // For redirect to gift-only endpoint
  giftOnlyCheckout?: boolean
  giftOnlyData?: GiftOnlyCheckoutData
}

export type GiftOnlyCheckoutData = {
  classId: number
  sessionIds: number[]
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
  locale: 'en' | 'es'
  giftCode: string
  giftDiscountCents: number
  totalPriceCents: number
  bookingType: 'class' | 'course'
}

/**
 * Orchestrates the entire checkout flow.
 * Handles validation, pricing, reservations, booking creation, and Stripe session.
 */
export class CheckoutService {
  private capacityService: CapacityService
  private giftService: GiftCertificateService

  constructor(private payload: Payload) {
    this.capacityService = createCapacityService(payload)
    this.giftService = createGiftCertificateService(payload)
  }

  /**
   * Main entry point for checkout.
   * Validates input, calculates pricing, reserves capacity/gift code,
   * creates booking, and returns Stripe checkout URL or confirms immediately.
   */
  async initiateCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    try {
      // Step 1: Validate and gather data
      const validation = await this.validateAndPrepare(input)
      if (!validation.success) {
        return validation
      }
      const data = validation.data!

      // Step 2: Check if gift code covers full amount (redirect to gift-only flow)
      if (input.giftCode && data.amountToChargeCents === 0) {
        return {
          success: true,
          giftOnlyCheckout: true,
          giftOnlyData: {
            classId: input.classId,
            sessionIds: data.sessionIds,
            firstName: input.customer.firstName,
            lastName: input.customer.lastName,
            email: input.customer.email,
            phone: input.customer.phone,
            numberOfPeople: input.numberOfPeople,
            locale: input.locale,
            giftCode: input.giftCode,
            giftDiscountCents: data.giftDiscountCents,
            totalPriceCents: data.totalPriceCents,
            bookingType: data.bookingType,
          },
        }
      }

      // Step 3: Reserve capacity
      const capacityResult = await this.capacityService.reserveSpots(
        data.sessionIds,
        input.numberOfPeople
      )
      if (!capacityResult.success) {
        return {
          success: false,
          error: capacityResult.error || 'Not enough capacity available',
          status: 409,
        }
      }

      // Step 4: Reserve gift code if applicable
      if (input.giftCode && data.giftDiscountCents > 0) {
        const reserveCodeResult = await this.giftService.reserveCode(
          input.giftCode,
          data.giftDiscountCents
        )
        if (!reserveCodeResult.success) {
          await this.capacityService.releaseSpots(data.sessionIds, input.numberOfPeople)
          return {
            success: false,
            error: reserveCodeResult.error || 'Gift code validation failed',
            status: 409,
          }
        }
      }

      // Step 5: Create pending booking
      let booking: Booking
      try {
        booking = await this.createPendingBooking(input, data)
      } catch (error) {
        // Rollback reservations
        await this.capacityService.releaseSpots(data.sessionIds, input.numberOfPeople)
        if (input.giftCode && data.giftDiscountCents > 0) {
          await this.giftService.releaseCode(input.giftCode, data.giftDiscountCents)
        }
        throw error
      }

      // Step 6: Create Stripe checkout session
      const stripeResult = await this.createStripeSession(booking, input, data)
      if (!stripeResult.success) {
        // Note: booking exists but Stripe failed - it will expire via cron
        return {
          success: false,
          error: stripeResult.error || 'Failed to create checkout session',
          status: 500,
        }
      }

      // Step 7: Update booking with Stripe session ID
      await this.payload.update({
        collection: 'bookings',
        id: booking.id,
        data: { stripePaymentIntentId: stripeResult.sessionId },
      })

      logInfo('Checkout session created', {
        bookingId: booking.id,
        stripeSessionId: stripeResult.sessionId,
        amountCents: data.amountToChargeCents,
      })

      return {
        success: true,
        checkoutUrl: stripeResult.checkoutUrl,
        bookingId: booking.id,
      }
    } catch (error) {
      logError('Checkout failed', error)
      return {
        success: false,
        error: 'Checkout failed',
        status: 500,
      }
    }
  }

  /**
   * Complete a gift-only checkout (no Stripe payment needed).
   * Called when gift code covers the full amount.
   */
  async completeGiftOnlyCheckout(data: GiftOnlyCheckoutData): Promise<CheckoutResult> {
    const {
      classId,
      sessionIds,
      firstName,
      lastName,
      email,
      phone,
      numberOfPeople,
      locale,
      giftCode,
      giftDiscountCents,
      totalPriceCents,
      bookingType,
    } = data

    try {
      // Re-validate the gift code
      const discountResult = await this.giftService.calculateDiscount(giftCode, totalPriceCents)
      if ('error' in discountResult) {
        return { success: false, error: discountResult.error, status: 400 }
      }
      if (discountResult.remainingToPayCents > 0) {
        return {
          success: false,
          error: 'Gift code no longer covers the full amount. Please use regular checkout.',
          status: 400,
        }
      }

      // Validate class exists
      const classDoc = await this.payload.findByID({
        collection: 'classes',
        id: classId,
        depth: 1,
      })
      if (!classDoc) {
        return { success: false, error: 'Class not found', status: 404 }
      }

      // Reserve capacity
      const capacityResult = await this.capacityService.reserveSpots(sessionIds, numberOfPeople)
      if (!capacityResult.success) {
        return {
          success: false,
          error: capacityResult.error || 'Not enough capacity available',
          status: 409,
        }
      }

      // Reserve gift code
      const reserveCodeResult = await this.giftService.reserveCode(giftCode, giftDiscountCents)
      if (!reserveCodeResult.success) {
        await this.capacityService.releaseSpots(sessionIds, numberOfPeople)
        return {
          success: false,
          error: reserveCodeResult.error || 'Gift code validation failed',
          status: 409,
        }
      }

      // Create confirmed booking
      let booking: Booking
      try {
        booking = (await this.payload.create({
          collection: 'bookings',
          data: {
            bookingType,
            sessions: sessionIds,
            firstName,
            lastName,
            email,
            phone,
            numberOfPeople,
            status: 'confirmed',
            paymentStatus: 'paid',
            bookingDate: new Date().toISOString(),
            giftCertificateCode: giftCode,
            giftCertificateAmountCents: giftDiscountCents,
            stripeAmountCents: 0,
            originalPriceCents: totalPriceCents,
          },
        })) as Booking

        // Apply gift code (record usage)
        const applyResult = await this.giftService.applyCode({
          code: giftCode,
          bookingId: booking.id,
          amountCents: giftDiscountCents,
          skipBalanceDeduction: true,
        })

        if (!applyResult.success) {
          logError('Failed to apply gift code after booking', new Error(applyResult.error || 'Unknown'), {
            bookingId: booking.id,
            giftCode,
          })
        }

        logInfo('Gift-only booking confirmed', {
          bookingId: booking.id,
          giftCode,
          giftDiscountCents,
          bookingType,
        })

        return {
          success: true,
          confirmed: true,
          bookingId: booking.id,
          redirectUrl: `/${locale}/booking/success?booking_id=${booking.id}`,
        }
      } catch (error) {
        // Rollback
        await this.capacityService.releaseSpots(sessionIds, numberOfPeople)
        await this.giftService.releaseCode(giftCode, giftDiscountCents)
        throw error
      }
    } catch (error) {
      logError('Gift-only checkout failed', error)
      return {
        success: false,
        error: 'Failed to complete gift-only checkout',
        status: 500,
      }
    }
  }

  /**
   * Validate input and prepare checkout data.
   */
  private async validateAndPrepare(
    input: CheckoutInput
  ): Promise<{ success: true; data: ValidatedCheckoutData } | { success: false; error: string; status: number }> {
    const { classId, sessionId, numberOfPeople, giftCode } = input

    // Fetch class
    const classDoc = await this.payload.findByID({
      collection: 'classes',
      id: classId,
      depth: 1,
    })

    if (!classDoc) {
      return { success: false, error: 'Class not found', status: 404 }
    }

    if (!classDoc.isPublished) {
      return { success: false, error: 'This offering is not available', status: 400 }
    }

    // Determine sessions based on class type
    let sessions: Session[]
    const bookingType = classDoc.type as 'class' | 'course'

    if (bookingType === 'course') {
      const allSessions = await this.payload.find({
        collection: 'sessions',
        where: {
          class: { equals: classId },
          status: { equals: 'scheduled' },
        },
        limit: 100,
      })

      if (allSessions.docs.length === 0) {
        return { success: false, error: 'No sessions available for this course', status: 400 }
      }

      sessions = allSessions.docs as Session[]
    } else {
      if (!sessionId) {
        return { success: false, error: 'sessionId is required for class bookings', status: 400 }
      }

      const sessionDoc = await this.payload.findByID({
        collection: 'sessions',
        id: sessionId,
        depth: 0,
      })

      if (!sessionDoc) {
        return { success: false, error: 'Session not found', status: 404 }
      }

      if (sessionDoc.status === 'cancelled') {
        return { success: false, error: 'This session has been cancelled', status: 400 }
      }

      const sessionClassId = typeof sessionDoc.class === 'object' ? sessionDoc.class.id : sessionDoc.class
      if (sessionClassId !== classId) {
        return { success: false, error: 'Session does not belong to this class', status: 400 }
      }

      sessions = [sessionDoc as Session]
    }

    const sessionIds = sessions.map((s) => s.id)

    // Calculate pricing
    const totalPriceCents = (classDoc.priceCents || 0) * numberOfPeople
    const currency = classDoc.currency || 'eur'

    // Calculate gift discount
    let giftDiscountCents = 0
    let amountToChargeCents = totalPriceCents

    if (giftCode) {
      const discountResult = await this.giftService.calculateDiscount(giftCode, totalPriceCents)
      if ('error' in discountResult) {
        return { success: false, error: discountResult.error, status: 400 }
      }
      giftDiscountCents = discountResult.discountCents
      amountToChargeCents = discountResult.remainingToPayCents
    }

    return {
      success: true,
      data: {
        classDoc: classDoc as Class,
        sessions,
        sessionIds,
        bookingType,
        totalPriceCents,
        currency,
        giftDiscountCents,
        amountToChargeCents,
      },
    }
  }

  /**
   * Create a pending booking.
   */
  private async createPendingBooking(
    input: CheckoutInput,
    data: ValidatedCheckoutData
  ): Promise<Booking> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    return (await this.payload.create({
      collection: 'bookings',
      data: {
        bookingType: data.bookingType,
        sessions: data.sessionIds,
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        email: input.customer.email,
        phone: input.customer.phone,
        numberOfPeople: input.numberOfPeople,
        status: 'pending',
        paymentStatus: 'unpaid',
        bookingDate: new Date().toISOString(),
        expiresAt,
        giftCertificateCode: input.giftCode || undefined,
        giftCertificateAmountCents: data.giftDiscountCents || undefined,
        originalPriceCents: data.totalPriceCents,
      },
    })) as Booking
  }

  /**
   * Create Stripe checkout session.
   */
  private async createStripeSession(
    booking: Booking,
    input: CheckoutInput,
    data: ValidatedCheckoutData
  ): Promise<{ success: true; checkoutUrl: string; sessionId: string } | { success: false; error: string }> {
    try {
      const stripe = getStripe()
      const siteUrl = process.env.SITE_URL || 'http://localhost:3000'
      const messages = getMessages(input.locale as Locale)

      // Localized date format
      const dateLocale = input.locale === 'es' ? 'es-ES' : 'en-US'
      const peopleLabel = input.numberOfPeople === 1 ? messages.common.person : messages.common.people

      // Build description
      let description: string
      if (data.bookingType === 'course') {
        description = `${messages.course.fullEnrollment} - ${data.sessions.length} ${messages.common.sessions}, ${input.numberOfPeople} ${peopleLabel}`
      } else {
        const firstSession = data.sessions[0]
        const startDateTime = new Date(firstSession.startDateTime)
        const sessionDate = startDateTime.toLocaleDateString(dateLocale, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
        const sessionTime = startDateTime.toLocaleTimeString(dateLocale, {
          hour: '2-digit',
          minute: '2-digit',
        })
        description = `${sessionDate}, ${sessionTime} - ${input.numberOfPeople} ${peopleLabel}`
      }

      // Add discount info
      if (data.giftDiscountCents > 0) {
        const discountFormatted = (data.giftDiscountCents / 100).toFixed(2)
        description += ` (${messages.giftCode.discountApplied}: €${discountFormatted})`
      }

      const classTitle = (data.classDoc.title as string) || 'Booking'

      const stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: data.currency.toLowerCase(),
              product_data: {
                name: classTitle,
                description,
              },
              unit_amount: data.amountToChargeCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${siteUrl}/${input.locale}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/${input.locale}/booking/cancel?session_id={CHECKOUT_SESSION_ID}`,
        customer_email: input.customer.email,
        metadata: {
          bookingId: booking.id.toString(),
          bookingType: data.bookingType,
          classId: input.classId.toString(),
          sessionIds: data.sessionIds.join(','),
          firstName: input.customer.firstName,
          lastName: input.customer.lastName,
          phone: input.customer.phone,
          numberOfPeople: input.numberOfPeople.toString(),
          locale: input.locale,
          giftCode: input.giftCode || '',
          giftDiscountCents: data.giftDiscountCents.toString(),
          originalPriceCents: data.totalPriceCents.toString(),
        },
      })

      return {
        success: true,
        checkoutUrl: stripeSession.url || '',
        sessionId: stripeSession.id,
      }
    } catch (error) {
      logError('Failed to create Stripe session', error)
      return { success: false, error: 'Failed to create checkout session' }
    }
  }
}

/**
 * Factory function to create a CheckoutService instance.
 */
export function createCheckoutService(payload: Payload): CheckoutService {
  return new CheckoutService(payload)
}

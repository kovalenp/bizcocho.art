import type { Payload } from 'payload'
import type { Booking } from '../payload-types'
import { createCapacityService, CapacityService } from './capacity'
import { logError, logInfo } from '../lib/logger'

export type CreateBookingParams = {
  bookingType: 'class' | 'course'
  sessionIds: number[]
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
  expiresAt?: string
  giftCertificateCode?: string
  giftCertificateAmountCents?: number
  originalPriceCents?: number
}

export type CreateBookingResult = {
  success: boolean
  error?: string
  booking?: Booking
}

export type ConfirmBookingResult = {
  success: boolean
  error?: string
  booking?: Booking
}

export type CancelBookingResult = {
  success: boolean
  error?: string
}

export type StatusChangeResult = {
  capacityChanged: boolean
  capacityDelta: number
}

/**
 * Centralized service for managing booking lifecycle.
 * Handles creation, confirmation, cancellation, and expiration cleanup.
 */
export class BookingService {
  private capacityService: CapacityService

  constructor(private payload: Payload) {
    this.capacityService = createCapacityService(payload)
  }

  /**
   * Create a pending booking with session capacity reserved.
   * Capacity is reserved immediately at checkout time.
   */
  async createPendingBooking(params: CreateBookingParams): Promise<CreateBookingResult> {
    const {
      bookingType,
      sessionIds,
      firstName,
      lastName,
      email,
      phone,
      numberOfPeople,
      expiresAt,
      giftCertificateCode,
      giftCertificateAmountCents,
      originalPriceCents,
    } = params

    try {
      // Reserve capacity first
      const reserveResult = await this.capacityService.reserveSpots(sessionIds, numberOfPeople)
      if (!reserveResult.success) {
        return { success: false, error: reserveResult.error }
      }

      // Create the booking
      const defaultExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

      let booking: Booking
      try {
        booking = await this.payload.create({
          collection: 'bookings',
          data: {
            bookingType,
            sessions: sessionIds,
            firstName,
            lastName,
            email,
            phone,
            numberOfPeople,
            status: 'pending',
            paymentStatus: 'unpaid',
            bookingDate: new Date().toISOString(),
            expiresAt: expiresAt || defaultExpiry,
            giftCertificateCode,
            giftCertificateAmountCents,
            originalPriceCents,
          },
        }) as Booking
      } catch (error) {
        // Rollback capacity if booking creation fails
        await this.capacityService.releaseSpots(sessionIds, numberOfPeople)
        throw error
      }

      logInfo('Created pending booking', {
        bookingId: booking.id,
        bookingType,
        sessionCount: sessionIds.length,
        numberOfPeople,
      })

      return { success: true, booking }
    } catch (error) {
      logError('Failed to create booking', error, params)
      return { success: false, error: 'Failed to create booking' }
    }
  }

  /**
   * Confirm a booking after successful payment.
   * Updates status and paymentStatus, optionally stores Stripe payment intent.
   */
  async confirmBooking(
    bookingId: number,
    paymentIntentId?: string,
    additionalData?: Record<string, unknown>
  ): Promise<ConfirmBookingResult> {
    try {
      // Check if already confirmed (idempotency)
      const existingBooking = await this.payload.findByID({
        collection: 'bookings',
        id: bookingId,
      })

      if (!existingBooking) {
        return { success: false, error: 'Booking not found' }
      }

      if (existingBooking.paymentStatus === 'paid') {
        logInfo('Booking already paid, skipping confirmation', { bookingId })
        return { success: true, booking: existingBooking as Booking }
      }

      const updateData: Record<string, unknown> = {
        status: 'confirmed',
        paymentStatus: 'paid',
        expiresAt: null, // Clear expiration
        ...additionalData,
      }

      if (paymentIntentId) {
        updateData.stripePaymentIntentId = paymentIntentId
      }

      const booking = await this.payload.update({
        collection: 'bookings',
        id: bookingId,
        data: updateData,
      }) as Booking

      logInfo('Booking confirmed', { bookingId, paymentIntentId })

      return { success: true, booking }
    } catch (error) {
      logError('Failed to confirm booking', error, { bookingId })
      return { success: false, error: 'Failed to confirm booking' }
    }
  }

  /**
   * Cancel a booking and release capacity.
   * Works for both pending and confirmed bookings.
   */
  async cancelBooking(bookingId: number): Promise<CancelBookingResult> {
    try {
      const booking = await this.payload.findByID({
        collection: 'bookings',
        id: bookingId,
        depth: 0,
      })

      if (!booking) {
        return { success: false, error: 'Booking not found' }
      }

      if (booking.status === 'cancelled') {
        logInfo('Booking already cancelled', { bookingId })
        return { success: true }
      }

      // Get session IDs
      const sessionIds = this.extractSessionIds(booking.sessions)
      const numberOfPeople = booking.numberOfPeople || 0

      // Update booking status to cancelled
      await this.payload.update({
        collection: 'bookings',
        id: bookingId,
        data: {
          status: 'cancelled',
        },
      })

      // Release capacity
      if (sessionIds.length > 0 && numberOfPeople > 0) {
        await this.capacityService.releaseSpots(sessionIds, numberOfPeople)
      }

      logInfo('Booking cancelled', { bookingId, sessionCount: sessionIds.length, numberOfPeople })

      return { success: true }
    } catch (error) {
      logError('Failed to cancel booking', error, { bookingId })
      return { success: false, error: 'Failed to cancel booking' }
    }
  }

  /**
   * Handle expired pending bookings.
   * Called by cron job to cleanup unpaid bookings and release capacity.
   */
  async handleExpiredBookings(): Promise<{ processed: number; errors: number }> {
    let processed = 0
    let errors = 0

    try {
      const now = new Date().toISOString()

      // Find all pending bookings that have expired
      const expiredBookings = await this.payload.find({
        collection: 'bookings',
        where: {
          status: { equals: 'pending' },
          expiresAt: { less_than: now },
        },
        limit: 100,
      })

      for (const booking of expiredBookings.docs) {
        try {
          const sessionIds = this.extractSessionIds(booking.sessions)
          const numberOfPeople = booking.numberOfPeople || 0

          // Delete the booking
          await this.payload.delete({
            collection: 'bookings',
            id: booking.id,
          })

          // Release capacity
          if (sessionIds.length > 0 && numberOfPeople > 0) {
            await this.capacityService.releaseSpots(sessionIds, numberOfPeople)
          }

          processed++
          logInfo('Expired booking cleaned up', { bookingId: booking.id })
        } catch (error) {
          errors++
          logError('Failed to cleanup expired booking', error, { bookingId: booking.id })
        }
      }

      if (processed > 0 || errors > 0) {
        logInfo('Expired bookings cleanup complete', { processed, errors })
      }

      return { processed, errors }
    } catch (error) {
      logError('Failed to process expired bookings', error)
      return { processed, errors: errors + 1 }
    }
  }

  /**
   * Handle booking status changes from collection hooks.
   * Manages capacity adjustments based on status transitions.
   */
  async handleStatusChange(
    doc: Booking,
    previousDoc: Booking | null | undefined
  ): Promise<StatusChangeResult> {
    const result: StatusChangeResult = {
      capacityChanged: false,
      capacityDelta: 0,
    }

    const sessionIds = this.extractSessionIds(doc.sessions)
    if (sessionIds.length === 0) {
      return result
    }

    const numberOfPeople = doc.numberOfPeople || 0
    const previousPeople = previousDoc?.numberOfPeople || 0

    const wasConfirmed = previousDoc?.status === 'confirmed'
    const wasPending = previousDoc?.status === 'pending'
    const isConfirmed = doc.status === 'confirmed'
    const isCancelled = doc.status === 'cancelled'

    let capacityDelta = 0

    if ((wasConfirmed || wasPending) && isCancelled) {
      // Cancelled: restore capacity
      capacityDelta = previousPeople
    } else if (wasConfirmed && isConfirmed && numberOfPeople !== previousPeople) {
      // Changed number of people on confirmed booking
      capacityDelta = previousPeople - numberOfPeople
    }
    // Note: pending → confirmed does NOT change capacity because
    // the checkout API already reserved the spots

    if (capacityDelta !== 0) {
      if (capacityDelta > 0) {
        await this.capacityService.releaseSpots(sessionIds, capacityDelta)
      } else {
        const reserveResult = await this.capacityService.reserveSpots(sessionIds, Math.abs(capacityDelta))
        if (!reserveResult.success) {
          logError('Failed to reserve additional spots', new Error(reserveResult.error || 'Unknown'), {
            bookingId: doc.id,
            capacityDelta,
          })
        }
      }

      logInfo('Capacity adjusted for booking', {
        bookingId: doc.id,
        capacityDelta,
        sessionCount: sessionIds.length,
      })

      result.capacityChanged = true
      result.capacityDelta = capacityDelta
    }

    return result
  }

  /**
   * Extract session IDs from booking sessions field.
   * Handles both ID arrays and populated session objects.
   */
  private extractSessionIds(sessions: Booking['sessions']): number[] {
    if (!sessions || !Array.isArray(sessions)) {
      return []
    }

    return sessions.map((s) => {
      if (typeof s === 'object' && s !== null && 'id' in s) {
        return s.id as number
      }
      return s as number
    })
  }
}

/**
 * Factory function to create a BookingService instance.
 */
export function createBookingService(payload: Payload): BookingService {
  return new BookingService(payload)
}

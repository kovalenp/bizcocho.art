import type { CollectionAfterChangeHook, CollectionBeforeValidateHook } from 'payload'
import type { Booking } from '../../payload-types'
import { createBookingService } from '../../services/booking'
import { createNotificationService } from '../../services/notifications'
import { logInfo } from '../../lib/logger'

/**
 * Validates booking data before save.
 * - Ensures at least one session is present
 * - Auto-sets bookingType based on session's parent class type
 */
export const beforeValidateBooking: CollectionBeforeValidateHook<Booking> = async ({
  data,
  operation,
  req,
}) => {
  if (operation === 'create' || operation === 'update') {
    // Validation: Must have at least one session
    const sessions = data?.sessions
    if (!sessions || (Array.isArray(sessions) && sessions.length === 0)) {
      throw new Error('Booking must include at least one session')
    }

    // Auto-set bookingType based on first session's parent class type
    if (Array.isArray(sessions) && sessions.length > 0 && req?.payload) {
      const firstSessionId = typeof sessions[0] === 'object' ? sessions[0].id : sessions[0]

      try {
        const session = await req.payload.findByID({
          collection: 'sessions',
          id: firstSessionId,
          depth: 0,
        })

        if (session?.sessionType) {
          data.bookingType = session.sessionType // 'class' or 'course'
        }
      } catch {
        // Session lookup failed, keep existing bookingType
      }
    }
  }

  return data
}

/**
 * Handles booking changes after save.
 * - Delegates capacity management to BookingService
 * - Sends confirmation notification when status changes to 'confirmed'
 */
export const afterChangeBooking: CollectionAfterChangeHook<Booking> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  // Handle capacity changes on update
  if (operation === 'update') {
    const bookingService = createBookingService(req.payload)
    await bookingService.handleStatusChange(doc, previousDoc as Booking | null)
  }

  // Send confirmation notification when booking is confirmed
  const wasConfirmed = previousDoc?.status !== 'confirmed' && doc.status === 'confirmed'
  const wasPaid = previousDoc?.paymentStatus !== 'paid' && doc.paymentStatus === 'paid'

  if (wasConfirmed || wasPaid) {
    // Only send notification if both confirmed AND paid
    if (doc.status === 'confirmed' && doc.paymentStatus === 'paid') {
      logInfo('Booking confirmed and paid, sending notification', { bookingId: doc.id })

      const notificationService = createNotificationService(req.payload)
      // Fire and forget - don't block the response
      notificationService.sendBookingConfirmation(doc.id, {
        locale: 'en', // TODO: Get locale from booking metadata or user preference
      }).catch(() => {
        // Error already logged in notification service
      })
    }
  }

  return doc
}

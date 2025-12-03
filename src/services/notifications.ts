import type { Payload } from 'payload'
import type { Booking, Class, Session, GiftCertificate } from '../payload-types'
import {
  sendBookingConfirmationEmail,
  sendCourseConfirmationEmail,
  sendGiftCertificateToRecipient,
  sendGiftCertificatePurchaseConfirmation,
} from '../lib/email'
import { logError, logInfo } from '../lib/logger'

export type Locale = 'en' | 'es'
export type NotificationChannel = 'email' | 'sms'

export type NotificationOptions = {
  locale?: Locale
  channels?: NotificationChannel[]
}

const DEFAULT_OPTIONS: Required<NotificationOptions> = {
  locale: 'en',
  channels: ['email'],
}

/**
 * Service for managing notifications (email, SMS, etc).
 * Decouples notification logic from business logic services.
 */
export class NotificationService {
  constructor(private payload: Payload) {}

  /**
   * Send booking confirmation notification.
   * Fetches necessary data (class, sessions) and sends via configured channels.
   */
  async sendBookingConfirmation(bookingId: number, options: NotificationOptions = {}): Promise<void> {
    const { locale, channels } = { ...DEFAULT_OPTIONS, ...options }

    try {
      const booking = await this.payload.findByID({
        collection: 'bookings',
        id: bookingId,
        depth: 2,
      }) as Booking

      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`)
      }

      const sessions = booking.sessions as Session[]
      if (!sessions || sessions.length === 0) {
        throw new Error('No sessions found for booking')
      }

      // Get class document
      const firstSession = sessions[0]
      let classDoc: Class
      if (typeof firstSession.class === 'object') {
        classDoc = firstSession.class as Class
      } else {
        classDoc = await this.payload.findByID({
          collection: 'classes',
          id: firstSession.class,
        }) as Class
      }

      // Send via each channel
      if (channels.includes('email')) {
        await this.sendBookingConfirmationEmail(booking, classDoc, sessions, locale)
      }

      if (channels.includes('sms')) {
        await this.sendBookingConfirmationSMS(booking, classDoc, locale)
      }
    } catch (error) {
      logError('Failed to send booking confirmation', error, { bookingId })
      // Don't rethrow - notifications are non-critical
    }
  }

  private async sendBookingConfirmationEmail(
    booking: Booking,
    classDoc: Class,
    sessions: Session[],
    locale: Locale
  ): Promise<void> {
    if (booking.bookingType === 'course') {
      await sendCourseConfirmationEmail({
        booking,
        classDoc,
        sessions,
        locale,
      })
    } else {
      await sendBookingConfirmationEmail({
        booking,
        session: sessions[0],
        locale,
      })
    }
    logInfo('Booking confirmation email sent', { bookingId: booking.id })
  }

  private async sendBookingConfirmationSMS(
    booking: Booking,
    _classDoc: Class,
    _locale: Locale
  ): Promise<void> {
    // TODO: Implement SMS via Twilio or similar
    logInfo('SMS notification skipped (not implemented)', {
      bookingId: booking.id,
      phone: booking.phone,
    })
  }

  /**
   * Send gift certificate activation notifications (recipient + purchaser).
   */
  async sendGiftCertificateActivation(
    giftCertificateId: number,
    options: NotificationOptions = {}
  ): Promise<void> {
    const { locale, channels } = { ...DEFAULT_OPTIONS, ...options }

    try {
      const cert = await this.payload.findByID({
        collection: 'gift-certificates',
        id: giftCertificateId,
      }) as GiftCertificate

      if (!cert) {
        throw new Error(`Gift certificate ${giftCertificateId} not found`)
      }

      if (channels.includes('email')) {
        await this.sendGiftCertificateEmails(cert, locale)
      }

      if (channels.includes('sms')) {
        await this.sendGiftCertificateSMS(cert, locale)
      }
    } catch (error) {
      logError('Failed to send gift certificate notifications', error, { giftCertificateId })
      // Don't rethrow - notifications are non-critical
    }
  }

  private async sendGiftCertificateEmails(cert: GiftCertificate, locale: Locale): Promise<void> {
    const purchaserName = `${cert.purchaser?.firstName || ''} ${cert.purchaser?.lastName || ''}`.trim()

    // Send to recipient
    await sendGiftCertificateToRecipient({
      code: cert.code,
      amountCents: cert.initialValueCents || 0,
      currency: cert.currency || 'eur',
      expiresAt: cert.expiresAt || '',
      recipientEmail: cert.recipient?.email || '',
      recipientName: cert.recipient?.name || '',
      personalMessage: cert.recipient?.personalMessage || '',
      purchaserName,
      locale,
    })

    // Send confirmation to purchaser
    await sendGiftCertificatePurchaseConfirmation({
      code: cert.code,
      amountCents: cert.initialValueCents || 0,
      currency: cert.currency || 'eur',
      purchaserEmail: cert.purchaser?.email || '',
      purchaserName,
      recipientEmail: cert.recipient?.email || '',
      recipientName: cert.recipient?.name || '',
      locale,
    })

    logInfo('Gift certificate emails sent', { giftCertificateId: cert.id })
  }

  private async sendGiftCertificateSMS(cert: GiftCertificate, _locale: Locale): Promise<void> {
    // TODO: Implement SMS via Twilio or similar
    logInfo('SMS notification skipped (not implemented)', {
      giftCertificateId: cert.id,
      recipientPhone: cert.recipient?.email, // Would need phone field
    })
  }
}

/**
 * Factory function to create a NotificationService instance.
 */
export function createNotificationService(payload: Payload): NotificationService {
  return new NotificationService(payload)
}

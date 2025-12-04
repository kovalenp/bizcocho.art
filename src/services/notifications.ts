import type { Payload } from 'payload'
import type { Booking, Class, Session, GiftCertificate } from '../payload-types'
import { render } from '@react-email/render'
import { sendEmail } from '../lib/email'
import { logError, logInfo } from '../lib/logger'
import {
  BookingConfirmation,
  CourseConfirmation,
  GiftCertificateRecipient,
  GiftCertificatePurchase,
} from '../emails/templates'
import {
  bookingConfirmationTranslations,
  courseConfirmationTranslations,
  giftCertificateRecipientTranslations,
  giftCertificatePurchaseTranslations,
} from '../emails/translations'
import type { Locale } from '../i18n/config'

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
 * Custom error for email rendering failures.
 */
export class EmailRenderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'EmailRenderError'
  }
}

/**
 * Service for managing notifications (email, SMS, etc).
 * Decouples notification logic from business logic services.
 */
export class NotificationService {
  constructor(private payload: Payload) {}

  /**
   * Render a React Email template to HTML and plaintext.
   */
  private async renderTemplate(
    element: React.ReactElement
  ): Promise<{ html: string; text: string }> {
    try {
      const html = await render(element)
      const text = await render(element, { plainText: true })
      return { html, text }
    } catch (error) {
      logError('Failed to render email template', error)
      throw new EmailRenderError('Failed to render email template', error)
    }
  }

  /**
   * Send booking confirmation notification.
   * Fetches necessary data (class, sessions) and sends via configured channels.
   */
  async sendBookingConfirmation(
    bookingId: number,
    options: NotificationOptions = {}
  ): Promise<void> {
    const { locale, channels } = { ...DEFAULT_OPTIONS, ...options }

    try {
      const booking = (await this.payload.findByID({
        collection: 'bookings',
        id: bookingId,
        depth: 2,
        locale,
      })) as Booking

      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`)
      }

      const sessions = booking.sessions as Session[]
      if (!sessions || sessions.length === 0) {
        throw new Error('No sessions found for booking')
      }

      // Get class document with locale for translated title
      const firstSession = sessions[0]
      const classId = typeof firstSession.class === 'object' ? firstSession.class.id : firstSession.class
      const classDoc = (await this.payload.findByID({
        collection: 'classes',
        id: classId,
        locale,
      })) as Class

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
    const t =
      booking.bookingType === 'course'
        ? courseConfirmationTranslations[locale]
        : bookingConfirmationTranslations[locale]

    // Calculate common values
    const pricePerPerson = (classDoc.priceCents || 0) / 100
    const totalPrice = pricePerPerson * booking.numberOfPeople
    const currency = classDoc.currency === 'eur' ? '€' : '$'
    const formattedPrice = `${currency}${totalPrice.toFixed(2)}`
    const location = (classDoc.location as string) || 'TBD'

    if (booking.bookingType === 'course') {
      // Course confirmation
      const sessionInfos = sessions.map((session) => {
        const startDateTime = new Date(session.startDateTime)
        return {
          date: startDateTime.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          time: startDateTime.toLocaleTimeString(locale === 'es' ? 'es-ES' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }
      })

      const { html, text } = await this.renderTemplate(
        CourseConfirmation({
          courseTitle: (classDoc.title as string) || 'Course',
          sessions: sessionInfos,
          location,
          numberOfPeople: booking.numberOfPeople,
          totalPrice: formattedPrice,
          bookingId: booking.id,
          locale,
        })
      )

      await sendEmail({
        to: booking.email,
        subject: t.subject,
        html,
        text,
      })
    } else {
      // Single session confirmation
      const firstSession = sessions[0]
      const startDateTime = new Date(firstSession.startDateTime)

      const sessionDate = startDateTime.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      const sessionTime = startDateTime.toLocaleTimeString(locale === 'es' ? 'es-ES' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })

      const { html, text } = await this.renderTemplate(
        BookingConfirmation({
          classTitle: (classDoc.title as string) || 'Class',
          sessionDate,
          sessionTime,
          location,
          numberOfPeople: booking.numberOfPeople,
          totalPrice: formattedPrice,
          bookingId: booking.id,
          locale,
        })
      )

      await sendEmail({
        to: booking.email,
        subject: t.subject,
        html,
        text,
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
      const cert = (await this.payload.findByID({
        collection: 'gift-certificates',
        id: giftCertificateId,
      })) as GiftCertificate

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
    const purchaserName =
      `${cert.purchaser?.firstName || ''} ${cert.purchaser?.lastName || ''}`.trim()
    const recipientEmail = cert.recipient?.email
    const purchaserEmail = cert.purchaser?.email

    const currencySymbol = cert.currency === 'eur' ? '€' : '$'
    const formattedAmount = `${currencySymbol}${((cert.initialValueCents || 0) / 100).toFixed(2)}`
    const formattedExpiry = new Date(cert.expiresAt || '').toLocaleDateString(
      locale === 'es' ? 'es-ES' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' }
    )

    // Send to recipient
    if (recipientEmail) {
      const t = giftCertificateRecipientTranslations[locale]

      const { html, text } = await this.renderTemplate(
        GiftCertificateRecipient({
          code: cert.code,
          formattedAmount,
          formattedExpiry,
          purchaserName: purchaserName || undefined,
          personalMessage: cert.recipient?.personalMessage || undefined,
          locale,
        })
      )

      await sendEmail({
        to: recipientEmail,
        subject: t.subject,
        html,
        text,
      })
    } else {
      logInfo('Skipping recipient email (no email provided)', { giftCertificateId: cert.id })
    }

    // Send confirmation to purchaser
    if (purchaserEmail) {
      const t = giftCertificatePurchaseTranslations[locale]
      const recipientDisplay = cert.recipient?.name
        ? `${cert.recipient.name} (${recipientEmail || ''})`
        : recipientEmail || ''

      const { html, text } = await this.renderTemplate(
        GiftCertificatePurchase({
          code: cert.code,
          formattedAmount,
          recipientDisplay,
          locale,
        })
      )

      await sendEmail({
        to: purchaserEmail,
        subject: t.subject,
        html,
        text,
      })
    } else {
      logInfo('Skipping purchaser email (no email provided)', { giftCertificateId: cert.id })
    }

    logInfo('Gift certificate emails processed', { giftCertificateId: cert.id })
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

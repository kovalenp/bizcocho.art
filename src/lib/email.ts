import nodemailer from 'nodemailer'
import { logError, logWarn } from './logger'
import type { Booking, Class, Session } from '@/payload-types'

type BookingWithRelations = Booking & {
  session?: any
}

interface SendBookingConfirmationEmailParams {
  booking: BookingWithRelations
  session: any
  locale: 'en' | 'es'
}

interface SendCourseConfirmationEmailParams {
  booking: Booking
  classDoc: Class
  sessions: Session[]
  locale: 'en' | 'es'
}

interface SendGiftCertificateToRecipientParams {
  code: string
  amountCents: number
  currency: string
  expiresAt: string
  recipientEmail: string
  recipientName: string
  personalMessage: string
  purchaserName: string
  locale: 'en' | 'es'
}

interface SendGiftCertificatePurchaseConfirmationParams {
  code: string
  amountCents: number
  currency: string
  purchaserEmail: string
  purchaserName: string
  recipientEmail: string
  recipientName: string
  locale: 'en' | 'es'
}

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: false, // Use TLS
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
})

/**
 * Helper to send email with retry logic.
 * Retries 3 times with exponential backoff (1s, 2s, 4s).
 */
async function sendMailWithRetry(mailOptions: nodemailer.SendMailOptions): Promise<void> {
  const maxRetries = 3
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      await transporter.sendMail(mailOptions)
      return
    } catch (error) {
      attempt++
      const isLastAttempt = attempt === maxRetries
      const delay = 1000 * Math.pow(2, attempt - 1)

      if (isLastAttempt) {
        logError('Failed to send email after retries', error, {
          to: mailOptions.to,
          subject: mailOptions.subject,
          attempt,
        })
        throw error
      } else {
        logWarn(`Email send failed, retrying in ${delay}ms...`, {
          attempt,
          error: error instanceof Error ? error.message : error,
        })
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
}

export async function sendBookingConfirmationEmail({
  booking,
  session,  // Changed from classSession
  locale = 'en',
}: SendBookingConfirmationEmailParams): Promise<void> {
  const classDoc = typeof session.class === 'object'
    ? session.class
    : null

  if (!classDoc) {
    throw new Error('Class not found')
  }

  // Get localized class title
  const classTitle = (classDoc.title as string) || 'Class'

  // Format date and time
  const startDateTime = new Date(session.startDateTime)
  const sessionDate = startDateTime.toLocaleDateString(
    locale === 'es' ? 'es-ES' : 'en-US',
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  )

  const sessionTime = startDateTime.toLocaleTimeString(
    locale === 'es' ? 'es-ES' : 'en-US',
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  )

  // Get location
  const location = (classDoc.location as string) || 'TBD'

  // Calculate total price
  const pricePerPerson = (classDoc.priceCents || 0) / 100
  const totalPrice = pricePerPerson * booking.numberOfPeople
  const currency = classDoc.currency === 'eur' ? '€' : '$'

  // Translations
  const translations = {
    en: {
      subject: 'Booking Confirmation - bizcocho.art',
      title: 'Booking Confirmed!',
      intro: 'Thank you for your booking. Here are your class details:',
      classLabel: 'Class',
      dateLabel: 'Date',
      timeLabel: 'Time',
      locationLabel: 'Location',
      attendeesLabel: 'Number of Attendees',
      priceLabel: 'Total Price',
      bookingRefLabel: 'Booking Reference',
      footer: 'We look forward to seeing you! If you have any questions, please contact us.',
      cancellationPolicy: 'Cancellation policy: Please contact us at least 48 hours before the class to cancel or reschedule.',
    },
    es: {
      subject: 'Confirmación de Reserva - bizcocho.art',
      title: '¡Reserva Confirmada!',
      intro: 'Gracias por tu reserva. Aquí están los detalles de tu clase:',
      classLabel: 'Clase',
      dateLabel: 'Fecha',
      timeLabel: 'Hora',
      locationLabel: 'Ubicación',
      attendeesLabel: 'Número de Asistentes',
      priceLabel: 'Precio Total',
      bookingRefLabel: 'Referencia de Reserva',
      footer: '¡Esperamos verte pronto! Si tienes alguna pregunta, por favor contáctanos.',
      cancellationPolicy: 'Política de cancelación: Por favor contáctanos al menos 48 horas antes de la clase para cancelar o reprogramar.',
    },
  }

  const t = translations[locale]

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${locale}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t.subject}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 40px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #10b981;
        }
        .header h1 {
          color: #10b981;
          margin: 0;
          font-size: 28px;
        }
        .intro {
          margin-bottom: 30px;
          font-size: 16px;
        }
        .details {
          background-color: #f9fafb;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .detail-row {
          margin-bottom: 15px;
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 12px;
        }
        .detail-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .detail-label {
          font-weight: 600;
          color: #6b7280;
          min-width: 180px;
        }
        .detail-value {
          color: #111827;
          flex: 1;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 14px;
          color: #6b7280;
        }
        .cancellation {
          margin-top: 20px;
          padding: 15px;
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          font-size: 13px;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${t.title}</h1>
        </div>

        <div class="intro">
          ${t.intro}
        </div>

        <div class="details">
          <div class="detail-row">
            <span class="detail-label">${t.classLabel}:</span>
            <span class="detail-value">${classTitle}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.dateLabel}:</span>
            <span class="detail-value">${sessionDate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.timeLabel}:</span>
            <span class="detail-value">${sessionTime}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.locationLabel}:</span>
            <span class="detail-value">${location}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.attendeesLabel}:</span>
            <span class="detail-value">${booking.numberOfPeople}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.priceLabel}:</span>
            <span class="detail-value">${currency}${totalPrice.toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.bookingRefLabel}:</span>
            <span class="detail-value">#${booking.id}</span>
          </div>
        </div>

        <div class="cancellation">
          ${t.cancellationPolicy}
        </div>

        <div class="footer">
          ${t.footer}
        </div>
      </div>
    </body>
    </html>
  `

  const textContent = `
${t.title}

${t.intro}

${t.classLabel}: ${classTitle}
${t.dateLabel}: ${sessionDate}
${t.timeLabel}: ${sessionTime}
${t.locationLabel}: ${location}
${t.attendeesLabel}: ${booking.numberOfPeople}
${t.priceLabel}: ${currency}${totalPrice.toFixed(2)}
${t.bookingRefLabel}: #${booking.id}

${t.cancellationPolicy}

${t.footer}
  `.trim()

  // Send email
  await sendMailWithRetry({
    from: process.env.SMTP_FROM || '"bizcocho.art" <noreply@bizcocho.art>',
    to: booking.email,
    subject: t.subject,
    text: textContent,
    html: htmlContent,
  })
}

export async function sendCourseConfirmationEmail({
  booking,
  classDoc,
  sessions,
  locale = 'en',
}: SendCourseConfirmationEmailParams): Promise<void> {
  // Get localized course title
  const courseTitle = (classDoc.title as string) || 'Course'

  // Get location
  const location = (classDoc.location as string) || 'TBD'

  // Calculate total price
  const pricePerPerson = (classDoc.priceCents || 0) / 100
  const totalPrice = pricePerPerson * booking.numberOfPeople
  const currency = classDoc.currency === 'eur' ? '€' : '$'

  // Format session dates
  const sessionDates = sessions.map((session, index) => {
    const startDateTime = new Date(session.startDateTime)
    const dateStr = startDateTime.toLocaleDateString(
      locale === 'es' ? 'es-ES' : 'en-US',
      {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }
    )
    const timeStr = startDateTime.toLocaleTimeString(
      locale === 'es' ? 'es-ES' : 'en-US',
      {
        hour: '2-digit',
        minute: '2-digit',
      }
    )
    return `${locale === 'es' ? 'Sesión' : 'Session'} ${index + 1}: ${dateStr} ${locale === 'es' ? 'a las' : 'at'} ${timeStr}`
  })

  // Translations
  const translations = {
    en: {
      subject: 'Course Enrollment Confirmation - bizcocho.art',
      title: 'Course Enrollment Confirmed!',
      intro: 'Thank you for enrolling. Here are your course details:',
      courseLabel: 'Course',
      sessionsLabel: 'Sessions',
      locationLabel: 'Location',
      attendeesLabel: 'Number of Attendees',
      priceLabel: 'Total Price',
      bookingRefLabel: 'Booking Reference',
      scheduleTitle: 'Your Course Schedule',
      footer: 'We look forward to seeing you! If you have any questions, please contact us.',
      cancellationPolicy: 'Cancellation policy: Please contact us at least 48 hours before the first session to cancel or reschedule.',
    },
    es: {
      subject: 'Confirmación de Inscripción al Curso - bizcocho.art',
      title: '¡Inscripción al Curso Confirmada!',
      intro: 'Gracias por inscribirte. Aquí están los detalles de tu curso:',
      courseLabel: 'Curso',
      sessionsLabel: 'Sesiones',
      locationLabel: 'Ubicación',
      attendeesLabel: 'Número de Asistentes',
      priceLabel: 'Precio Total',
      bookingRefLabel: 'Referencia de Reserva',
      scheduleTitle: 'Tu Horario del Curso',
      footer: '¡Esperamos verte pronto! Si tienes alguna pregunta, por favor contáctanos.',
      cancellationPolicy: 'Política de cancelación: Por favor contáctanos al menos 48 horas antes de la primera sesión para cancelar o reprogramar.',
    },
  }

  const t = translations[locale]

  const sessionListHtml = sessionDates.map(s => `<li style="margin-bottom: 8px;">${s}</li>`).join('')

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${locale}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t.subject}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 40px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #10b981;
        }
        .header h1 {
          color: #10b981;
          margin: 0;
          font-size: 28px;
        }
        .intro {
          margin-bottom: 30px;
          font-size: 16px;
        }
        .details {
          background-color: #f9fafb;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .detail-row {
          margin-bottom: 15px;
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 12px;
        }
        .detail-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .detail-label {
          font-weight: 600;
          color: #6b7280;
          min-width: 180px;
        }
        .detail-value {
          color: #111827;
          flex: 1;
        }
        .schedule {
          background-color: #ecfdf5;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .schedule h3 {
          margin: 0 0 15px 0;
          color: #065f46;
        }
        .schedule ul {
          margin: 0;
          padding-left: 20px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 14px;
          color: #6b7280;
        }
        .cancellation {
          margin-top: 20px;
          padding: 15px;
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          font-size: 13px;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${t.title}</h1>
        </div>

        <div class="intro">
          ${t.intro}
        </div>

        <div class="details">
          <div class="detail-row">
            <span class="detail-label">${t.courseLabel}:</span>
            <span class="detail-value">${courseTitle}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.sessionsLabel}:</span>
            <span class="detail-value">${sessions.length}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.locationLabel}:</span>
            <span class="detail-value">${location}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.attendeesLabel}:</span>
            <span class="detail-value">${booking.numberOfPeople}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.priceLabel}:</span>
            <span class="detail-value">${currency}${totalPrice.toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.bookingRefLabel}:</span>
            <span class="detail-value">#${booking.id}</span>
          </div>
        </div>

        <div class="schedule">
          <h3>${t.scheduleTitle}</h3>
          <ul>
            ${sessionListHtml}
          </ul>
        </div>

        <div class="cancellation">
          ${t.cancellationPolicy}
        </div>

        <div class="footer">
          ${t.footer}
        </div>
      </div>
    </body>
    </html>
  `

  const textContent = `
${t.title}

${t.intro}

${t.courseLabel}: ${courseTitle}
${t.sessionsLabel}: ${sessions.length}
${t.locationLabel}: ${location}
${t.attendeesLabel}: ${booking.numberOfPeople}
${t.priceLabel}: ${currency}${totalPrice.toFixed(2)}
${t.bookingRefLabel}: #${booking.id}

${t.scheduleTitle}:
${sessionDates.map(s => `- ${s}`).join('\n')}

${t.cancellationPolicy}

${t.footer}
  `.trim()

  // Send email
  await sendMailWithRetry({
    from: process.env.SMTP_FROM || '"bizcocho.art" <noreply@bizcocho.art>',
    to: booking.email,
    subject: t.subject,
    text: textContent,
    html: htmlContent,
  })
}

export async function sendGiftCertificateToRecipient({
  code,
  amountCents,
  currency,
  expiresAt,
  recipientEmail,
  recipientName: _recipientName,
  personalMessage,
  purchaserName,
  locale = 'en',
}: SendGiftCertificateToRecipientParams): Promise<void> {
  const currencySymbol = currency === 'eur' ? '€' : '$'
  const formattedAmount = `${currencySymbol}${(amountCents / 100).toFixed(2)}`
  const formattedExpiry = new Date(expiresAt).toLocaleDateString(
    locale === 'es' ? 'es-ES' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  )

  const translations = {
    en: {
      subject: 'You received a Gift Certificate! - bizcocho.art',
      title: 'You\'ve Received a Gift!',
      intro: purchaserName
        ? `${purchaserName} has sent you a gift certificate for bizcocho.art!`
        : 'Someone special has sent you a gift certificate for bizcocho.art!',
      valueLabel: 'Value',
      codeLabel: 'Your Code',
      expiresLabel: 'Valid Until',
      messageLabel: 'Personal Message',
      howToUse: 'How to use your gift certificate',
      howToUseSteps: [
        'Visit bizcocho.art and choose a class or course',
        'During checkout, enter your gift code',
        'The amount will be applied to your booking',
      ],
      footer: 'Enjoy your creative experience!',
    },
    es: {
      subject: '¡Has recibido un Certificado de Regalo! - bizcocho.art',
      title: '¡Has Recibido un Regalo!',
      intro: purchaserName
        ? `${purchaserName} te ha enviado un certificado de regalo para bizcocho.art.`
        : 'Alguien especial te ha enviado un certificado de regalo para bizcocho.art.',
      valueLabel: 'Valor',
      codeLabel: 'Tu Código',
      expiresLabel: 'Válido Hasta',
      messageLabel: 'Mensaje Personal',
      howToUse: 'Cómo usar tu certificado de regalo',
      howToUseSteps: [
        'Visita bizcocho.art y elige una clase o curso',
        'Durante el pago, ingresa tu código de regalo',
        'El monto se aplicará a tu reserva',
      ],
      footer: '¡Disfruta tu experiencia creativa!',
    },
  }

  const t = translations[locale]

  const personalMessageHtml = personalMessage
    ? `<div class="message-box">
        <p class="message-label">${t.messageLabel}:</p>
        <p class="message-text">"${personalMessage}"</p>
      </div>`
    : ''

  const howToUseHtml = t.howToUseSteps
    .map((step, i) => `<li>${i + 1}. ${step}</li>`)
    .join('')

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${locale}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t.subject}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 40px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #ec4899;
        }
        .header h1 {
          color: #ec4899;
          margin: 0;
          font-size: 28px;
        }
        .intro {
          text-align: center;
          margin-bottom: 30px;
          font-size: 16px;
        }
        .gift-card {
          background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 30px;
          text-align: center;
          color: white;
        }
        .gift-value {
          font-size: 48px;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .gift-code {
          background-color: rgba(255,255,255,0.2);
          padding: 15px 25px;
          border-radius: 8px;
          font-size: 24px;
          font-family: monospace;
          letter-spacing: 3px;
          display: inline-block;
        }
        .gift-expiry {
          margin-top: 20px;
          font-size: 14px;
          opacity: 0.9;
        }
        .message-box {
          background-color: #fdf2f8;
          border-left: 4px solid #ec4899;
          padding: 20px;
          margin-bottom: 30px;
          border-radius: 4px;
        }
        .message-label {
          font-weight: 600;
          color: #be185d;
          margin: 0 0 10px 0;
        }
        .message-text {
          margin: 0;
          font-style: italic;
          color: #333;
        }
        .how-to-use {
          background-color: #f9fafb;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .how-to-use h3 {
          margin: 0 0 15px 0;
          color: #374151;
        }
        .how-to-use ul {
          margin: 0;
          padding-left: 0;
          list-style: none;
        }
        .how-to-use li {
          margin-bottom: 10px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 14px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${t.title}</h1>
        </div>
        <div class="intro">${t.intro}</div>
        <div class="gift-card">
          <div class="gift-value">${formattedAmount}</div>
          <div class="gift-code">${code}</div>
          <div class="gift-expiry">${t.expiresLabel}: ${formattedExpiry}</div>
        </div>
        ${personalMessageHtml}
        <div class="how-to-use">
          <h3>${t.howToUse}</h3>
          <ul>${howToUseHtml}</ul>
        </div>
        <div class="footer">${t.footer}</div>
      </div>
    </body>
    </html>
  `

  const textContent = `
${t.title}

${t.intro}

${t.valueLabel}: ${formattedAmount}
${t.codeLabel}: ${code}
${t.expiresLabel}: ${formattedExpiry}

${personalMessage ? `${t.messageLabel}: "${personalMessage}"` : ''}

${t.howToUse}:
${t.howToUseSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

${t.footer}
  `.trim()

  await sendMailWithRetry({
    from: process.env.SMTP_FROM || '"bizcocho.art" <noreply@bizcocho.art>',
    to: recipientEmail,
    subject: t.subject,
    text: textContent,
    html: htmlContent,
  })
}

export async function sendGiftCertificatePurchaseConfirmation({
  code,
  amountCents,
  currency,
  purchaserEmail,
  purchaserName: _purchaserName,
  recipientEmail,
  recipientName,
  locale = 'en',
}: SendGiftCertificatePurchaseConfirmationParams): Promise<void> {
  const currencySymbol = currency === 'eur' ? '€' : '$'
  const formattedAmount = `${currencySymbol}${(amountCents / 100).toFixed(2)}`

  const translations = {
    en: {
      subject: 'Gift Certificate Purchase Confirmation - bizcocho.art',
      title: 'Purchase Confirmed!',
      intro: 'Thank you for your gift certificate purchase.',
      summaryTitle: 'Purchase Summary',
      valueLabel: 'Gift Certificate Value',
      codeLabel: 'Gift Code',
      recipientLabel: 'Sent To',
      statusLabel: 'Status',
      statusValue: 'Email sent to recipient',
      footer: 'Thank you for sharing the joy of creativity!',
    },
    es: {
      subject: 'Confirmación de Compra de Certificado de Regalo - bizcocho.art',
      title: '¡Compra Confirmada!',
      intro: 'Gracias por tu compra de certificado de regalo.',
      summaryTitle: 'Resumen de la Compra',
      valueLabel: 'Valor del Certificado',
      codeLabel: 'Código de Regalo',
      recipientLabel: 'Enviado A',
      statusLabel: 'Estado',
      statusValue: 'Email enviado al destinatario',
      footer: '¡Gracias por compartir la alegría de la creatividad!',
    },
  }

  const t = translations[locale]
  const recipientDisplay = recipientName ? `${recipientName} (${recipientEmail})` : recipientEmail

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${locale}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t.subject}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 40px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #10b981;
        }
        .header h1 {
          color: #10b981;
          margin: 0;
          font-size: 28px;
        }
        .intro {
          margin-bottom: 30px;
          font-size: 16px;
        }
        .details {
          background-color: #f9fafb;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .details h3 {
          margin: 0 0 20px 0;
          color: #374151;
        }
        .detail-row {
          margin-bottom: 15px;
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 12px;
        }
        .detail-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .detail-label {
          font-weight: 600;
          color: #6b7280;
          min-width: 180px;
        }
        .detail-value {
          color: #111827;
          flex: 1;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 14px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${t.title}</h1>
        </div>
        <div class="intro">${t.intro}</div>
        <div class="details">
          <h3>${t.summaryTitle}</h3>
          <div class="detail-row">
            <span class="detail-label">${t.valueLabel}:</span>
            <span class="detail-value">${formattedAmount}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.codeLabel}:</span>
            <span class="detail-value">${code}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.recipientLabel}:</span>
            <span class="detail-value">${recipientDisplay}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t.statusLabel}:</span>
            <span class="detail-value">${t.statusValue}</span>
          </div>
        </div>
        <div class="footer">${t.footer}</div>
      </div>
    </body>
    </html>
  `

  const textContent = `
${t.title}

${t.intro}

${t.summaryTitle}:
${t.valueLabel}: ${formattedAmount}
${t.codeLabel}: ${code}
${t.recipientLabel}: ${recipientDisplay}
${t.statusLabel}: ${t.statusValue}

${t.footer}
  `.trim()

  await sendMailWithRetry({
    from: process.env.SMTP_FROM || '"bizcocho.art" <noreply@bizcocho.art>',
    to: purchaserEmail,
    subject: t.subject,
    text: textContent,
    html: htmlContent,
  })
}

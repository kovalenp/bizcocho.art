import nodemailer from 'nodemailer'
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
  await transporter.sendMail({
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
  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"bizcocho.art" <noreply@bizcocho.art>',
    to: booking.email,
    subject: t.subject,
    text: textContent,
    html: htmlContent,
  })
}

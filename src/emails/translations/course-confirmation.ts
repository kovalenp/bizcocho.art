export const courseConfirmationTranslations = {
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
    sessionPrefix: 'Session',
    timePrefix: 'at',
    footer: 'We look forward to seeing you! If you have any questions, please contact us.',
    cancellationPolicy:
      'Cancellation policy: Please contact us at least 48 hours before the first session to cancel or reschedule.',
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
    sessionPrefix: 'Sesión',
    timePrefix: 'a las',
    footer: '¡Esperamos verte pronto! Si tienes alguna pregunta, por favor contáctanos.',
    cancellationPolicy:
      'Política de cancelación: Por favor contáctanos al menos 48 horas antes de la primera sesión para cancelar o reprogramar.',
  },
} as const

export type CourseConfirmationTranslations =
  (typeof courseConfirmationTranslations)[keyof typeof courseConfirmationTranslations]

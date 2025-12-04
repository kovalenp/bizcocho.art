export const bookingConfirmationTranslations = {
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
    cancellationPolicy:
      'Cancellation policy: Please contact us at least 48 hours before the class to cancel or reschedule.',
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
    cancellationPolicy:
      'Política de cancelación: Por favor contáctanos al menos 48 horas antes de la clase para cancelar o reprogramar.',
  },
} as const

export type BookingConfirmationTranslations =
  (typeof bookingConfirmationTranslations)[keyof typeof bookingConfirmationTranslations]

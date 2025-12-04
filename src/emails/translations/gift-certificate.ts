export const giftCertificateRecipientTranslations = {
  en: {
    subject: "You received a Gift Certificate! - bizcocho.art",
    title: "You've Received a Gift!",
    introWithName: (name: string) =>
      `${name} has sent you a gift certificate for bizcocho.art!`,
    introAnonymous: 'Someone special has sent you a gift certificate for bizcocho.art!',
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
    introWithName: (name: string) =>
      `${name} te ha enviado un certificado de regalo para bizcocho.art.`,
    introAnonymous: 'Alguien especial te ha enviado un certificado de regalo para bizcocho.art.',
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
} as const

export const giftCertificatePurchaseTranslations = {
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
} as const

export type GiftCertificateRecipientTranslations =
  (typeof giftCertificateRecipientTranslations)[keyof typeof giftCertificateRecipientTranslations]

export type GiftCertificatePurchaseTranslations =
  (typeof giftCertificatePurchaseTranslations)[keyof typeof giftCertificatePurchaseTranslations]

import type { Locale } from '../config'
import { messages as enMessages } from './en'
import { messages as esMessages } from './es'
import { logError, logWarn } from '../../lib/logger'

type MessageStructure = {
  common: {
    openCms: string
    all: string
    backToClasses: string
  }
  nav: {
    events: string
    courses: string
    giftCertificates: string
    about: string
  }
  home: {
    title: string
    subtitle: string
    availableClasses: string
    noClasses: string
    noClassesMessage: string
    noClassesForFilter: string
    tryDifferentFilter: string
    spots: string
    min: string
  }
  classDetail: {
    duration: string
    minutes: string
    location: string
    capacity: string
    price: string
    instructor: string
    about: string
    gallery: string
    bookNow: string
    spotsAvailable: string
  }
  booking: {
    title: string
    selectSession: string
    noSessions: string
    sessionFull: string
    firstName: string
    lastName: string
    email: string
    phone: string
    numberOfPeople: string
    submit: string
    submitting: string
    redirecting: string
    pleaseWait: string
    successTitle: string
    success: string
    error: string
    requiredField: string
    invalidEmail: string
  }
  giftCode: {
    placeholder: string
    apply: string
    remove: string
    validating: string
    discountApplied: string
    youSave: string
    remaining: string
    fullyCovered: string
    invalid: string
  }
  giftCertificates: {
    pageTitle: string
    pageSubtitle: string
    selectAmount: string
    customAmount: string
    customAmountPlaceholder: string
    minAmount: string
    maxAmount: string
    recipientInfo: string
    recipientName: string
    recipientEmail: string
    personalMessage: string
    personalMessagePlaceholder: string
    yourInfo: string
    yourName: string
    yourEmail: string
    preview: string
    previewDescription: string
    purchaseButton: string
    purchasing: string
    validity: string
    validityMonths: string
    termsTitle: string
    termsText: string
    successTitle: string
    successMessage: string
    emailSent: string
    yourCode: string
    checkBalance: string
    checkBalanceTitle: string
    enterCode: string
    check: string
    checking: string
    balanceTitle: string
    currentBalance: string
    originalValue: string
    expiresOn: string
    status: string
    statusActive: string
    statusPartial: string
    statusRedeemed: string
    statusExpired: string
    codeNotFound: string
  }
}

const messagesByLocale: Record<Locale, MessageStructure> = {
  en: enMessages,
  es: esMessages,
}

export type Messages = MessageStructure

export function getMessages(locale: Locale): Messages {
  const messages = messagesByLocale[locale]
  if (!messages) {
    logError('Messages not found for locale, falling back to en', new Error('Locale not found'), { locale })
    return messagesByLocale.en
  }
  return messages
}

// Helper function to access nested messages with type safety
export function t(messages: Messages, key: string): string {
  const keys = key.split('.')
  let value: any = messages

  for (const k of keys) {
    value = value[k]
    if (value === undefined) {
      logWarn('Translation key not found', { key })
      return key
    }
  }

  return value
}

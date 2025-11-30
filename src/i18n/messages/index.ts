import type { Locale } from '../config'
import { messages as enMessages } from './en'
import { messages as esMessages } from './es'
import { logError, logWarn } from '../../lib/logger'

type MessageStructure = {
  common: {
    openCms: string
    all: string
    backToClasses: string
    or: string
    free: string
    session: string
    sessions: string
    person: string
    people: string
    at: string
    backToHome: string
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
    minutesPerSession: string
    location: string
    capacity: string
    participants: string
    price: string
    instructor: string
    about: string
    gallery: string
    bookNow: string
    spotsAvailable: string
    description: string
    aboutInstructor: string
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
    processing: string
    continueToPayment: string
    totalPrice: string
  }
  cancel: {
    title: string
    message: string
    tryAgainTitle: string
    tryAgainMessage: string
    browseOfferings: string
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
    whatsNext: string
    recipientWillReceive: string
    youWillReceiveConfirmation: string
    codeCanBeUsed: string
    validFor12Months: string
    buyAnother: string
    productName: string
  }
  about: {
    metaDescription: string
    ourStory: string
    ourStoryP1: string
    ourStoryP2: string
    contactUs: string
    location: string
    email: string
    phone: string
    hours: string
    hoursWeekday: string
    hoursSunday: string
  }
  course: {
    full: string
    bookEntireCourse: string
    bookCourse: string
    forEntireCourse: string
    duration: string
    schedule: string
    courseDates: string
    fullEnrollment: string
  }
  payment: {
    discountApplied: string
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

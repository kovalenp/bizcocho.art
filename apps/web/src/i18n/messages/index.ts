import type { Locale } from '../config'
import { messages as enMessages } from './en'
import { messages as esMessages } from './es'

type MessageStructure = {
  common: {
    openCms: string
    all: string
    backToClasses: string
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
    successTitle: string
    success: string
    error: string
    requiredField: string
    invalidEmail: string
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
    console.error(`Messages not found for locale: ${locale}. Falling back to 'en'`)
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
      console.warn(`Translation key not found: ${key}`)
      return key
    }
  }

  return value
}

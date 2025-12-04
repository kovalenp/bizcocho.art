import { Hr, Link, Section, Text } from '@react-email/components'
import type { Locale } from '../../i18n/config'

interface FooterProps {
  message?: string
  locale?: Locale
}

const footerText = {
  en: {
    contact: 'Questions?',
    email: 'hola@bizcocho.art',
  },
  es: {
    contact: '¿Preguntas?',
    email: 'hola@bizcocho.art',
  },
}

export function Footer({ message, locale = 'en' }: FooterProps) {
  const t = footerText[locale]

  return (
    <Section className="mt-10">
      <Hr className="border-gray-200 my-0 mb-6" />
      {message && <Text className="text-sm text-gray-500 mb-4 leading-relaxed">{message}</Text>}
      <Text className="text-[13px] text-gray-400 m-0 mb-2">
        {t.contact}{' '}
        <Link href="mailto:hola@bizcocho.art" className="text-black underline">
          {t.email}
        </Link>
      </Text>
      <Text className="text-[13px] text-gray-400 m-0">
        <Link href="https://bizcocho.art" className="text-gray-400 no-underline">
          bizcocho.art
        </Link>
      </Text>
    </Section>
  )
}

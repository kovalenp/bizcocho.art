import { Section, Text } from '@react-email/components'
import { Layout } from '../components'
import { giftCertificateRecipientTranslations } from '../translations'
import type { Locale } from '../../i18n/config'

export interface GiftCertificateRecipientProps {
  code: string
  formattedAmount: string
  formattedExpiry: string
  purchaserName?: string
  personalMessage?: string
  locale?: Locale
}

export function GiftCertificateRecipient({
  code,
  formattedAmount,
  formattedExpiry,
  purchaserName,
  personalMessage,
  locale = 'en',
}: GiftCertificateRecipientProps) {
  const t = giftCertificateRecipientTranslations[locale]

  const intro = purchaserName ? t.introWithName(purchaserName) : t.introAnonymous

  return (
    <Layout
      preview={t.title}
      title={t.title}
      footerMessage={t.footer}
      locale={locale}
      accentColor="#ec4899"
    >
      <Text className="text-center text-[15px] text-gray-700 m-0 mb-8 leading-relaxed">
        {intro}
      </Text>

      <Section
        className="rounded-2xl px-8 py-10 mb-8 text-center"
        style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' }}
      >
        <Text className="text-5xl font-bold text-white m-0 mb-6 tracking-tight">
          {formattedAmount}
        </Text>
        <Text className="bg-white/20 inline-block px-7 py-4 rounded-lg text-xl font-mono tracking-widest text-white m-0 mb-5">
          {code}
        </Text>
        <Text className="text-sm text-white/90 m-0">
          {t.expiresLabel}: {formattedExpiry}
        </Text>
      </Section>

      {personalMessage && (
        <Section className="bg-pink-50 rounded-lg px-6 py-5 mb-6">
          <Text className="text-xs font-semibold text-pink-700 m-0 mb-2 uppercase tracking-wide">
            {t.messageLabel}
          </Text>
          <Text className="text-[15px] italic text-gray-700 m-0 leading-relaxed">
            &quot;{personalMessage}&quot;
          </Text>
        </Section>
      )}

      <Section className="bg-gray-50 rounded-lg px-6 py-5">
        <Text className="text-sm font-semibold text-gray-700 m-0 mb-4">{t.howToUse}</Text>
        {t.howToUseSteps.map((step, index) => (
          <Text key={index} className="text-sm text-gray-500 m-0 mb-2 leading-relaxed">
            {index + 1}. {step}
          </Text>
        ))}
      </Section>
    </Layout>
  )
}

// Default props for React Email preview
GiftCertificateRecipient.PreviewProps = {
  code: 'GIFT-ABC123',
  formattedAmount: '€50.00',
  formattedExpiry: 'December 14, 2025',
  purchaserName: 'Maria Garcia',
  personalMessage: 'Happy Birthday! Enjoy a creative experience!',
  locale: 'en' as const,
}

export default GiftCertificateRecipient

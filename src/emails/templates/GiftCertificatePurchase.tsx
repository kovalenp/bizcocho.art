import { Section, Text, Row, Column } from '@react-email/components'
import { Layout } from '../components'
import { giftCertificatePurchaseTranslations } from '../translations'
import type { Locale } from '../../i18n/config'

export interface GiftCertificatePurchaseProps {
  code: string
  formattedAmount: string
  recipientDisplay: string
  locale?: Locale
}

export function GiftCertificatePurchase({
  code,
  formattedAmount,
  recipientDisplay,
  locale = 'en',
}: GiftCertificatePurchaseProps) {
  const t = giftCertificatePurchaseTranslations[locale]

  return (
    <Layout preview={t.title} title={t.title} footerMessage={t.footer} locale={locale}>
      <Text className="text-[15px] text-gray-700 m-0 mb-8 leading-relaxed">{t.intro}</Text>

      <Section className="bg-gray-50 rounded-lg p-6">
        <Text className="text-sm font-semibold text-gray-700 m-0 mb-5">{t.summaryTitle}</Text>
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.valueLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">{formattedAmount}</Column>
        </Row>
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.codeLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-semibold font-mono tracking-wide">
            {code}
          </Column>
        </Row>
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.recipientLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">{recipientDisplay}</Column>
        </Row>
        <Row>
          <Column className="w-[45%] text-sm text-gray-500">{t.statusLabel}</Column>
          <Column className="w-[55%] text-sm text-emerald-600 font-medium">{t.statusValue}</Column>
        </Row>
      </Section>
    </Layout>
  )
}

// Default props for React Email preview
GiftCertificatePurchase.PreviewProps = {
  code: 'GIFT-ABC123',
  formattedAmount: '€50.00',
  recipientDisplay: 'Ana Martinez (ana@example.com)',
  locale: 'en' as const,
}

export default GiftCertificatePurchase

import { type Locale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import type { Metadata } from 'next'
import { GiftCertificatePurchaseForm } from '@/components/gift-certificates/GiftCertificatePurchaseForm'
import { GiftCertificateBalanceChecker } from '@/components/gift-certificates/GiftCertificateBalanceChecker'

type Props = {
  params: Promise<{
    locale: Locale
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const messages = getMessages(locale)

  const title = messages.nav.giftCertificates
  const description = messages.giftCertificates.pageSubtitle

  return {
    title: `${title} | bizcocho.art`,
    description,
    keywords: ['gift certificates', 'art gifts', 'creative gifts', 'certificados de regalo'],
    openGraph: {
      title: `${title} | bizcocho.art`,
      description,
      url: `https://bizcocho.art/${locale}/gift-certificates`,
      siteName: 'bizcocho.art',
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `https://bizcocho.art/${locale}/gift-certificates`,
      languages: {
        en: 'https://bizcocho.art/en/gift-certificates',
        es: 'https://bizcocho.art/es/gift-certificates',
      },
    },
  }
}

export default async function GiftCertificatesPage({ params }: Props) {
  const { locale } = await params
  const messages = getMessages(locale)
  const t = messages.giftCertificates

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{t.pageTitle}</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">{t.pageSubtitle}</p>
      </div>

      {/* Purchase Form */}
      <div className="mb-16">
        <GiftCertificatePurchaseForm messages={messages} locale={locale} />
      </div>

      {/* Divider */}
      <div className="relative my-12">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-4 bg-gray-50 text-sm text-gray-500">
            {messages.common.or}
          </span>
        </div>
      </div>

      {/* Balance Checker */}
      <GiftCertificateBalanceChecker messages={messages} locale={locale} />
    </div>
  )
}

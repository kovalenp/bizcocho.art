import { type Locale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{
    locale: Locale
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const messages = getMessages(locale)

  const title = messages.nav.giftCertificates
  const description =
    locale === 'es'
      ? 'Regala creatividad con certificados de regalo para clases de arte. El regalo perfecto para artistas y entusiastas del arte.'
      : 'Give the gift of creativity with art class gift certificates. The perfect gift for artists and art enthusiasts.'

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {messages.nav.giftCertificates}
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          {locale === 'es'
            ? 'Regala el don de la creatividad. Los certificados de regalo perfectos para amantes del arte.'
            : 'Give the gift of creativity. Perfect gift certificates for art lovers.'}
        </p>
        <div className="bg-white rounded-lg shadow-md p-12">
          <div className="text-6xl mb-6">🎁</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {locale === 'es' ? 'Próximamente' : 'Coming Soon'}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {locale === 'es'
              ? 'Pronto podrás comprar certificados de regalo para nuestras clases de arte. El regalo perfecto para inspirar creatividad en tus seres queridos.'
              : "Soon you'll be able to purchase gift certificates for our art classes. The perfect gift to inspire creativity in your loved ones."}
          </p>
        </div>
      </div>
    </div>
  )
}

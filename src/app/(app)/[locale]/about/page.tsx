import { type Locale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{
    locale: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const messages = getMessages(locale as Locale)

  const title = messages.nav.about
  const description = messages.about.metaDescription

  return {
    title: `${title} | bizcocho.art`,
    description,
    keywords: ['about us', 'art studio Madrid', 'contact', 'sobre nosotros'],
    openGraph: {
      title: `${title} | bizcocho.art`,
      description,
      url: `https://bizcocho.art/${locale}/about`,
      siteName: 'bizcocho.art',
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `https://bizcocho.art/${locale}/about`,
      languages: {
        en: 'https://bizcocho.art/en/about',
        es: 'https://bizcocho.art/es/about',
      },
    },
  }
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params
  const messages = getMessages(locale as Locale)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">{messages.nav.about}</h1>

        {/* Our Story Section */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {messages.about.ourStory}
          </h2>
          <div className="prose prose-lg text-gray-700">
            <p className="mb-4">
              {messages.about.ourStoryP1}
            </p>
            <p className="mb-4">
              {messages.about.ourStoryP2}
            </p>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {messages.about.contactUs}
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {messages.about.location}
              </h3>
              <p className="text-gray-700">
                Calle de las Artes, 123
                <br />
                28001 Madrid, España
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {messages.about.email}
              </h3>
              <p className="text-gray-700">
                <a
                  href="mailto:info@bizcocho.art"
                  className="text-primary hover:underline"
                >
                  info@bizcocho.art
                </a>
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {messages.about.phone}
              </h3>
              <p className="text-gray-700">
                <a href="tel:+34912345678" className="text-primary hover:underline">
                  +34 91 234 5678
                </a>
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {messages.about.hours}
              </h3>
              <p className="text-gray-700">
                {messages.about.hoursWeekday}
                <br />
                {messages.about.hoursSunday}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

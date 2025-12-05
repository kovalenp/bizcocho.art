import { getPayload } from 'payload'
import config from '@payload-config'
import { isValidLocale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import { ClassFilter } from '@/components/class/ClassFilter'
import type { Metadata } from 'next'

// Render at request time (DB not available during build)
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{
    locale: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : 'en'
  const messages = getMessages(validLocale)

  const title = messages.home.title
  const description = messages.home.subtitle

  return {
    title: `${title} | bizcocho.art`,
    description,
    keywords: [
      'art classes',
      'art workshops',
      'creative classes',
      'painting classes',
      'drawing classes',
      'Madrid art classes',
      'clases de arte',
      'talleres creativos',
    ],
    authors: [{ name: 'bizcocho.art' }],
    openGraph: {
      title: `${title} | bizcocho.art`,
      description,
      url: `https://bizcocho.art/${locale}`,
      siteName: 'bizcocho.art',
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      type: 'website',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          alt: 'bizcocho.art',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | bizcocho.art`,
      description,
      images: ['/logo.png'],
    },
    alternates: {
      canonical: `https://bizcocho.art/${locale}`,
      languages: {
        en: 'https://bizcocho.art/en',
        es: 'https://bizcocho.art/es',
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  const payload = await getPayload({ config })
  const validLocale = isValidLocale(locale) ? locale : 'en'
  const messages = getMessages(validLocale)

  // Unified: Classes collection now contains both type:'class' and type:'course'
  const [classes, tags] = await Promise.all([
    payload.find({
      collection: 'classes',
      where: {
        isPublished: {
          equals: true,
        },
      },
      depth: 2,
      limit: 20,
      locale: validLocale,
    }),
    payload.find({
      collection: 'tags',
      limit: 100,
      locale: validLocale,
    }),
  ])

  return (
    <main className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <header className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 leading-tight">
          {messages.home.title}
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          {messages.home.subtitle}
        </p>
      </header>

      <section>
        <h2 className="text-3xl font-semibold mb-8 text-center">
          {messages.home.availableClasses}
        </h2>

        {classes.docs.length > 0 ? (
          <ClassFilter classes={classes.docs} tags={tags.docs} messages={messages} locale={validLocale} />
        ) : (
          <div className="text-center p-12 bg-gray-50 rounded-lg">
            <h3 className="text-gray-600 text-lg font-medium">
              {messages.home.noClasses}
            </h3>
            <p className="text-gray-500 mt-2">
              {messages.home.noClassesMessage}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

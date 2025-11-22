import { getPayload } from 'payload'
import config from '@payload-config'
import type { Locale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ClassTemplate, Media, Instructor, Tag } from '@/payload-types'
import { ClassDetailLayout } from '@/components/class/ClassDetailLayout'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{
    locale: Locale
    slug: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const payload = await getPayload({ config })

  const classTemplates = await payload.find({
    collection: 'class-templates',
    where: {
      slug: { equals: slug },
      isPublished: { equals: true },
    },
    depth: 2,
    limit: 1,
    locale,
  })

  if (classTemplates.docs.length === 0) {
    return {
      title: 'Class Not Found | bizcocho.art',
    }
  }

  const classTemplate = classTemplates.docs[0] as ClassTemplate
  const featuredImage = classTemplate.featuredImage as Media | null
  const instructor = classTemplate.instructor as Instructor
  const tags = (classTemplate.tags || []) as Tag[]

  const title = classTemplate.title
  const description =
    classTemplate.description?.slice(0, 160) ||
    `Join our ${title} class at bizcocho.art. ${classTemplate.durationMinutes} minutes of creative learning.`

  const imageUrl = featuredImage?.url
    ? `https://bizcocho.art${featuredImage.url}`
    : 'https://bizcocho.art/logo.png'

  const keywords = [
    title,
    'art class',
    'workshop',
    ...tags.map((t) => t.name),
    instructor?.name || '',
    'Madrid',
    'clase de arte',
  ].filter(Boolean)

  return {
    title: `${title} | bizcocho.art`,
    description,
    keywords,
    authors: [{ name: 'bizcocho.art' }],
    openGraph: {
      title: `${title} | bizcocho.art`,
      description,
      url: `https://bizcocho.art/${locale}/classes/${slug}`,
      siteName: 'bizcocho.art',
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      type: 'article',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | bizcocho.art`,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: `https://bizcocho.art/${locale}/classes/${slug}`,
      languages: {
        en: `https://bizcocho.art/en/classes/${slug}`,
        es: `https://bizcocho.art/es/classes/${slug}`,
      },
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function ClassDetailPage({ params }: Props) {
  const { locale, slug } = await params
  const payload = await getPayload({ config })
  const messages = getMessages(locale)

  const classTemplates = await payload.find({
    collection: 'class-templates',
    where: {
      slug: {
        equals: slug,
      },
      isPublished: {
        equals: true,
      },
    },
    depth: 2,
    limit: 1,
    locale,
  })

  if (classTemplates.docs.length === 0) {
    notFound()
  }

  const classTemplate = classTemplates.docs[0] as ClassTemplate
  const instructor = classTemplate.instructor as Instructor
  const featuredImage = classTemplate.featuredImage as Media | null
  const gallery = (classTemplate.gallery || []) as Media[]
  const tags = (classTemplate.tags || []) as Tag[]

  // Fetch upcoming class sessions for this template
  const classSessions = await payload.find({
    collection: 'class-sessions',
    where: {
      classTemplate: {
        equals: classTemplate.id,
      },
      status: {
        equals: 'scheduled',
      },
      startDateTime: {
        greater_than: new Date().toISOString(),
      },
    },
    sort: 'startDateTime',
    limit: 20,
    depth: 1,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link
          href={`/${locale}`}
          className="inline-flex items-center text-primary hover:underline mb-6"
        >
          ← {messages.common.backToClasses}
        </Link>

        <ClassDetailLayout
          classTemplate={classTemplate}
          classSessions={classSessions.docs}
          featuredImage={featuredImage}
          gallery={gallery}
          tags={tags}
          instructor={instructor}
          messages={messages}
          locale={locale}
        />
      </div>
    </div>
  )
}

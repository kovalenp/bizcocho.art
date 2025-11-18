import { getPayload } from 'payload'
import config from '@payload-config'
import type { Locale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ClassTemplate, Media, Instructor, Tag } from '@/payload-types'
import { ClassDetailLayout } from '@/components/class/ClassDetailLayout'

type Props = {
  params: Promise<{
    locale: Locale
    slug: string
  }>
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
        />
      </div>
    </div>
  )
}

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Locale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Class, Media, Instructor, Tag } from '@/payload-types'
import { ClassDetailLayout } from '@/components/class/ClassDetailLayout'
import { CourseBookingButton } from '@/components/course/CourseBookingButton'
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

  const classes = await payload.find({
    collection: 'classes',
    where: {
      slug: { equals: slug },
      isPublished: { equals: true },
    },
    depth: 2,
    limit: 1,
    locale,
  })

  if (classes.docs.length === 0) {
    return {
      title: 'Not Found | bizcocho.art',
    }
  }

  const classDoc = classes.docs[0] as Class
  const featuredImage = classDoc.featuredImage as Media | null
  const instructor = classDoc.instructor as Instructor
  const tags = (classDoc.tags || []) as Tag[]

  const title = classDoc.title
  const isCourse = classDoc.type === 'course'
  const description =
    classDoc.description?.slice(0, 160) ||
    (isCourse
      ? `Join our ${title} course at bizcocho.art. ${classDoc.durationMinutes} minutes per session.`
      : `Join our ${title} class at bizcocho.art. ${classDoc.durationMinutes} minutes of creative learning.`)

  const imageUrl = featuredImage?.url
    ? `https://bizcocho.art${featuredImage.url}`
    : 'https://bizcocho.art/logo.png'

  const keywords = [
    title,
    isCourse ? 'art course' : 'art class',
    isCourse ? 'multi-week course' : 'workshop',
    ...tags.map((t) => t.name),
    instructor?.name || '',
    'Madrid',
    isCourse ? 'curso de arte' : 'clase de arte',
  ].filter(Boolean)

  return {
    title: `${title} | bizcocho.art`,
    description,
    keywords,
    authors: [{ name: 'bizcocho.art' }],
    openGraph: {
      title: `${title} | bizcocho.art`,
      description,
      url: `https://bizcocho.art/${locale}/offerings/${slug}`,
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
      canonical: `https://bizcocho.art/${locale}/offerings/${slug}`,
      languages: {
        en: `https://bizcocho.art/en/offerings/${slug}`,
        es: `https://bizcocho.art/es/offerings/${slug}`,
      },
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function OfferingDetailPage({ params }: Props) {
  const { locale, slug } = await params
  const payload = await getPayload({ config })
  const messages = getMessages(locale)

  const classes = await payload.find({
    collection: 'classes',
    where: {
      slug: { equals: slug },
      isPublished: { equals: true },
    },
    depth: 2,
    limit: 1,
    locale,
  })

  if (classes.docs.length === 0) {
    notFound()
  }

  const classDoc = classes.docs[0] as Class
  const instructor = classDoc.instructor as Instructor
  const featuredImage = classDoc.featuredImage as Media | null
  const gallery = (classDoc.gallery || []) as Media[]
  const tags = (classDoc.tags || []) as Tag[]
  const isCourse = classDoc.type === 'course'

  // Fetch sessions for this class
  const sessions = await payload.find({
    collection: 'sessions',
    where: {
      class: { equals: classDoc.id },
      status: { equals: 'scheduled' },
      ...(isCourse ? {} : { startDateTime: { greater_than: new Date().toISOString() } }),
    },
    sort: 'startDateTime',
    limit: 100,
    depth: 1,
  })

  // For courses, render inline course detail layout
  if (isCourse) {
    const pricePerPerson = (classDoc.priceCents || 0) / 100
    const currency = classDoc.currency === 'eur' ? '€' : '$'

    // Format schedule info
    const daysOfWeek = classDoc.schedule?.daysOfWeek || []
    const dayNames: { [key: string]: { en: string; es: string } } = {
      '0': { en: 'Sunday', es: 'Domingo' },
      '1': { en: 'Monday', es: 'Lunes' },
      '2': { en: 'Tuesday', es: 'Martes' },
      '3': { en: 'Wednesday', es: 'Miércoles' },
      '4': { en: 'Thursday', es: 'Jueves' },
      '5': { en: 'Friday', es: 'Viernes' },
      '6': { en: 'Saturday', es: 'Sábado' },
    }
    const scheduleText = daysOfWeek.map((d) => dayNames[d]?.[locale] || '').join(', ')

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back button */}
          <Link
            href={`/${locale}`}
            className="inline-flex items-center text-primary hover:underline mb-6"
          >
            ← {messages.common.backToClasses}
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left column: Image and gallery */}
            <div>
              {featuredImage && (
                <img
                  src={featuredImage.url!}
                  alt={featuredImage.alt || classDoc.title}
                  className="w-full h-96 object-cover rounded-lg shadow-lg mb-4"
                />
              )}
              {gallery.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {gallery.map((image, index) =>
                    image?.url ? (
                      <img
                        key={image.id || index}
                        src={image.url}
                        alt={image.alt || `Gallery ${index + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                    ) : null
                  )}
                </div>
              )}
            </div>

            {/* Right column: Course info and booking */}
            <div>
              <h1 className="text-4xl font-bold mb-4">{classDoc.title}</h1>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-3 py-1 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : undefined,
                        color: tag.color || undefined,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Price */}
              <div className="mb-6 p-4 bg-primary/10 rounded-lg">
                <span className="text-3xl font-bold text-primary">
                  {currency}
                  {pricePerPerson.toFixed(2)}
                </span>
                <span className="text-gray-600 ml-2">
                  {locale === 'es' ? 'por curso completo' : 'for entire course'}
                </span>
              </div>

              {/* Course details */}
              <div className="space-y-4 mb-6">
                <div className="flex items-start">
                  <span className="font-semibold w-32">
                    {locale === 'es' ? 'Duración:' : 'Duration:'}
                  </span>
                  <span>
                    {classDoc.durationMinutes}{' '}
                    {locale === 'es' ? 'minutos por sesión' : 'minutes per session'}
                  </span>
                </div>

                <div className="flex items-start">
                  <span className="font-semibold w-32">
                    {locale === 'es' ? 'Sesiones:' : 'Sessions:'}
                  </span>
                  <span>
                    {sessions.totalDocs} {locale === 'es' ? 'sesiones' : 'sessions'}
                  </span>
                </div>

                <div className="flex items-start">
                  <span className="font-semibold w-32">
                    {locale === 'es' ? 'Horario:' : 'Schedule:'}
                  </span>
                  <span>
                    {scheduleText} {locale === 'es' ? 'a las' : 'at'} {classDoc.schedule?.startTime}
                  </span>
                </div>

                {instructor && (
                  <div className="flex items-start">
                    <span className="font-semibold w-32">
                      {locale === 'es' ? 'Instructor:' : 'Instructor:'}
                    </span>
                    <span>{instructor.name}</span>
                  </div>
                )}

                {classDoc.location && (
                  <div className="flex items-start">
                    <span className="font-semibold w-32">
                      {locale === 'es' ? 'Ubicación:' : 'Location:'}
                    </span>
                    <span>{classDoc.location}</span>
                  </div>
                )}

                <div className="flex items-start">
                  <span className="font-semibold w-32">
                    {locale === 'es' ? 'Capacidad:' : 'Capacity:'}
                  </span>
                  <span>
                    {classDoc.maxCapacity} {locale === 'es' ? 'participantes' : 'participants'}
                  </span>
                </div>
              </div>

              {/* Course sessions schedule */}
              {sessions.docs.length > 0 && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-3">
                    {locale === 'es' ? 'Fechas del Curso:' : 'Course Dates:'}
                  </h3>
                  <div className="space-y-2">
                    {sessions.docs.map((session: any, index) => {
                      const startDate = new Date(session.startDateTime)
                      const dateStr = startDate.toLocaleDateString(
                        locale === 'es' ? 'es-ES' : 'en-US',
                        {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        }
                      )
                      return (
                        <div key={session.id} className="text-sm">
                          {locale === 'es' ? 'Sesión' : 'Session'} {index + 1}: {dateStr}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Book button */}
              <CourseBookingButton
                classId={classDoc.id}
                priceCents={classDoc.priceCents || 0}
                currency={classDoc.currency || 'eur'}
                maxCapacity={classDoc.maxCapacity || 10}
                availableSpots={Math.min(
                  ...sessions.docs.map((s) => s.availableSpots ?? classDoc.maxCapacity ?? 10)
                )}
                locale={locale}
                messages={messages}
              />
            </div>
          </div>

          {/* Description */}
          {classDoc.description && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-4">
                {locale === 'es' ? 'Descripción' : 'Description'}
              </h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {classDoc.description}
              </p>
            </div>
          )}

          {/* Instructor bio */}
          {instructor && instructor.bio && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-4">
                {locale === 'es' ? 'Sobre el Instructor' : 'About the Instructor'}
              </h2>
              <div className="flex items-start gap-4">
                {instructor.photo && typeof instructor.photo === 'object' && (
                  <img
                    src={(instructor.photo as Media).url!}
                    alt={instructor.name}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-lg">{instructor.name}</h3>
                  <p className="text-gray-700">{instructor.bio}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // For classes, use the existing ClassDetailLayout component
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link
          href={`/${locale}`}
          className="inline-flex items-center text-primary hover:underline mb-6"
        >
          ← {messages.common.backToClasses}
        </Link>

        <ClassDetailLayout
          classTemplate={classDoc}
          classSessions={sessions.docs}
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

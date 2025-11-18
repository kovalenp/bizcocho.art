import { getPayload } from 'payload'
import config from '@payload-config'
import type { Locale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ClassTemplate, Media, Instructor, Tag } from '@/payload-types'
import { BookingForm } from '@/components/BookingForm'

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Featured image */}
            {featuredImage?.url && (
              <div className="bg-white rounded-lg overflow-hidden shadow-md">
                <img
                  src={featuredImage.url}
                  alt={classTemplate.title}
                  className="w-full h-96 object-cover"
                />
              </div>
            )}

            {/* Title and tags */}
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                {classTemplate.title}
              </h1>

              {tags.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-4">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-3 py-1 rounded-full text-sm font-medium text-white"
                      style={{
                        backgroundColor: tag.color || '#f0f0f0',
                        color: '#fff',
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Quick info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <div className="text-sm text-gray-500">{messages.classDetail.duration}</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {classTemplate.durationMinutes} {messages.classDetail.minutes}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">{messages.classDetail.capacity}</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {classTemplate.maxCapacity} {messages.home.spots}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">{messages.classDetail.price}</div>
                  <div className="text-lg font-semibold text-primary">
                    €{((classTemplate.priceCents || 0) / 100).toFixed(2)}
                  </div>
                </div>
                {classTemplate.location && (
                  <div>
                    <div className="text-sm text-gray-500">{messages.classDetail.location}</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {classTemplate.location}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* About the class */}
            {classTemplate.description && (
              <div className="bg-white rounded-lg p-6 shadow-md">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  {messages.classDetail.about}
                </h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {classTemplate.description}
                </p>
              </div>
            )}

            {/* Gallery */}
            {gallery.length > 0 && (
              <div className="bg-white rounded-lg p-6 shadow-md">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  {messages.classDetail.gallery}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {gallery.map((image) => (
                    <div
                      key={image.id}
                      className="aspect-square rounded-lg overflow-hidden"
                    >
                      <img
                        src={image.url || ''}
                        alt={image.alt || ''}
                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructor */}
            {instructor && (
              <div className="bg-white rounded-lg p-6 shadow-md">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  {messages.classDetail.instructor}
                </h2>
                <div className="flex items-start gap-4">
                  {instructor.photo && typeof instructor.photo !== 'string' && (
                    <img
                      src={instructor.photo.url || ''}
                      alt={instructor.name}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {instructor.name}
                    </h3>
                    {instructor.bio && (
                      <p className="text-gray-700 leading-relaxed">{instructor.bio}</p>
                    )}
                    {instructor.specialties && (
                      <p className="text-sm text-gray-500 mt-2">
                        {instructor.specialties}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Booking form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-6 shadow-md sticky top-8">
              <BookingForm classTemplate={classTemplate} messages={messages} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

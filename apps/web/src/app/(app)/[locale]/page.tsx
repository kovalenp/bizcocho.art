import { getPayload } from 'payload'
import config from '@payload-config'
import type { Locale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { ClassFilter } from '@/components/class/ClassFilter'

type Props = {
  params: Promise<{
    locale: Locale
  }>
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  const payload = await getPayload({ config })
  const messages = getMessages(locale)

  const [classTemplates, tags] = await Promise.all([
    payload.find({
      collection: 'class-templates',
      where: {
        isPublished: {
          equals: true,
        },
      },
      depth: 2,
      limit: 10,
      locale,
    }),
    payload.find({
      collection: 'tags',
      limit: 100,
      locale,
    }),
  ])

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <nav className="flex justify-end mb-8">
        <LanguageSelector currentLocale={locale} />
      </nav>

      <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          {messages.home.title}
        </h1>
        <p className="text-xl text-gray-600">
          {messages.home.subtitle}
        </p>
        <p className="mt-4">
          <a href="/admin">{messages.common.openCms}</a>
        </p>
      </header>

      <section>
        <h2 className="text-3xl font-semibold mb-8 text-center">
          {messages.home.availableClasses}
        </h2>

        {classTemplates.docs.length > 0 ? (
          <ClassFilter classes={classTemplates.docs} tags={tags.docs} messages={messages} locale={locale} />
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

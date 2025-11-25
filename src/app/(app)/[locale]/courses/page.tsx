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

  const title = messages.nav.courses
  const description =
    locale === 'es'
      ? 'Cursos de arte multi-sesión en Madrid. Aprende técnicas artísticas en profundidad con nuestros programas estructurados.'
      : 'Multi-session art courses in Madrid. Learn artistic techniques in depth with our structured programs.'

  return {
    title: `${title} | bizcocho.art`,
    description,
    keywords: ['art courses', 'multi-session classes', 'art programs', 'cursos de arte'],
    openGraph: {
      title: `${title} | bizcocho.art`,
      description,
      url: `https://bizcocho.art/${locale}/courses`,
      siteName: 'bizcocho.art',
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `https://bizcocho.art/${locale}/courses`,
      languages: {
        en: 'https://bizcocho.art/en/courses',
        es: 'https://bizcocho.art/es/courses',
      },
    },
  }
}

export default async function CoursesPage({ params }: Props) {
  const { locale } = await params
  const messages = getMessages(locale)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{messages.nav.courses}</h1>
        <p className="text-lg text-gray-600 mb-8">
          {locale === 'es'
            ? 'Cursos multi-sesión llegando pronto. Aprende nuevas habilidades artísticas en nuestros cursos estructurados.'
            : 'Multi-session courses coming soon. Learn new artistic skills in our structured courses.'}
        </p>
        <div className="bg-white rounded-lg shadow-md p-12">
          <div className="text-6xl mb-6">🎨</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {locale === 'es' ? 'Próximamente' : 'Coming Soon'}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {locale === 'es'
              ? 'Estamos preparando una increíble selección de cursos de arte multi-sesión. Mantente atento para sesiones más profundas que te ayudarán a dominar nuevas técnicas.'
              : "We're preparing an amazing selection of multi-session art courses. Stay tuned for deeper sessions that will help you master new techniques."}
          </p>
        </div>
      </div>
    </div>
  )
}

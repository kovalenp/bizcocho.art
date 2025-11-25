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

  const title = messages.nav.about
  const description =
    locale === 'es'
      ? 'Conoce bizcocho.art, tu espacio creativo en Madrid. Clases de arte para todos los niveles en Calle de las Artes, 123.'
      : 'Discover bizcocho.art, your creative space in Madrid. Art classes for all levels at Calle de las Artes, 123.'

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
  const messages = getMessages(locale)

  const isSpanish = locale === 'es'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">{messages.nav.about}</h1>

        {/* Our Story Section */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {isSpanish ? 'Nuestra Historia' : 'Our Story'}
          </h2>
          <div className="prose prose-lg text-gray-700">
            <p className="mb-4">
              {isSpanish
                ? 'bizcocho.art nació de la pasión por hacer el arte accesible para todos. Creemos que la creatividad es un regalo universal, y nuestro objetivo es proporcionar un espacio acogedor donde personas de todos los niveles puedan explorar su potencial artístico.'
                : 'bizcocho.art was born from a passion for making art accessible to everyone. We believe that creativity is a universal gift, and our goal is to provide a welcoming space where people of all skill levels can explore their artistic potential.'}
            </p>
            <p className="mb-4">
              {isSpanish
                ? 'Ya seas un principiante completo o un artista experimentado, nuestras clases están diseñadas para inspirar, educar y crear una comunidad de entusiastas del arte.'
                : "Whether you're a complete beginner or an experienced artist, our classes are designed to inspire, educate, and build a community of art enthusiasts."}
            </p>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {isSpanish ? 'Contáctanos' : 'Contact Us'}
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isSpanish ? 'Ubicación' : 'Location'}
              </h3>
              <p className="text-gray-700">
                Calle de las Artes, 123
                <br />
                28001 Madrid, España
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isSpanish ? 'Correo Electrónico' : 'Email'}
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
                {isSpanish ? 'Teléfono' : 'Phone'}
              </h3>
              <p className="text-gray-700">
                <a href="tel:+34912345678" className="text-primary hover:underline">
                  +34 91 234 5678
                </a>
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isSpanish ? 'Horario' : 'Hours'}
              </h3>
              <p className="text-gray-700">
                {isSpanish ? 'Lunes - Sábado: 10:00 - 20:00' : 'Monday - Saturday: 10:00 AM - 8:00 PM'}
                <br />
                {isSpanish ? 'Domingo: Cerrado' : 'Sunday: Closed'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

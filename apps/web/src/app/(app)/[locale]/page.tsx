import { getPayload } from 'payload'
import config from '@payload-config'
import type { ClassTemplate, Media } from '@/payload-types'
import type { Locale } from '@/i18n/config'
import { LanguageSelector } from '@/components/LanguageSelector'

type Props = {
  params: Promise<{
    locale: Locale
  }>
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  const payload = await getPayload({ config })

  const classTemplates = await payload.find({
    collection: 'class-templates',
    where: {
      isPublished: {
        equals: true,
      },
    },
    depth: 2,
    limit: 10,
    locale,
  })

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <nav
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '2rem',
        }}
      >
        <LanguageSelector currentLocale={locale} />
      </nav>

      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 3vw, 3rem)', marginBottom: '1rem' }}>
          bozchocho.art
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#666' }}>
          {locale === 'es'
            ? 'Descubre tu creatividad a través de clases de arte'
            : 'Discover your creativity through art classes'}
        </p>
        <p style={{ marginTop: '1rem' }}>
          <a href="/admin">Open CMS (Payload)</a>
        </p>
      </header>

      <section>
        <h2 style={{ fontSize: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
          {locale === 'es' ? 'Clases Disponibles' : 'Available Classes'}
        </h2>

        {classTemplates.docs.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem',
            }}
          >
            {classTemplates.docs.map((classItem) => (
              <ClassCard key={classItem.id} data={classItem} locale={locale} />
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem',
              background: '#f9f9f9',
              borderRadius: '8px',
            }}
          >
            <h3 style={{ color: '#666' }}>
              {locale === 'es' ? 'No hay clases disponibles' : 'No classes available'}
            </h3>
            <p style={{ color: '#888' }}>
              {locale === 'es'
                ? '¡Vuelve pronto para nuevas clases de arte!'
                : 'Check back soon for new art classes!'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

function ClassCard({ data, locale }: { data: ClassTemplate; locale: Locale }) {
  const featuredImage = data.featuredImage as Media | null

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'transform 0.2s ease',
      }}
    >
      {featuredImage?.url && (
        <img
          src={featuredImage.url}
          alt={data.title}
          style={{
            width: '100%',
            height: '200px',
            objectFit: 'cover',
          }}
        />
      )}
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#333' }}>
          {data.title}
        </h3>
        {data.description && (
          <p style={{ margin: '0 0 1rem 0', color: '#666', lineHeight: '1.5' }}>
            {data.description}
          </p>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#007acc' }}>
            €{((data.priceCents || 0) / 100).toFixed(2)}
          </span>
          <span
            style={{
              background: '#f0f0f0',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.9rem',
            }}
          >
            {data.maxCapacity || 0} {locale === 'es' ? 'plazas' : 'spots'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#888' }}>
          <span>⏱️ {data.durationMinutes || 0} {locale === 'es' ? 'min' : 'min'}</span>
          {data.location && <span>📍 {data.location}</span>}
        </div>
      </div>
    </div>
  )
}

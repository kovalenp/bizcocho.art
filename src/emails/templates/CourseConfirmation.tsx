import { Section, Text, Row, Column } from '@react-email/components'
import { Layout } from '../components'
import { courseConfirmationTranslations } from '../translations'
import type { Locale } from '../../i18n/config'

export interface SessionInfo {
  date: string
  time: string
}

export interface CourseConfirmationProps {
  courseTitle: string
  sessions: SessionInfo[]
  location: string
  numberOfPeople: number
  totalPrice: string
  bookingId: string | number
  locale?: Locale
}

export function CourseConfirmation({
  courseTitle,
  sessions,
  location,
  numberOfPeople,
  totalPrice,
  bookingId,
  locale = 'en',
}: CourseConfirmationProps) {
  const t = courseConfirmationTranslations[locale]

  return (
    <Layout preview={t.title} title={t.title} footerMessage={t.footer} locale={locale}>
      <Text className="text-[15px] text-gray-700 m-0 mb-8 leading-relaxed">{t.intro}</Text>

      <Section className="bg-gray-50 rounded-lg p-6 mb-6">
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.courseLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">{courseTitle}</Column>
        </Row>
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.sessionsLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">{sessions.length}</Column>
        </Row>
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.locationLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">{location}</Column>
        </Row>
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.attendeesLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">{numberOfPeople}</Column>
        </Row>
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.priceLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">{totalPrice}</Column>
        </Row>
        <Row>
          <Column className="w-[45%] text-sm text-gray-500">{t.bookingRefLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">#{bookingId}</Column>
        </Row>
      </Section>

      <Section className="bg-green-50 rounded-lg px-6 py-5 mb-6">
        <Text className="text-sm font-semibold text-green-800 m-0 mb-3">{t.scheduleTitle}</Text>
        {sessions.map((session, index) => (
          <Text key={index} className="text-sm text-green-700 m-0 mb-2 leading-relaxed">
            {t.sessionPrefix} {index + 1}: {session.date} {t.timePrefix} {session.time}
          </Text>
        ))}
      </Section>

      <Section className="bg-amber-50 rounded-lg px-5 py-4">
        <Text className="text-[13px] text-amber-800 m-0 leading-relaxed">
          {t.cancellationPolicy}
        </Text>
      </Section>
    </Layout>
  )
}

// Default props for React Email preview
CourseConfirmation.PreviewProps = {
  courseTitle: 'Ceramic Wheel Throwing Course',
  sessions: [
    { date: 'Mon, Dec 9', time: '10:00 AM' },
    { date: 'Wed, Dec 11', time: '10:00 AM' },
    { date: 'Fri, Dec 13', time: '10:00 AM' },
  ],
  location: 'Studio 42, Madrid',
  numberOfPeople: 2,
  totalPrice: '€180.00',
  bookingId: '12345',
  locale: 'en' as const,
}

export default CourseConfirmation

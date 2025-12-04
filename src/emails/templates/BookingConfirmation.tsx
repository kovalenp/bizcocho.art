import { Section, Text, Row, Column } from '@react-email/components'
import { Layout } from '../components'
import { bookingConfirmationTranslations } from '../translations'
import type { Locale } from '../../i18n/config'

export interface BookingConfirmationProps {
  classTitle: string
  sessionDate: string
  sessionTime: string
  location: string
  numberOfPeople: number
  totalPrice: string
  bookingId: string | number
  locale?: Locale
}

export function BookingConfirmation({
  classTitle,
  sessionDate,
  sessionTime,
  location,
  numberOfPeople,
  totalPrice,
  bookingId,
  locale = 'en',
}: BookingConfirmationProps) {
  const t = bookingConfirmationTranslations[locale]

  return (
    <Layout preview={t.title} title={t.title} footerMessage={t.footer} locale={locale}>
      <Text className="text-[15px] text-gray-700 m-0 mb-8 leading-relaxed">{t.intro}</Text>

      <Section className="bg-gray-50 rounded-lg p-6 mb-6">
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.classLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">{classTitle}</Column>
        </Row>
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.dateLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">{sessionDate}</Column>
        </Row>
        <Row className="mb-4 pb-4 border-b border-gray-200">
          <Column className="w-[45%] text-sm text-gray-500">{t.timeLabel}</Column>
          <Column className="w-[55%] text-sm text-gray-900 font-medium">{sessionTime}</Column>
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

      <Section className="bg-amber-50 rounded-lg px-5 py-4">
        <Text className="text-[13px] text-amber-800 m-0 leading-relaxed">
          {t.cancellationPolicy}
        </Text>
      </Section>
    </Layout>
  )
}

// Default props for React Email preview
BookingConfirmation.PreviewProps = {
  classTitle: 'Ceramic Wheel Throwing Workshop',
  sessionDate: 'Saturday, December 14, 2024',
  sessionTime: '10:00 AM',
  location: 'Studio 42, Madrid',
  numberOfPeople: 2,
  totalPrice: '€60.00',
  bookingId: '12345',
  locale: 'en' as const,
}

export default BookingConfirmation

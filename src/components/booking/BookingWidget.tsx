'use client'

import type { Class, Session } from '@/payload-types'
import type { Messages } from '@/i18n/messages'
import { useBookingProcess, type BookingFormData } from '@/hooks/useBookingProcess'
import { BookingContactForm } from './BookingContactForm'
import { BookingPriceDisplay } from './BookingPriceDisplay'
import { BookingStatusMessage } from './BookingStatusMessage'
import { GiftCodeInput } from './GiftCodeInput'

type BookingWidgetProps = {
  classTemplate: Class
  classSessions: Session[]
  selectedSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  messages: Messages
  locale: string
}

export function BookingWidget({
  classTemplate,
  classSessions,
  selectedSessionId,
  onSessionSelect: _onSessionSelect,
  messages,
  locale,
}: BookingWidgetProps) {
  const {
    status,
    giftDiscount,
    numberOfPeople,
    totalPriceCents,
    discountedPriceCents,
    submitBooking,
    applyGiftCode,
    removeGiftCode,
    setNumberOfPeople,
  } = useBookingProcess(classTemplate, locale)

  const selectedSession = classSessions.find((s) => s.id.toString() === selectedSessionId)
  const availableSpots = selectedSession
    ? selectedSession.availableSpots !== undefined && selectedSession.availableSpots !== null
      ? selectedSession.availableSpots
      : classTemplate.maxCapacity || 0
    : 0

  const handleSubmit = async (data: BookingFormData) => {
    await submitBooking(data)
  }

  const handleNumberOfPeopleChange = (newNumber: number) => {
    setNumberOfPeople(newNumber)
    // Clear gift discount when quantity changes - forces re-validation
    // This ensures discount is recalculated for new total (gift card balance may allow more)
    if (giftDiscount) {
      removeGiftCode()
    }
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-md sticky top-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">{messages.booking.title}</h2>

      {/* Loading or Success State */}
      {(status === 'loading' || status === 'success') && (
        <BookingStatusMessage status={status} messages={messages} />
      )}

      {/* Idle or Error State - Show Form */}
      {status !== 'loading' && status !== 'success' && (
        <>
          {/* Price Display */}
          <BookingPriceDisplay
            totalPriceCents={totalPriceCents}
            discountedPriceCents={discountedPriceCents}
            numberOfPeople={numberOfPeople}
            pricePerPersonCents={classTemplate.priceCents || 0}
            hasDiscount={!!giftDiscount}
          />

          {/* Gift Code Input - key forces remount when numberOfPeople changes */}
          <div className="mb-6">
            <GiftCodeInput
              key={numberOfPeople}
              totalCents={totalPriceCents}
              onDiscountApplied={applyGiftCode}
              onDiscountRemoved={removeGiftCode}
              messages={messages}
            />
          </div>

          {/* Error Message */}
          {status === 'error' && (
            <BookingStatusMessage status={status} messages={messages} />
          )}

          {/* Booking Form - Only show when session is selected */}
          {selectedSessionId && selectedSession && (
            <>
              {availableSpots === 0 ? (
                <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                  <div className="text-yellow-800 font-semibold mb-2">Session Full</div>
                  <p className="text-sm text-yellow-700">
                    This session is fully booked. Please select another session.
                  </p>
                </div>
              ) : (
                <BookingContactForm
                  sessionId={selectedSessionId}
                  maxSpots={availableSpots}
                  onSubmit={handleSubmit}
                  onNumberOfPeopleChange={handleNumberOfPeopleChange}
                  messages={messages}
                />
              )}
            </>
          )}

          {!selectedSessionId && classSessions.length > 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Please select a session to continue
            </p>
          )}
        </>
      )}
    </div>
  )
}

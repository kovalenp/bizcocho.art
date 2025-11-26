'use client'

import { useState } from 'react'
import type { Class, Session } from '@/payload-types'
import type { Messages } from '@/i18n/messages'
import { BookingContactForm } from './BookingContactForm'

type BookingWidgetProps = {
  classTemplate: Class
  classSessions: Session[]
  selectedSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onSessionsUpdate?: (sessions: Session[]) => void
  messages: Messages
  locale: string
}

type BookingFormData = {
  sessionId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
}

export function BookingWidget({
  classTemplate,
  classSessions,
  selectedSessionId,
  onSessionSelect: _onSessionSelect,
  onSessionsUpdate: _onSessionsUpdate,
  messages,
  locale,
}: BookingWidgetProps) {
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle')
  const [numberOfPeople, setNumberOfPeople] = useState(1)

  const selectedSession = classSessions.find((s) => s.id.toString() === selectedSessionId)
  const availableSpots = selectedSession
    ? selectedSession.availableSpots !== undefined && selectedSession.availableSpots !== null
      ? selectedSession.availableSpots
      : classTemplate.maxCapacity || 0
    : 0

  const pricePerPerson = (classTemplate.priceCents || 0) / 100
  const totalPrice = pricePerPerson * numberOfPeople

  const handleSubmit = async (data: BookingFormData) => {
    setSubmitStatus('loading')

    try {
      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId: classTemplate.id.toString(),
          sessionId: data.sessionId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          numberOfPeople: data.numberOfPeople,
          locale: locale,
        }),
      })

      const result = await response.json()
      console.log('Checkout API response:', result)

      if (!response.ok) {
        const errorMsg = result.error || 'Checkout session creation failed'
        console.error('Checkout API error:', errorMsg, result)
        throw new Error(errorMsg)
      }

      if (result.checkoutUrl) {
        console.log('Redirecting to Stripe:', result.checkoutUrl)
        // Redirect to Stripe checkout
        window.location.href = result.checkoutUrl
      } else {
        console.error('No checkout URL in response:', result)
        throw new Error('No checkout URL received')
      }
    } catch (error) {
      console.error('Booking error:', error)
      setSubmitStatus('error')
    }
  }

  const handleNumberOfPeopleChange = (newNumber: number) => {
    setNumberOfPeople(newNumber)
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-md sticky top-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">{messages.booking.title}</h2>

      {submitStatus === 'loading' ? (
        <div className="p-8 bg-blue-50 border-2 border-blue-300 rounded-lg text-center">
          <div className="animate-spin text-6xl mb-4">⟳</div>
          <h3 className="text-2xl font-semibold text-blue-900 mb-2">
            {messages.booking.redirecting || 'Redirecting to payment...'}
          </h3>
          <p className="text-blue-800 text-lg">
            {messages.booking.pleaseWait || 'Please wait while we redirect you to secure checkout.'}
          </p>
        </div>
      ) : submitStatus === 'success' ? (
        <div className="p-8 bg-green-50 border-2 border-green-300 rounded-lg text-center">
          <div className="text-6xl mb-4">✓</div>
          <h3 className="text-2xl font-semibold text-green-900 mb-2">
            {messages.booking.successTitle}
          </h3>
          <p className="text-green-800 text-lg">{messages.booking.success}</p>
        </div>
      ) : (
        <>
          {/* Price Display */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Total Price</div>
                <div className="text-3xl font-bold text-primary">€{totalPrice.toFixed(2)}</div>
              </div>
              {numberOfPeople > 1 && (
                <div className="text-sm text-gray-500">
                  €{pricePerPerson.toFixed(2)} × {numberOfPeople}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {submitStatus === 'error' && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {messages.booking.error}
            </div>
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

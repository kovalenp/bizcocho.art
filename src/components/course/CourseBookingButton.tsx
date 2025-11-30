'use client'

import { useState } from 'react'
import { GiftCodeInput } from '@/components/booking/GiftCodeInput'
import type { Messages } from '@/i18n/messages'

type CourseBookingButtonProps = {
  classId: number // unified: always classId
  priceCents: number
  currency: string
  maxCapacity: number
  availableSpots: number
  locale: 'en' | 'es'
  messages: Messages
}

type BookingFormData = {
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
}

export function CourseBookingButton({
  classId,
  priceCents,
  currency,
  maxCapacity,
  availableSpots,
  locale,
  messages,
}: CourseBookingButtonProps) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<BookingFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    numberOfPeople: 1,
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [giftDiscount, setGiftDiscount] = useState<{
    code: string
    discountCents: number
    remainingToPayCents: number
  } | null>(null)

  const currencySymbol = currency === 'eur' ? '€' : '$'
  const pricePerPerson = priceCents / 100
  const totalPriceCents = priceCents * formData.numberOfPeople
  const totalPrice = totalPriceCents / 100
  const discountedPriceCents = giftDiscount ? giftDiscount.remainingToPayCents : totalPriceCents
  const discountedPrice = discountedPriceCents / 100
  const spotsAvailable = availableSpots > 0 ? availableSpots : maxCapacity

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    try {
      // Unified checkout API - uses classId, no sessionId for courses
      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: classId.toString(),
          // No sessionId - course booking books all sessions
          ...formData,
          locale,
          giftCode: giftDiscount?.code,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Booking failed')
      }

      // Handle gift-only checkout (no Stripe payment needed)
      if (result.giftOnlyCheckout && result.checkoutData) {
        const giftOnlyResponse = await fetch('/api/checkout/gift-only', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.checkoutData),
        })

        const giftOnlyResult = await giftOnlyResponse.json()

        if (!giftOnlyResponse.ok) {
          throw new Error(giftOnlyResult.error || 'Gift-only checkout failed')
        }

        if (giftOnlyResult.redirectUrl) {
          window.location.href = giftOnlyResult.redirectUrl
        }
        return
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      } else {
        throw new Error('No checkout URL received')
      }
    } catch (error) {
      console.error('Course booking error:', error)
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Booking failed')
    }
  }

  const handleInputChange = (field: keyof BookingFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (spotsAvailable <= 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
        <span className="text-yellow-800 font-medium">
          {locale === 'es' ? 'Curso completo' : 'Course Full'}
        </span>
      </div>
    )
  }

  if (!showForm) {
    return (
      <button
        className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
        onClick={() => setShowForm(true)}
      >
        {locale === 'es' ? 'Reservar Curso Completo' : 'Book Entire Course'}
      </button>
    )
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">
          {locale === 'es' ? 'Reservar Curso' : 'Book Course'}
        </h3>
        <button
          onClick={() => setShowForm(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Price Display */}
      <div className="mb-4 p-3 bg-white rounded-lg">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-sm text-gray-600">
              {locale === 'es' ? 'Precio Total' : 'Total Price'}
            </div>
            {giftDiscount ? (
              <div>
                <div className="text-lg text-gray-400 line-through">
                  {currencySymbol}{totalPrice.toFixed(2)}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {discountedPriceCents === 0
                    ? (locale === 'es' ? 'GRATIS' : 'FREE')
                    : `${currencySymbol}${discountedPrice.toFixed(2)}`}
                </div>
              </div>
            ) : (
              <div className="text-2xl font-bold text-primary">
                {currencySymbol}{totalPrice.toFixed(2)}
              </div>
            )}
          </div>
          {formData.numberOfPeople > 1 && !giftDiscount && (
            <div className="text-sm text-gray-500">
              {currencySymbol}{pricePerPerson.toFixed(2)} × {formData.numberOfPeople}
            </div>
          )}
        </div>
      </div>

      {/* Gift Code Input */}
      <div className="mb-4">
        <GiftCodeInput
          totalCents={totalPriceCents}
          onDiscountApplied={(discount) => setGiftDiscount(discount)}
          onDiscountRemoved={() => setGiftDiscount(null)}
          messages={messages}
        />
      </div>

      {status === 'error' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {errorMessage || (locale === 'es' ? 'Error al procesar la reserva' : 'Booking failed')}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {locale === 'es' ? 'Nombre' : 'First Name'}
            </label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {locale === 'es' ? 'Apellido' : 'Last Name'}
            </label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {locale === 'es' ? 'Correo Electrónico' : 'Email'}
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {locale === 'es' ? 'Teléfono' : 'Phone'}
          </label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {locale === 'es' ? 'Número de Personas' : 'Number of People'}
          </label>
          <select
            value={formData.numberOfPeople}
            onChange={(e) => handleInputChange('numberOfPeople', parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {Array.from({ length: Math.min(spotsAvailable, 10) }, (_, i) => i + 1).map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading'
            ? (locale === 'es' ? 'Procesando...' : 'Processing...')
            : (locale === 'es' ? 'Continuar al Pago' : 'Continue to Payment')
          }
        </button>
      </form>
    </div>
  )
}

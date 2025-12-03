'use client'

import { useState, useCallback } from 'react'
import type { Class } from '@/payload-types'

export type GiftDiscount = {
  code: string
  discountCents: number
  remainingToPayCents: number
}

export type BookingFormData = {
  sessionId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
}

export type BookingStatus = 'idle' | 'loading' | 'success' | 'error'
export type BookingErrorKey = 'error' | 'errorCapacity' | null

export type UseBookingProcessReturn = {
  status: BookingStatus
  errorKey: BookingErrorKey
  giftDiscount: GiftDiscount | null
  numberOfPeople: number
  totalPriceCents: number
  discountedPriceCents: number
  submitBooking: (data: BookingFormData) => Promise<void>
  applyGiftCode: (discount: GiftDiscount) => void
  removeGiftCode: () => void
  setNumberOfPeople: (count: number) => void
  resetStatus: () => void
}

/**
 * Hook for managing booking process state and logic.
 * Handles form submission, gift codes, and price calculations.
 */
export function useBookingProcess(
  classTemplate: Class,
  locale: string
): UseBookingProcessReturn {
  const [status, setStatus] = useState<BookingStatus>('idle')
  const [errorKey, setErrorKey] = useState<BookingErrorKey>(null)
  const [giftDiscount, setGiftDiscount] = useState<GiftDiscount | null>(null)
  const [numberOfPeople, setNumberOfPeople] = useState(1)

  // Calculate prices dynamically (never use stale cached values)
  const totalPriceCents = (classTemplate.priceCents || 0) * numberOfPeople
  const discountedPriceCents = giftDiscount
    ? Math.max(0, totalPriceCents - giftDiscount.discountCents)
    : totalPriceCents

  const applyGiftCode = useCallback((discount: GiftDiscount) => {
    setGiftDiscount(discount)
  }, [])

  const removeGiftCode = useCallback(() => {
    setGiftDiscount(null)
  }, [])

  const resetStatus = useCallback(() => {
    setStatus('idle')
    setErrorKey(null)
  }, [])

  const submitBooking = useCallback(
    async (data: BookingFormData) => {
      setStatus('loading')
      setErrorKey(null)

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
            giftCode: giftDiscount?.code,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          console.error('Checkout API error:', result.error, result)
          if (response.status === 409) {
            setErrorKey('errorCapacity')
            throw new Error('Capacity error') // Handled by setting errorKey
          }
          throw new Error(result.error || 'Checkout session creation failed')
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
          } else {
            setStatus('success')
          }
          return
        }

        if (result.checkoutUrl) {
          // Redirect to Stripe checkout
          window.location.href = result.checkoutUrl
        } else {
          console.error('No checkout URL in response:', result)
          throw new Error('No checkout URL received')
        }
      } catch (error) {
        console.error('Booking error:', error)
        setStatus('error')
        // If specific errorKey wasn't set, set generic error
        setErrorKey((prev) => prev || 'error')
      }
    },
    [classTemplate.id, locale, giftDiscount]
  )

  return {
    status,
    errorKey,
    giftDiscount,
    numberOfPeople,
    totalPriceCents,
    discountedPriceCents,
    submitBooking,
    applyGiftCode,
    removeGiftCode,
    setNumberOfPeople,
    resetStatus,
  }
}

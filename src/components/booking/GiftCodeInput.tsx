'use client'

import { useState } from 'react'
import type { Messages } from '@/i18n/messages'

type GiftCodeValidation = {
  valid: boolean
  type?: 'gift' | 'promo'
  discountCents?: number
  remainingToPayCents?: number
  currentBalanceCents?: number
  discountType?: 'percentage' | 'fixed'
  discountValue?: number
  currency?: string
  expiresAt?: string
  error?: string
}

type GiftCodeInputProps = {
  totalCents: number
  onDiscountApplied: (discount: { code: string; discountCents: number; remainingToPayCents: number }) => void
  onDiscountRemoved: () => void
  messages: Messages
}

export function GiftCodeInput({
  totalCents,
  onDiscountApplied,
  onDiscountRemoved,
  messages,
}: GiftCodeInputProps) {
  const [code, setCode] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validation, setValidation] = useState<GiftCodeValidation | null>(null)
  const [appliedCode, setAppliedCode] = useState<string | null>(null)

  const t = messages.giftCode || {
    placeholder: 'Enter gift or promo code',
    apply: 'Apply',
    remove: 'Remove',
    validating: 'Validating...',
    discountApplied: 'Discount applied',
    youSave: 'You save',
    remaining: 'Remaining to pay',
    fullyCovered: 'Fully covered by gift code!',
    invalid: 'Invalid or expired code',
  }

  const handleApply = async () => {
    if (!code.trim()) return

    setIsValidating(true)
    setValidation(null)

    try {
      const response = await fetch('/api/gift-certificates/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), totalCents }),
      })

      const result: GiftCodeValidation = await response.json()

      if (result.valid && result.discountCents !== undefined) {
        setValidation(result)
        setAppliedCode(code.trim())
        onDiscountApplied({
          code: code.trim(),
          discountCents: result.discountCents,
          remainingToPayCents: result.remainingToPayCents || 0,
        })
      } else {
        setValidation({ valid: false, error: result.error || t.invalid })
      }
    } catch {
      setValidation({ valid: false, error: t.invalid })
    } finally {
      setIsValidating(false)
    }
  }

  const handleRemove = () => {
    setCode('')
    setValidation(null)
    setAppliedCode(null)
    onDiscountRemoved()
  }

  const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2)}`

  // If a code is applied, show the discount info
  // Calculate remaining dynamically from current totalCents (not stale cached value)
  if (appliedCode && validation?.valid) {
    const discountCents = validation.discountCents || 0
    const remainingCents = Math.max(0, totalCents - discountCents)
    const isFullyCovered = remainingCents === 0

    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-lg">✓</span>
            <span className="font-medium text-green-800">{t.discountApplied}</span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-sm text-green-700 hover:text-green-900 underline"
          >
            {t.remove}
          </button>
        </div>
        <div className="text-sm text-green-700 space-y-1">
          <div className="flex justify-between">
            <span>Code:</span>
            <span className="font-mono font-medium">{appliedCode}</span>
          </div>
          <div className="flex justify-between">
            <span>{t.youSave}:</span>
            <span className="font-medium">-{formatPrice(discountCents)}</span>
          </div>
          {isFullyCovered ? (
            <div className="text-green-800 font-medium mt-2 text-center bg-green-100 rounded p-2">
              {t.fullyCovered}
            </div>
          ) : (
            <div className="flex justify-between border-t border-green-200 pt-2 mt-2">
              <span>{t.remaining}:</span>
              <span className="font-bold">{formatPrice(remainingCents)}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t.placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                     disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={isValidating}
          maxLength={9} // XXXX-XXXX
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={!code.trim() || isValidating}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium
                     hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {isValidating ? t.validating : t.apply}
        </button>
      </div>

      {/* Error message */}
      {validation && !validation.valid && (
        <div className="text-sm text-red-600 flex items-center gap-1">
          <span>✕</span>
          <span>{validation.error}</span>
        </div>
      )}
    </div>
  )
}

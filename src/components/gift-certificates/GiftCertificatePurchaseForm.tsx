'use client'

import { useState } from 'react'
import type { Messages } from '@/i18n/messages'

type GiftCertificatePurchaseFormProps = {
  messages: Messages
  locale: string
}

const PRESET_AMOUNTS = [2500, 5000, 10000] // in cents: €25, €50, €100
const MIN_AMOUNT_CENTS = 1000 // €10
const MAX_AMOUNT_CENTS = 50000 // €500

export function GiftCertificatePurchaseForm({ messages, locale }: GiftCertificatePurchaseFormProps) {
  const t = messages.giftCertificates

  const [selectedAmount, setSelectedAmount] = useState<number | 'custom'>(5000)
  const [customAmount, setCustomAmount] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [personalMessage, setPersonalMessage] = useState('')
  const [purchaserName, setPurchaserName] = useState('')
  const [purchaserEmail, setPurchaserEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getAmountCents = (): number => {
    if (selectedAmount === 'custom') {
      const parsed = parseFloat(customAmount)
      return isNaN(parsed) ? 0 : Math.round(parsed * 100)
    }
    return selectedAmount
  }

  const amountCents = getAmountCents()
  const isValidAmount = amountCents >= MIN_AMOUNT_CENTS && amountCents <= MAX_AMOUNT_CENTS
  const isFormValid = isValidAmount && recipientName && recipientEmail && purchaserName && purchaserEmail

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/gift-certificates/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          recipientName,
          recipientEmail,
          personalMessage: personalMessage || undefined,
          purchaserName,
          purchaserEmail,
          locale,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Purchase failed')
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsSubmitting(false)
    }
  }

  const formatPrice = (cents: number) => `€${(cents / 100).toFixed(0)}`

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Amount Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.selectAmount}</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {PRESET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setSelectedAmount(amount)}
              className={`py-4 px-6 rounded-lg border-2 text-lg font-semibold transition-all ${
                selectedAmount === amount
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {formatPrice(amount)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedAmount('custom')}
            className={`py-4 px-6 rounded-lg border-2 text-lg font-semibold transition-all ${
              selectedAmount === 'custom'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.customAmount}
          </button>
        </div>

        {selectedAmount === 'custom' && (
          <div className="mt-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">€</span>
              <input
                type="number"
                min={MIN_AMOUNT_CENTS / 100}
                max={MAX_AMOUNT_CENTS / 100}
                step="1"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder={t.customAmountPlaceholder}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {t.minAmount} - {t.maxAmount}
            </p>
          </div>
        )}
      </div>

      {/* Recipient Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.recipientInfo}</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-1">
              {t.recipientName} *
            </label>
            <input
              type="text"
              id="recipientName"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-1">
              {t.recipientEmail} *
            </label>
            <input
              type="email"
              id="recipientEmail"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="personalMessage" className="block text-sm font-medium text-gray-700 mb-1">
              {t.personalMessage}
            </label>
            <textarea
              id="personalMessage"
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              rows={3}
              placeholder={t.personalMessagePlaceholder}
              maxLength={500}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>
        </div>
      </div>

      {/* Purchaser Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.yourInfo}</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="purchaserName" className="block text-sm font-medium text-gray-700 mb-1">
              {t.yourName} *
            </label>
            <input
              type="text"
              id="purchaserName"
              value={purchaserName}
              onChange={(e) => setPurchaserName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="purchaserEmail" className="block text-sm font-medium text-gray-700 mb-1">
              {t.yourEmail} *
            </label>
            <input
              type="email"
              id="purchaserEmail"
              value={purchaserEmail}
              onChange={(e) => setPurchaserEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t.preview}</h2>
        <p className="text-sm text-gray-600 mb-4">{t.previewDescription}</p>

        <div className="bg-white rounded-lg p-6 shadow-inner">
          <div className="text-center">
            <div className="text-5xl mb-3">🎨</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">bizcocho.art</h3>
            <p className="text-gray-600 mb-4">Gift Certificate</p>
            <div className="text-4xl font-bold text-primary mb-4">
              {isValidAmount ? formatPrice(amountCents) : '€--'}
            </div>
            {recipientName && (
              <p className="text-gray-700">
                For: <span className="font-semibold">{recipientName}</span>
              </p>
            )}
            {personalMessage && (
              <p className="mt-4 text-gray-600 italic">&quot;{personalMessage}&quot;</p>
            )}
            {purchaserName && (
              <p className="mt-2 text-sm text-gray-500">From: {purchaserName}</p>
            )}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600 flex items-center justify-center gap-2">
          <span>{t.validity}:</span>
          <span className="font-medium">{t.validityMonths}</span>
        </div>
      </div>

      {/* Terms */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <h3 className="font-medium text-gray-700 mb-1">{t.termsTitle}</h3>
        <p>{t.termsText}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!isFormValid || isSubmitting}
        className="w-full py-4 px-6 bg-primary text-white text-lg font-semibold rounded-lg
                   hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {isSubmitting ? t.purchasing : `${t.purchaseButton} - ${isValidAmount ? formatPrice(amountCents) : '€--'}`}
      </button>
    </form>
  )
}

'use client'

import { useState } from 'react'
import type { Messages } from '@/i18n/messages'

type GiftCertificateBalanceCheckerProps = {
  messages: Messages
  locale: string
}

type BalanceResult = {
  valid: boolean
  type?: 'gift' | 'promo'
  status?: string
  currentBalanceCents?: number
  initialValueCents?: number
  currency?: string
  expiresAt?: string
  error?: string
}

export function GiftCertificateBalanceChecker({ messages, locale }: GiftCertificateBalanceCheckerProps) {
  const t = messages.giftCertificates

  const [code, setCode] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<BalanceResult | null>(null)

  const handleCheck = async () => {
    if (!code.trim()) return

    setIsChecking(true)
    setResult(null)

    try {
      const response = await fetch('/api/gift-certificates/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), totalCents: 0 }),
      })

      const data = await response.json()
      setResult(data)
    } catch {
      setResult({ valid: false, error: t.codeNotFound })
    } finally {
      setIsChecking(false)
    }
  }

  const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2)}`

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return t.statusActive
      case 'partial':
        return t.statusPartial
      case 'redeemed':
        return t.statusRedeemed
      case 'expired':
        return t.statusExpired
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'partial':
        return 'bg-yellow-100 text-yellow-800'
      case 'redeemed':
        return 'bg-gray-100 text-gray-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.checkBalanceTitle}</h2>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t.enterCode}
          maxLength={9}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-lg font-mono
                     focus:ring-2 focus:ring-primary focus:border-transparent
                     uppercase"
        />
        <button
          onClick={handleCheck}
          disabled={!code.trim() || isChecking}
          className="px-6 py-3 bg-primary text-white font-medium rounded-lg
                     hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {isChecking ? t.checking : t.check}
        </button>
      </div>

      {result && (
        <div className="mt-4">
          {result.valid && result.type === 'gift' ? (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.balanceTitle}</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">{t.currentBalance}</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(result.currentBalanceCents || 0)}
                  </span>
                </div>

                {result.initialValueCents && result.initialValueCents !== result.currentBalanceCents && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-600">{t.originalValue}</span>
                    <span className="text-lg text-gray-700">{formatPrice(result.initialValueCents)}</span>
                  </div>
                )}

                {result.expiresAt && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-600">{t.expiresOn}</span>
                    <span className="text-gray-700">{formatDate(result.expiresAt)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t.status}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(result.status || '')}`}>
                    {getStatusLabel(result.status || '')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {result.error || t.codeNotFound}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

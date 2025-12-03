import type { Payload, PayloadRequest } from 'payload'
import type { GiftCertificate } from '../payload-types'
import { normalizeCode, formatCode } from '../lib/gift-codes'
import { logError, logInfo } from '../lib/logger'

export type CodeValidationResult = {
  valid: boolean
  type?: 'gift' | 'promo'
  // For gift:
  currentBalanceCents?: number
  currency?: string
  // For promo:
  discountType?: 'percentage' | 'fixed'
  discountValue?: number
  // Common:
  expiresAt?: string
  error?: string
}

export type DiscountCalculation = {
  discountCents: number
  remainingToPayCents: number
  newGiftBalanceCents?: number // only for gift type
}

export type ApplyCodeResult = {
  success: boolean
  error?: string
}

/**
 * Service for managing gift certificates and promo codes.
 */
export class GiftCertificateService {
  constructor(private payload: Payload) {}

  /**
   * Validate a gift/promo code.
   */
  async validateCode(code: string): Promise<CodeValidationResult> {
    const normalizedCode = formatCode(normalizeCode(code))

    try {
      const result = await this.payload.find({
        collection: 'gift-certificates',
        where: { code: { equals: normalizedCode } },
        limit: 1,
      })

      if (result.docs.length === 0) {
        return { valid: false, error: 'Code not found' }
      }

      const cert = result.docs[0] as GiftCertificate

      // Check status
      if (cert.status === 'pending') {
        return { valid: false, error: 'Code is not yet active' }
      }
      if (cert.status === 'expired') {
        return { valid: false, error: 'Code has expired' }
      }
      if (cert.status === 'redeemed') {
        return { valid: false, error: 'Code has already been fully redeemed' }
      }

      // Check expiration
      if (cert.expiresAt && new Date(cert.expiresAt) < new Date()) {
        // Update status to expired
        await this.payload.update({
          collection: 'gift-certificates',
          id: cert.id,
          data: { status: 'expired' },
        })
        return { valid: false, error: 'Code has expired' }
      }

      // Type-specific checks
      if (cert.type === 'gift') {
        if (!cert.currentBalanceCents || cert.currentBalanceCents <= 0) {
          return { valid: false, error: 'Gift certificate has no remaining balance' }
        }

        return {
          valid: true,
          type: 'gift',
          currentBalanceCents: cert.currentBalanceCents,
          currency: cert.currency || 'eur',
          expiresAt: cert.expiresAt || undefined,
        }
      }

      if (cert.type === 'promo') {
        // Check usage limits (null maxUses = unlimited)
        if (cert.maxUses !== null && cert.maxUses !== undefined) {
          const currentUses = cert.currentUses || 0
          if (currentUses >= cert.maxUses) {
            return { valid: false, error: 'Promo code has reached its usage limit' }
          }
        }

        return {
          valid: true,
          type: 'promo',
          discountType: cert.discountType || undefined,
          discountValue: cert.discountValue || undefined,
          expiresAt: cert.expiresAt || undefined,
        }
      }

      return { valid: false, error: 'Invalid code type' }
    } catch (error) {
      logError('Failed to validate code', error, { code: normalizedCode })
      return { valid: false, error: 'Failed to validate code' }
    }
  }

  /**
   * Calculate discount for a given code and total amount.
   */
  async calculateDiscount(
    code: string,
    totalCents: number
  ): Promise<DiscountCalculation | { error: string }> {
    const validation = await this.validateCode(code)

    if (!validation.valid) {
      return { error: validation.error || 'Invalid code' }
    }

    if (validation.type === 'gift') {
      const balance = validation.currentBalanceCents || 0
      const discountCents = Math.min(balance, totalCents)
      const remainingToPayCents = totalCents - discountCents
      const newGiftBalanceCents = balance - discountCents

      return {
        discountCents,
        remainingToPayCents,
        newGiftBalanceCents,
      }
    }

    if (validation.type === 'promo') {
      let discountCents = 0

      if (validation.discountType === 'percentage') {
        discountCents = Math.floor((totalCents * (validation.discountValue || 0)) / 100)
      } else if (validation.discountType === 'fixed') {
        discountCents = Math.min(validation.discountValue || 0, totalCents)
      }

      const remainingToPayCents = totalCents - discountCents

      return {
        discountCents,
        remainingToPayCents,
      }
    }

    return { error: 'Invalid code type' }
  }

  /**
   * Apply a code to a booking (deduct balance or increment uses).
   * Should be called after successful payment.
   */
  async applyCode(params: {
    code: string
    bookingId: number
    amountCents: number
    req?: PayloadRequest
  }): Promise<ApplyCodeResult> {
    const { code, bookingId, amountCents, req } = params
    const payload = req?.payload || this.payload
    const normalizedCode = formatCode(normalizeCode(code))

    try {
      const result = await payload.find({
        collection: 'gift-certificates',
        where: { code: { equals: normalizedCode } },
        limit: 1,
        req,
      })

      if (result.docs.length === 0) {
        return { success: false, error: 'Code not found' }
      }

      const cert = result.docs[0] as GiftCertificate

      if (cert.type === 'gift') {
        const currentBalance = cert.currentBalanceCents || 0
        const newBalance = currentBalance - amountCents

        // Determine new status
        let newStatus: 'active' | 'partial' | 'redeemed' = 'partial'
        if (newBalance <= 0) {
          newStatus = 'redeemed'
        } else if (newBalance < (cert.initialValueCents || 0)) {
          newStatus = 'partial'
        }

        // Add redemption record
        const redemptions = cert.redemptions || []
        redemptions.push({
          booking: bookingId,
          amountCents,
          redeemedAt: new Date().toISOString(),
        })

        await payload.update({
          collection: 'gift-certificates',
          id: cert.id,
          data: {
            currentBalanceCents: Math.max(0, newBalance),
            status: newStatus,
            redemptions,
          },
          req,
        })

        logInfo('Gift certificate applied', {
          code: normalizedCode,
          bookingId,
          amountCents,
          newBalance: Math.max(0, newBalance),
          newStatus,
        })
      }

      if (cert.type === 'promo') {
        const currentUses = cert.currentUses || 0
        const newUses = currentUses + 1

        // Determine new status
        let newStatus: 'active' | 'redeemed' = 'active'
        if (cert.maxUses !== null && cert.maxUses !== undefined && newUses >= cert.maxUses) {
          newStatus = 'redeemed'
        }

        // Add redemption record
        const redemptions = cert.redemptions || []
        redemptions.push({
          booking: bookingId,
          amountCents,
          redeemedAt: new Date().toISOString(),
        })

        await payload.update({
          collection: 'gift-certificates',
          id: cert.id,
          data: {
            currentUses: newUses,
            status: newStatus,
            redemptions,
          },
          req,
        })

        logInfo('Promo code applied', {
          code: normalizedCode,
          bookingId,
          amountCents,
          newUses,
          newStatus,
        })
      }

      return { success: true }
    } catch (error) {
      logError('Failed to apply code', error, params)
      return { success: false, error: 'Failed to apply code' }
    }
  }

  /**
   * Revert code usage (for cancellations).
   * Gift codes: NOT refundable (balance stays deducted).
   * Promo codes: Decrement currentUses (anyone can reuse the freed slot).
   */
  async revertCodeUsage(params: {
    code: string
    bookingId: number
    amountCents: number
    req?: PayloadRequest
  }): Promise<ApplyCodeResult> {
    const { code, bookingId, req } = params
    const payload = req?.payload || this.payload
    const normalizedCode = formatCode(normalizeCode(code))

    try {
      const result = await payload.find({
        collection: 'gift-certificates',
        where: { code: { equals: normalizedCode } },
        limit: 1,
        req,
      })

      if (result.docs.length === 0) {
        return { success: false, error: 'Code not found' }
      }

      const cert = result.docs[0] as GiftCertificate

      // Gift codes are NOT refundable
      if (cert.type === 'gift') {
        logInfo('Gift certificate cancellation - balance not restored (non-refundable)', {
          code: normalizedCode,
          bookingId,
        })
        return { success: true }
      }

      // Promo codes: decrement uses
      if (cert.type === 'promo') {
        const currentUses = cert.currentUses || 0
        const newUses = Math.max(0, currentUses - 1)

        // Restore status to active if it was redeemed
        let newStatus = cert.status
        if (cert.status === 'redeemed' && (cert.maxUses === null || cert.maxUses === undefined || newUses < cert.maxUses)) {
          newStatus = 'active'
        }

        // Remove redemption record for this booking
        const redemptions = (cert.redemptions || []).filter(
          (r) => {
            const redemptionBookingId = typeof r.booking === 'object' ? r.booking.id : r.booking
            return redemptionBookingId !== bookingId
          }
        )

        await payload.update({
          collection: 'gift-certificates',
          id: cert.id,
          data: {
            currentUses: newUses,
            status: newStatus,
            redemptions,
          },
          req,
        })

        logInfo('Promo code usage reverted', {
          code: normalizedCode,
          bookingId,
          newUses,
          newStatus,
        })
      }

      return { success: true }
    } catch (error) {
      logError('Failed to revert code usage', error, params)
      return { success: false, error: 'Failed to revert code usage' }
    }
  }

  /**
   * Find a gift certificate by code.
   */
  async findByCode(code: string): Promise<GiftCertificate | null> {
    const normalizedCode = formatCode(normalizeCode(code))

    try {
      const result = await this.payload.find({
        collection: 'gift-certificates',
        where: { code: { equals: normalizedCode } },
        limit: 1,
      })

      return result.docs[0] as GiftCertificate || null
    } catch (error) {
      logError('Failed to find certificate by code', error, { code: normalizedCode })
      return null
    }
  }
}

/**
 * Factory function to create a GiftCertificateService instance.
 */
export function createGiftCertificateService(payload: Payload): GiftCertificateService {
  return new GiftCertificateService(payload)
}
import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'
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
   * Atomically reserve (deduct) funds or usage from a code.
   * Prevents race conditions during checkout.
   */
  async reserveCode(code: string, amountCents: number): Promise<{ success: boolean; error?: string }> {
    const normalizedCode = formatCode(normalizeCode(code))
    
    try {
      // Get access to Drizzle for atomic updates
      const adapter = this.payload.db as unknown as {
        drizzle: { execute: (query: unknown) => Promise<{ rows: { id: number }[] }> }
        tableNameMap: Map<string, string>
      }
      
      if (!adapter.drizzle || !adapter.tableNameMap) {
         // Fallback for non-postgres adapters if needed, but we assume Postgres for now
         throw new Error('Database adapter does not support atomic updates')
      }

      let tableName = adapter.tableNameMap.get('gift-certificates')
      if (!tableName) {
        // Fallback for potential slug transformation
        tableName = adapter.tableNameMap.get('gift_certificates')
      }

      if (!tableName) {
        console.error('Table map keys:', Array.from(adapter.tableNameMap.keys()))
        throw new Error('Gift certificates table name not found')
      }
      if (!tableName) {
        throw new Error('Gift certificates table name not found')
      }

      // Check type first to construct correct query
      // This requires a read, but the atomic update condition will ensure safety
      const cert = await this.findByCode(code)
      if (!cert) {
        return { success: false, error: 'Code not found' }
      }

      let result
      if (cert.type === 'gift') {
        // Atomic decrement ensuring balance >= amount
        result = await adapter.drizzle.execute(sql`
          UPDATE ${sql.identifier(tableName)}
          SET "current_balance_cents" = COALESCE("current_balance_cents", 0) - ${amountCents}
          WHERE "code" = ${normalizedCode}
          AND COALESCE("current_balance_cents", 0) >= ${amountCents}
          RETURNING "id"
        `)
      } else if (cert.type === 'promo') {
        // Atomic increment of uses ensuring < maxUses (if limit exists)
        result = await adapter.drizzle.execute(sql`
          UPDATE ${sql.identifier(tableName)}
          SET "current_uses" = COALESCE("current_uses", 0) + 1
          WHERE "code" = ${normalizedCode}
          AND (
            "max_uses" IS NULL 
            OR COALESCE("current_uses", 0) < "max_uses"
          )
          RETURNING "id"
        `)
      } else {
        return { success: false, error: 'Invalid code type' }
      }

      if (result.rows.length === 0) {
        return { success: false, error: 'Insufficient funds or usage limit reached' }
      }

      return { success: true }
    } catch (error) {
      logError('Failed to reserve code', error, { code: normalizedCode })
      return { success: false, error: 'System error' }
    }
  }

  /**
   * Atomically release (refund) funds or usage to a code.
   * Used for cancellations or rollbacks.
   */
  async releaseCode(code: string, amountCents: number): Promise<{ success: boolean }> {
    const normalizedCode = formatCode(normalizeCode(code))

    try {
      const adapter = this.payload.db as unknown as {
        drizzle: { execute: (query: unknown) => Promise<{ rows: { id: number }[] }> }
        tableNameMap: Map<string, string>
      }

      if (!adapter.drizzle || !adapter.tableNameMap) return { success: false }
      let tableName = adapter.tableNameMap.get('gift-certificates')
      if (!tableName) tableName = adapter.tableNameMap.get('gift_certificates')

      if (!tableName) {
        console.error('ReleaseCode: Gift certificates table name not found', Array.from(adapter.tableNameMap.keys()))
        return { success: false }
      }

      const cert = await this.findByCode(code)
      if (!cert) return { success: false }

      if (cert.type === 'gift') {
        await adapter.drizzle.execute(sql`
          UPDATE ${sql.identifier(tableName)}
          SET "current_balance_cents" = COALESCE("current_balance_cents", 0) + ${amountCents}
          WHERE "code" = ${normalizedCode}
        `)
      } else if (cert.type === 'promo') {
        await adapter.drizzle.execute(sql`
          UPDATE ${sql.identifier(tableName)}
          SET "current_uses" = GREATEST(0, COALESCE("current_uses", 0) - 1)
          WHERE "code" = ${normalizedCode}
        `)
      }

      return { success: true }
    } catch (error) {
      logError('Failed to release code', error, { code: normalizedCode })
      return { success: false }
    }
  }

  /**
   * Apply a code to a booking (deduct balance or increment uses).
   * Should be called after successful payment.
   */
  async applyCode(params: {
    code: string
    bookingId: number
    amountCents: number
    skipBalanceDeduction?: boolean
    req?: PayloadRequest
  }): Promise<ApplyCodeResult> {
    const { code, bookingId, amountCents, skipBalanceDeduction = false, req } = params
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
        // If we already reserved (skipBalanceDeduction=true), the currentBalance IS the new balance
        // Otherwise we subtract
        const newBalance = skipBalanceDeduction ? currentBalance : currentBalance - amountCents

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
        // If reserved, currentUses is already incremented
        const newUses = skipBalanceDeduction ? currentUses : currentUses + 1

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
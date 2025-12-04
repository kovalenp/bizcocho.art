import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GiftCertificateService, createGiftCertificateService } from './gift-certificates'
import type { Payload } from 'payload'
import type { GiftCertificate } from '../payload-types'

// Mock logger
vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}))

// Mock gift-codes lib
vi.mock('../lib/gift-codes', () => ({
  normalizeCode: vi.fn((code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  formatCode: vi.fn((code: string) => {
    if (code.length === 8) return `${code.slice(0, 4)}-${code.slice(4)}`
    return code
  }),
}))

// Mock SQL helper
vi.mock('@payloadcms/db-postgres', () => {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    toQuery: () => 'mock-query'
  })
  // Attach static method to the function
  ;(sql as typeof sql & { identifier: (val: string) => string }).identifier = (val: string) => `"${val}"`

  return { sql }
})

interface MockPayload {
  find: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  db: {
    drizzle: {
      execute: ReturnType<typeof vi.fn>
    }
    tableNameMap: Map<string, string>
  }
}

describe('GiftCertificateService', () => {
  let mockPayload: MockPayload
  let mockDrizzleExecute: ReturnType<typeof vi.fn>
  let service: GiftCertificateService

  const makeGiftCertificate = (overrides: Partial<GiftCertificate> = {}): GiftCertificate => ({
    id: 1,
    code: 'ABCD-1234',
    type: 'gift',
    status: 'active',
    initialValueCents: 5000,
    currentBalanceCents: 5000,
    currency: 'eur',
    redemptions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  const makePromoCode = (overrides: Partial<GiftCertificate> = {}): GiftCertificate => ({
    id: 2,
    code: 'PROMO-20',
    type: 'promo',
    status: 'active',
    discountType: 'percentage',
    discountValue: 20,
    maxUses: 100,
    currentUses: 0,
    redemptions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  beforeEach(() => {
    mockDrizzleExecute = vi.fn()
    
    mockPayload = {
      find: vi.fn(),
      findByID: vi.fn(),
      update: vi.fn(),
      db: {
        drizzle: {
          execute: mockDrizzleExecute,
        },
        tableNameMap: new Map([['gift-certificates', 'gift_certificates_table']]),
      },
    }

    service = new GiftCertificateService(mockPayload as unknown as Payload)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('validateCode', () => {
    it('should validate an active gift certificate', async () => {
      const cert = makeGiftCertificate()
      mockPayload.find.mockResolvedValue({ docs: [cert] })

      const result = await service.validateCode('ABCD-1234')

      expect(result.valid).toBe(true)
      expect(result.type).toBe('gift')
      expect(result.currentBalanceCents).toBe(5000)
      expect(result.currency).toBe('eur')
    })

    it('should validate an active promo code', async () => {
      const promo = makePromoCode()
      mockPayload.find.mockResolvedValue({ docs: [promo] })

      const result = await service.validateCode('PROMO-20')

      expect(result.valid).toBe(true)
      expect(result.type).toBe('promo')
      expect(result.discountType).toBe('percentage')
      expect(result.discountValue).toBe(20)
    })

    it('should reject code not found', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result = await service.validateCode('INVALID')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Code not found')
    })

    it('should reject pending gift certificate', async () => {
      const cert = makeGiftCertificate({ status: 'pending' })
      mockPayload.find.mockResolvedValue({ docs: [cert] })

      const result = await service.validateCode('ABCD-1234')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Code is not yet active')
    })

    it('should reject expired gift certificate', async () => {
      const cert = makeGiftCertificate({ status: 'expired' })
      mockPayload.find.mockResolvedValue({ docs: [cert] })

      const result = await service.validateCode('ABCD-1234')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Code has expired')
    })

    it('should reject fully redeemed gift certificate', async () => {
      const cert = makeGiftCertificate({ status: 'redeemed' })
      mockPayload.find.mockResolvedValue({ docs: [cert] })

      const result = await service.validateCode('ABCD-1234')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Code has already been fully redeemed')
    })

    it('should detect and update expired by date', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString()
      const cert = makeGiftCertificate({ status: 'active', expiresAt: yesterday })
      mockPayload.find.mockResolvedValue({ docs: [cert] })
      mockPayload.update.mockResolvedValue({})

      const result = await service.validateCode('ABCD-1234')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Code has expired')
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'gift-certificates',
        id: 1,
        data: { status: 'expired' },
      })
    })

    it('should reject gift certificate with zero balance', async () => {
      const cert = makeGiftCertificate({ currentBalanceCents: 0 })
      mockPayload.find.mockResolvedValue({ docs: [cert] })

      const result = await service.validateCode('ABCD-1234')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Gift certificate has no remaining balance')
    })

    it('should reject promo code at usage limit', async () => {
      const promo = makePromoCode({ maxUses: 10, currentUses: 10 })
      mockPayload.find.mockResolvedValue({ docs: [promo] })

      const result = await service.validateCode('PROMO-20')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Promo code has reached its usage limit')
    })

    it('should allow promo code with unlimited uses', async () => {
      const promo = makePromoCode({ maxUses: null, currentUses: 999 })
      mockPayload.find.mockResolvedValue({ docs: [promo] })

      const result = await service.validateCode('PROMO-20')

      expect(result.valid).toBe(true)
    })
  })

  describe('calculateDiscount', () => {
    it('should calculate gift certificate discount (partial use)', async () => {
      const cert = makeGiftCertificate({ currentBalanceCents: 3000 })
      mockPayload.find.mockResolvedValue({ docs: [cert] })

      const result = await service.calculateDiscount('ABCD-1234', 5000)

      expect(result).toEqual({
        discountCents: 3000,
        remainingToPayCents: 2000,
        newGiftBalanceCents: 0,
      })
    })

    it('should calculate gift certificate discount (full coverage)', async () => {
      const cert = makeGiftCertificate({ currentBalanceCents: 10000 })
      mockPayload.find.mockResolvedValue({ docs: [cert] })

      const result = await service.calculateDiscount('ABCD-1234', 5000)

      expect(result).toEqual({
        discountCents: 5000,
        remainingToPayCents: 0,
        newGiftBalanceCents: 5000,
      })
    })

    it('should calculate percentage promo discount', async () => {
      const promo = makePromoCode({ discountType: 'percentage', discountValue: 20 })
      mockPayload.find.mockResolvedValue({ docs: [promo] })

      const result = await service.calculateDiscount('PROMO-20', 5000)

      expect(result).toEqual({
        discountCents: 1000, // 20% of 5000
        remainingToPayCents: 4000,
      })
    })

    it('should calculate fixed promo discount', async () => {
      const promo = makePromoCode({ discountType: 'fixed', discountValue: 1500 })
      mockPayload.find.mockResolvedValue({ docs: [promo] })

      const result = await service.calculateDiscount('PROMO-FIXED', 5000)

      expect(result).toEqual({
        discountCents: 1500,
        remainingToPayCents: 3500,
      })
    })

    it('should cap fixed discount at total amount', async () => {
      const promo = makePromoCode({ discountType: 'fixed', discountValue: 10000 })
      mockPayload.find.mockResolvedValue({ docs: [promo] })

      const result = await service.calculateDiscount('PROMO-FIXED', 5000)

      expect(result).toEqual({
        discountCents: 5000,
        remainingToPayCents: 0,
      })
    })

    it('should return error for invalid code', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result = await service.calculateDiscount('INVALID', 5000)

      expect(result).toEqual({ error: 'Code not found' })
    })
  })

  describe('reserveCode', () => {
    it('should atomically reserve gift funds', async () => {
      mockPayload.find.mockResolvedValue({ docs: [makeGiftCertificate()] })
      mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 1 }] })

      const result = await service.reserveCode('ABCD-1234', 1000)

      expect(result.success).toBe(true)
      expect(mockDrizzleExecute).toHaveBeenCalledTimes(1)
    })

    it('should atomically reserve promo usage', async () => {
      mockPayload.find.mockResolvedValue({ docs: [makePromoCode()] })
      mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 2 }] })

      const result = await service.reserveCode('PROMO-20', 1000)

      expect(result.success).toBe(true)
      expect(mockDrizzleExecute).toHaveBeenCalledTimes(1)
    })

    it('should fail when atomic update returns no rows (insufficient funds)', async () => {
      mockPayload.find.mockResolvedValue({ docs: [makeGiftCertificate()] })
      mockDrizzleExecute.mockResolvedValue({ rows: [] })

      const result = await service.reserveCode('ABCD-1234', 1000)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Insufficient funds or usage limit reached')
    })

    it('should return error if code not found', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result = await service.reserveCode('INVALID', 1000)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Code not found')
    })
  })

  describe('releaseCode', () => {
    it('should atomically release gift funds', async () => {
      mockPayload.find.mockResolvedValue({ docs: [makeGiftCertificate()] })
      mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 1 }] })

      const result = await service.releaseCode('ABCD-1234', 1000)

      expect(result.success).toBe(true)
      expect(mockDrizzleExecute).toHaveBeenCalledTimes(1)
    })

    it('should atomically decrement promo usage', async () => {
      mockPayload.find.mockResolvedValue({ docs: [makePromoCode()] })
      mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 2 }] })

      const result = await service.releaseCode('PROMO-20', 1000)

      expect(result.success).toBe(true)
      expect(mockDrizzleExecute).toHaveBeenCalledTimes(1)
    })
  })

  describe('applyCode', () => {
    it('should apply gift certificate and update balance (default behavior)', async () => {
      const cert = makeGiftCertificate({ currentBalanceCents: 5000 })
      mockPayload.find.mockResolvedValue({ docs: [cert] })
      mockPayload.update.mockResolvedValue({})

      const result = await service.applyCode({
        code: 'ABCD-1234',
        bookingId: 100,
        amountCents: 3000,
      })

      expect(result.success).toBe(true)
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'gift-certificates',
        id: 1,
        data: {
          currentBalanceCents: 2000,
          status: 'partial',
          redemptions: expect.arrayContaining([
            expect.objectContaining({
              booking: 100,
              amountCents: 3000,
            }),
          ]),
        },
        req: undefined,
      })
    })

    it('should skip balance deduction when skipBalanceDeduction is true', async () => {
      // Simulate balance ALREADY deducted (e.g. it was 5000, now 2000)
      const cert = makeGiftCertificate({ currentBalanceCents: 2000 })
      mockPayload.find.mockResolvedValue({ docs: [cert] })
      mockPayload.update.mockResolvedValue({})

      const result = await service.applyCode({
        code: 'ABCD-1234',
        bookingId: 100,
        amountCents: 3000, // Amount being applied
        skipBalanceDeduction: true
      })

      expect(result.success).toBe(true)
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'gift-certificates',
        id: 1,
        data: {
          // Balance should remain 2000
          currentBalanceCents: 2000,
          status: 'partial', // Based on balance < initial
          redemptions: expect.arrayContaining([
            expect.objectContaining({
              booking: 100,
              amountCents: 3000,
            }),
          ]),
        },
        req: undefined,
      })
    })

    it('should mark gift certificate as redeemed when balance depleted', async () => {
      const cert = makeGiftCertificate({ currentBalanceCents: 3000 })
      mockPayload.find.mockResolvedValue({ docs: [cert] })
      mockPayload.update.mockResolvedValue({})

      await service.applyCode({
        code: 'ABCD-1234',
        bookingId: 100,
        amountCents: 3000,
      })

      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentBalanceCents: 0,
            status: 'redeemed',
          }),
        })
      )
    })

    it('should apply promo code and increment uses', async () => {
      const promo = makePromoCode({ currentUses: 5 })
      mockPayload.find.mockResolvedValue({ docs: [promo] })
      mockPayload.update.mockResolvedValue({})

      const result = await service.applyCode({
        code: 'PROMO-20',
        bookingId: 100,
        amountCents: 1000,
      })

      expect(result.success).toBe(true)
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'gift-certificates',
        id: 2,
        data: {
          currentUses: 6,
          status: 'active',
          redemptions: expect.arrayContaining([
            expect.objectContaining({
              booking: 100,
              amountCents: 1000,
            }),
          ]),
        },
        req: undefined,
      })
    })

    it('should skip uses increment for promo when skipBalanceDeduction is true', async () => {
      const promo = makePromoCode({ currentUses: 6 }) // Already incremented
      mockPayload.find.mockResolvedValue({ docs: [promo] })
      mockPayload.update.mockResolvedValue({})

      const result = await service.applyCode({
        code: 'PROMO-20',
        bookingId: 100,
        amountCents: 1000,
        skipBalanceDeduction: true
      })

      expect(result.success).toBe(true)
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentUses: 6, // Unchanged
            status: 'active',
          })
        })
      )
    })

    it('should mark promo as redeemed when max uses reached', async () => {
      const promo = makePromoCode({ maxUses: 10, currentUses: 9 })
      mockPayload.find.mockResolvedValue({ docs: [promo] })
      mockPayload.update.mockResolvedValue({})

      await service.applyCode({
        code: 'PROMO-20',
        bookingId: 100,
        amountCents: 1000,
      })

      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentUses: 10,
            status: 'redeemed',
          }),
        })
      )
    })

    it('should return error if code not found', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result = await service.applyCode({
        code: 'INVALID',
        bookingId: 100,
        amountCents: 1000,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Code not found')
    })
  })

  describe('revertCodeUsage', () => {
    it('should NOT refund gift certificate balance (non-refundable)', async () => {
      const cert = makeGiftCertificate({ currentBalanceCents: 2000 })
      mockPayload.find.mockResolvedValue({ docs: [cert] })

      const result = await service.revertCodeUsage({
        code: 'ABCD-1234',
        bookingId: 100,
        amountCents: 3000,
      })

      expect(result.success).toBe(true)
      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('should decrement promo code uses', async () => {
      const promo = makePromoCode({
        currentUses: 5,
        redemptions: [
          { booking: 100, amountCents: 1000, redeemedAt: new Date().toISOString() },
          { booking: 200, amountCents: 2000, redeemedAt: new Date().toISOString() },
        ],
      })
      mockPayload.find.mockResolvedValue({ docs: [promo] })
      mockPayload.update.mockResolvedValue({})

      const result = await service.revertCodeUsage({
        code: 'PROMO-20',
        bookingId: 100,
        amountCents: 1000,
      })

      expect(result.success).toBe(true)
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'gift-certificates',
        id: 2,
        data: {
          currentUses: 4,
          status: 'active',
          redemptions: expect.arrayContaining([
            expect.objectContaining({ booking: 200 }),
          ]),
        },
        req: undefined,
      })
    })

    it('should restore redeemed promo to active', async () => {
      const promo = makePromoCode({
        status: 'redeemed',
        maxUses: 10,
        currentUses: 10,
        redemptions: [{ booking: 100, amountCents: 1000, redeemedAt: new Date().toISOString() }],
      })
      mockPayload.find.mockResolvedValue({ docs: [promo] })
      mockPayload.update.mockResolvedValue({})

      await service.revertCodeUsage({
        code: 'PROMO-20',
        bookingId: 100,
        amountCents: 1000,
      })

      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentUses: 9,
            status: 'active',
          }),
        })
      )
    })
  })

  describe('findByCode', () => {
    it('should find certificate by code', async () => {
      const cert = makeGiftCertificate()
      mockPayload.find.mockResolvedValue({ docs: [cert] })

      const result = await service.findByCode('ABCD-1234')

      expect(result).toEqual(cert)
    })

    it('should return null if not found', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result = await service.findByCode('INVALID')

      expect(result).toBeNull()
    })
  })

  describe('createGiftCertificateService', () => {
    it('should create a service instance', () => {
      const mockPayload = {} as Payload
      const service = createGiftCertificateService(mockPayload)
      expect(service).toBeInstanceOf(GiftCertificateService)
    })
  })

  describe('reserve and release workflow (rollback scenario)', () => {
    it('should correctly restore funds after reserve then release (simulating checkout failure)', async () => {
      // Simulate: reserve 3000 cents from a 5000 cent gift card
      const cert = makeGiftCertificate({ currentBalanceCents: 5000 })
      mockPayload.find.mockResolvedValue({ docs: [cert] })

      // Reserve succeeds (atomic update returns row)
      mockDrizzleExecute.mockResolvedValueOnce({ rows: [{ id: 1 }] })

      const reserveResult = await service.reserveCode('ABCD-1234', 3000)
      expect(reserveResult.success).toBe(true)
      expect(mockDrizzleExecute).toHaveBeenCalledTimes(1)

      // Now simulate failure - booking creation fails, so we release
      // The release should add the amount back
      mockDrizzleExecute.mockResolvedValueOnce({ rows: [{ id: 1 }] })

      const releaseResult = await service.releaseCode('ABCD-1234', 3000)
      expect(releaseResult.success).toBe(true)
      expect(mockDrizzleExecute).toHaveBeenCalledTimes(2)
    })

    it('should correctly restore promo usage after reserve then release', async () => {
      const promo = makePromoCode({ currentUses: 5, maxUses: 10 })
      mockPayload.find.mockResolvedValue({ docs: [promo] })

      // Reserve succeeds (increments uses)
      mockDrizzleExecute.mockResolvedValueOnce({ rows: [{ id: 2 }] })

      const reserveResult = await service.reserveCode('PROMO-20', 1000)
      expect(reserveResult.success).toBe(true)

      // Release (decrements uses back)
      mockDrizzleExecute.mockResolvedValueOnce({ rows: [{ id: 2 }] })

      const releaseResult = await service.releaseCode('PROMO-20', 1000)
      expect(releaseResult.success).toBe(true)
    })

    it('should handle release gracefully even if code not found', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const releaseResult = await service.releaseCode('NONEXISTENT', 1000)

      // Should not throw, just return false
      expect(releaseResult.success).toBe(false)
    })
  })
})

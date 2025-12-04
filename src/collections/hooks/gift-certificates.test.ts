import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { beforeChangeGiftCertificate, afterChangeGiftCertificate } from './gift-certificates'
import type { GiftCertificate } from '../../payload-types'
import type { CollectionBeforeChangeHookArgs, CollectionAfterChangeHookArgs, PayloadRequest, CollectionConfig } from 'payload'

// Mock logger
vi.mock('../../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}))

// Mock generateCode
vi.mock('../../lib/gift-codes', () => ({
  generateCode: vi.fn(() => 'TEST-CODE'),
}))

// Mock notification service
const mockSendGiftCertificateActivation = vi.fn().mockResolvedValue(undefined)
vi.mock('../../services/notifications', () => ({
  createNotificationService: vi.fn(() => ({
    sendGiftCertificateActivation: mockSendGiftCertificateActivation,
  })),
}))

describe('Gift Certificate Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('beforeChangeGiftCertificate', () => {
    const createHookArgs = (
      data: Partial<GiftCertificate>,
      operation: 'create' | 'update'
    ): CollectionBeforeChangeHookArgs<GiftCertificate> => ({
      data: data as GiftCertificate,
      operation,
      req: {} as PayloadRequest,
      collection: { slug: 'gift-certificates' } as CollectionConfig,
      context: {},
      originalDoc: undefined,
    })

    it('should auto-generate code on create if empty', async () => {
      const args = createHookArgs({ type: 'gift' }, 'create')

      const result = await beforeChangeGiftCertificate(args)

      expect(result.code).toBe('TEST-CODE')
    })

    it('should NOT auto-generate code if already provided', async () => {
      const args = createHookArgs({ code: 'MY-CODE', type: 'gift' }, 'create')

      const result = await beforeChangeGiftCertificate(args)

      expect(result.code).toBe('MY-CODE')
    })

    it('should NOT auto-generate code on update', async () => {
      const args = createHookArgs({ type: 'gift' }, 'update')

      const result = await beforeChangeGiftCertificate(args)

      expect(result.code).toBeUndefined()
    })

    it('should initialize currentBalanceCents from initialValueCents for gift type on create', async () => {
      const args = createHookArgs(
        { type: 'gift', initialValueCents: 5000 },
        'create'
      )

      const result = await beforeChangeGiftCertificate(args)

      expect(result.currentBalanceCents).toBe(5000)
    })

    it('should NOT initialize balance on update', async () => {
      const args = createHookArgs(
        { type: 'gift', initialValueCents: 5000 },
        'update'
      )

      const result = await beforeChangeGiftCertificate(args)

      expect(result.currentBalanceCents).toBeUndefined()
    })

    it('should set status to active for promo codes on create', async () => {
      const args = createHookArgs({ type: 'promo' }, 'create')

      const result = await beforeChangeGiftCertificate(args)

      expect(result.status).toBe('active')
    })

    it('should NOT set status to active for gift type on create', async () => {
      const args = createHookArgs({ type: 'gift', status: 'pending' }, 'create')

      const result = await beforeChangeGiftCertificate(args)

      // status should remain pending (set by default in collection, not overwritten)
      expect(result.status).toBe('pending')
    })
  })

  describe('afterChangeGiftCertificate', () => {
    const createHookArgs = (
      doc: Partial<GiftCertificate>,
      previousDoc: Partial<GiftCertificate> | undefined,
      operation: 'create' | 'update'
    ): CollectionAfterChangeHookArgs<GiftCertificate> => ({
      doc: doc as GiftCertificate,
      previousDoc: previousDoc as GiftCertificate | undefined,
      operation,
      req: { payload: {} } as PayloadRequest,
      collection: { slug: 'gift-certificates' } as CollectionConfig,
      context: {},
    })

    it('should send notification when gift certificate is activated', async () => {
      const args = createHookArgs(
        { id: 1, type: 'gift', status: 'active', code: 'ABCD-1234' },
        { id: 1, type: 'gift', status: 'pending', code: 'ABCD-1234' },
        'update'
      )

      await afterChangeGiftCertificate(args)

      expect(mockSendGiftCertificateActivation).toHaveBeenCalledWith(1, {
        locale: 'en',
      })
    })

    it('should NOT send notification for promo codes', async () => {
      const args = createHookArgs(
        { id: 1, type: 'promo', status: 'active', code: 'PROMO-20' },
        { id: 1, type: 'promo', status: 'pending', code: 'PROMO-20' },
        'update'
      )

      await afterChangeGiftCertificate(args)

      expect(mockSendGiftCertificateActivation).not.toHaveBeenCalled()
    })

    it('should NOT send notification if already active', async () => {
      const args = createHookArgs(
        { id: 1, type: 'gift', status: 'active', code: 'ABCD-1234' },
        { id: 1, type: 'gift', status: 'active', code: 'ABCD-1234' },
        'update'
      )

      await afterChangeGiftCertificate(args)

      expect(mockSendGiftCertificateActivation).not.toHaveBeenCalled()
    })

    it('should NOT send notification when status changes to non-active', async () => {
      const args = createHookArgs(
        { id: 1, type: 'gift', status: 'redeemed', code: 'ABCD-1234' },
        { id: 1, type: 'gift', status: 'active', code: 'ABCD-1234' },
        'update'
      )

      await afterChangeGiftCertificate(args)

      expect(mockSendGiftCertificateActivation).not.toHaveBeenCalled()
    })

    it('should return doc unchanged', async () => {
      const doc = { id: 1, type: 'gift', status: 'active', code: 'ABCD-1234' } as GiftCertificate
      const args = createHookArgs(doc, { status: 'pending' } as GiftCertificate, 'update')

      const result = await afterChangeGiftCertificate(args)

      expect(result).toBe(doc)
    })
  })
})

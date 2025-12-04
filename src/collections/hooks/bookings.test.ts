import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { beforeValidateBooking, afterChangeBooking } from './bookings'
import type { Booking, Session } from '../../payload-types'
import type { CollectionBeforeValidateHookArgs, CollectionAfterChangeHookArgs, PayloadRequest, CollectionConfig } from 'payload'

// Mock logger
vi.mock('../../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}))

// Mock booking service
const mockHandleStatusChange = vi.fn().mockResolvedValue({ capacityChanged: false, capacityDelta: 0 })
vi.mock('../../services/booking', () => ({
  createBookingService: vi.fn(() => ({
    handleStatusChange: mockHandleStatusChange,
  })),
}))

// Mock notification service
const mockSendBookingConfirmation = vi.fn().mockResolvedValue(undefined)
vi.mock('../../services/notifications', () => ({
  createNotificationService: vi.fn(() => ({
    sendBookingConfirmation: mockSendBookingConfirmation,
  })),
}))

describe('Booking Hooks', () => {
  let mockPayload: {
    findByID: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn(),
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('beforeValidateBooking', () => {
    const createHookArgs = (
      data: Partial<Booking>,
      operation: 'create' | 'update',
      req?: Partial<PayloadRequest>
    ): CollectionBeforeValidateHookArgs<Booking> => ({
      data: data as Booking,
      operation,
      req: { payload: mockPayload, ...req } as PayloadRequest,
      collection: { slug: 'bookings' } as CollectionConfig,
      context: {},
      originalDoc: undefined,
    })

    it('should throw error if no sessions provided', async () => {
      const args = createHookArgs({ sessions: [] }, 'create')

      await expect(beforeValidateBooking(args)).rejects.toThrow(
        'Booking must include at least one session'
      )
    })

    it('should throw error if sessions is undefined', async () => {
      const args = createHookArgs({}, 'create')

      await expect(beforeValidateBooking(args)).rejects.toThrow(
        'Booking must include at least one session'
      )
    })

    it('should auto-set bookingType from session sessionType', async () => {
      mockPayload.findByID.mockResolvedValue({ id: 1, sessionType: 'course' })
      const args = createHookArgs({ sessions: [1] }, 'create')

      const result = await beforeValidateBooking(args)

      expect(result.bookingType).toBe('course')
      expect(mockPayload.findByID).toHaveBeenCalledWith({
        collection: 'sessions',
        id: 1,
        depth: 0,
      })
    })

    it('should handle populated session objects', async () => {
      mockPayload.findByID.mockResolvedValue({ id: 1, sessionType: 'class' })
      const args = createHookArgs({ sessions: [{ id: 1 } as Session] }, 'create')

      const result = await beforeValidateBooking(args)

      expect(result.bookingType).toBe('class')
    })

    it('should not fail if session lookup fails', async () => {
      mockPayload.findByID.mockRejectedValue(new Error('DB error'))
      const args = createHookArgs({ sessions: [1], bookingType: 'class' }, 'create')

      const result = await beforeValidateBooking(args)

      // Should keep existing bookingType
      expect(result.bookingType).toBe('class')
    })

    it('should work on update operation', async () => {
      mockPayload.findByID.mockResolvedValue({ id: 1, sessionType: 'course' })
      const args = createHookArgs({ sessions: [1] }, 'update')

      const result = await beforeValidateBooking(args)

      expect(result.bookingType).toBe('course')
    })
  })

  describe('afterChangeBooking', () => {
    const makeBooking = (overrides: Partial<Booking> = {}): Booking => ({
      id: 1,
      bookingType: 'class',
      sessions: [1],
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      numberOfPeople: 2,
      status: 'pending',
      paymentStatus: 'unpaid',
      bookingDate: new Date().toISOString(),
      checkedIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    })

    const createHookArgs = (
      doc: Booking,
      previousDoc: Booking | undefined,
      operation: 'create' | 'update'
    ): CollectionAfterChangeHookArgs<Booking> => ({
      doc,
      previousDoc,
      operation,
      req: { payload: mockPayload } as PayloadRequest,
      collection: { slug: 'bookings' } as CollectionConfig,
      context: {},
    })

    it('should call handleStatusChange on update', async () => {
      const doc = makeBooking({ status: 'cancelled' })
      const previousDoc = makeBooking({ status: 'confirmed' })
      const args = createHookArgs(doc, previousDoc, 'update')

      await afterChangeBooking(args)

      expect(mockHandleStatusChange).toHaveBeenCalledWith(doc, previousDoc)
    })

    it('should NOT call handleStatusChange on create', async () => {
      const doc = makeBooking()
      const args = createHookArgs(doc, undefined, 'create')

      await afterChangeBooking(args)

      expect(mockHandleStatusChange).not.toHaveBeenCalled()
    })

    it('should send notification when booking becomes confirmed AND paid', async () => {
      const doc = makeBooking({ status: 'confirmed', paymentStatus: 'paid' })
      const previousDoc = makeBooking({ status: 'pending', paymentStatus: 'unpaid' })
      const args = createHookArgs(doc, previousDoc, 'update')

      await afterChangeBooking(args)

      expect(mockSendBookingConfirmation).toHaveBeenCalledWith(1, { locale: 'en' })
    })

    it('should send notification when status becomes confirmed (already paid)', async () => {
      const doc = makeBooking({ status: 'confirmed', paymentStatus: 'paid' })
      const previousDoc = makeBooking({ status: 'pending', paymentStatus: 'paid' })
      const args = createHookArgs(doc, previousDoc, 'update')

      await afterChangeBooking(args)

      expect(mockSendBookingConfirmation).toHaveBeenCalled()
    })

    it('should send notification when payment becomes paid (already confirmed)', async () => {
      const doc = makeBooking({ status: 'confirmed', paymentStatus: 'paid' })
      const previousDoc = makeBooking({ status: 'confirmed', paymentStatus: 'unpaid' })
      const args = createHookArgs(doc, previousDoc, 'update')

      await afterChangeBooking(args)

      expect(mockSendBookingConfirmation).toHaveBeenCalled()
    })

    it('should NOT send notification if confirmed but not paid', async () => {
      const doc = makeBooking({ status: 'confirmed', paymentStatus: 'unpaid' })
      const previousDoc = makeBooking({ status: 'pending', paymentStatus: 'unpaid' })
      const args = createHookArgs(doc, previousDoc, 'update')

      await afterChangeBooking(args)

      expect(mockSendBookingConfirmation).not.toHaveBeenCalled()
    })

    it('should NOT send notification if paid but not confirmed', async () => {
      const doc = makeBooking({ status: 'pending', paymentStatus: 'paid' })
      const previousDoc = makeBooking({ status: 'pending', paymentStatus: 'unpaid' })
      const args = createHookArgs(doc, previousDoc, 'update')

      await afterChangeBooking(args)

      expect(mockSendBookingConfirmation).not.toHaveBeenCalled()
    })

    it('should NOT send notification if already confirmed and paid', async () => {
      const doc = makeBooking({ status: 'confirmed', paymentStatus: 'paid' })
      const previousDoc = makeBooking({ status: 'confirmed', paymentStatus: 'paid' })
      const args = createHookArgs(doc, previousDoc, 'update')

      await afterChangeBooking(args)

      expect(mockSendBookingConfirmation).not.toHaveBeenCalled()
    })

    it('should return doc unchanged', async () => {
      const doc = makeBooking()
      const args = createHookArgs(doc, undefined, 'create')

      const result = await afterChangeBooking(args)

      expect(result).toBe(doc)
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BookingService, createBookingService, CreateBookingParams } from './booking'
import type { Payload } from 'payload'
import type { Booking } from '../payload-types'

// Mock logger
vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}))

// Mock CapacityService
vi.mock('./capacity', () => ({
  createCapacityService: vi.fn(() => ({
    reserveSpots: vi.fn(),
    releaseSpots: vi.fn(),
  })),
  CapacityService: vi.fn(),
}))

import { createCapacityService } from './capacity'

describe('BookingService', () => {
  let mockPayload: {
    find: ReturnType<typeof vi.fn>
    findByID: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    db: {
      beginTransaction: ReturnType<typeof vi.fn>
      commitTransaction: ReturnType<typeof vi.fn>
      rollbackTransaction: ReturnType<typeof vi.fn>
    }
  }
  let mockCapacityService: {
    reserveSpots: ReturnType<typeof vi.fn>
    releaseSpots: ReturnType<typeof vi.fn>
  }
  let service: BookingService

  beforeEach(() => {
    mockPayload = {
      find: vi.fn(),
      findByID: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      db: {
        beginTransaction: vi.fn().mockResolvedValue('txn-123'),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      },
    }

    mockCapacityService = {
      reserveSpots: vi.fn(),
      releaseSpots: vi.fn(),
    }

    ;(createCapacityService as ReturnType<typeof vi.fn>).mockReturnValue(mockCapacityService)

    service = new BookingService(mockPayload as unknown as Payload)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createPendingBooking', () => {
    const validParams: CreateBookingParams = {
      bookingType: 'class',
      sessionIds: [1, 2],
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      numberOfPeople: 2,
    }

    it('should create a pending booking successfully with transaction', async () => {
      mockCapacityService.reserveSpots.mockResolvedValue({ success: true })
      mockPayload.create.mockResolvedValue({ id: 100, ...validParams, status: 'pending' })

      const result = await service.createPendingBooking(validParams)

      expect(result.success).toBe(true)
      expect(result.booking).toBeDefined()
      expect(mockPayload.db.beginTransaction).toHaveBeenCalled()
      expect(mockCapacityService.reserveSpots).toHaveBeenCalled()
      expect(mockPayload.create).toHaveBeenCalled()
      expect(mockPayload.db.commitTransaction).toHaveBeenCalledWith('txn-123')
    })

    it('should rollback transaction if capacity reservation fails', async () => {
      mockCapacityService.reserveSpots.mockResolvedValue({
        success: false,
        error: 'Not enough capacity',
      })

      const result = await service.createPendingBooking(validParams)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not enough capacity')
      expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledWith('txn-123')
      expect(mockPayload.create).not.toHaveBeenCalled()
    })

    it('should rollback transaction if booking creation fails', async () => {
      mockCapacityService.reserveSpots.mockResolvedValue({ success: true })
      mockPayload.create.mockRejectedValue(new Error('DB error'))

      const result = await service.createPendingBooking(validParams)

      expect(result.success).toBe(false)
      expect(mockPayload.db.rollbackTransaction).toHaveBeenCalledWith('txn-123')
    })

    it('should include gift code info when provided', async () => {
      mockCapacityService.reserveSpots.mockResolvedValue({ success: true })
      mockPayload.create.mockResolvedValue({ id: 100, status: 'pending' })

      const paramsWithGift = {
        ...validParams,
        giftCertificateCode: 'GIFT-1234',
        giftCertificateAmountCents: 1000,
        originalPriceCents: 5000,
      }

      await service.createPendingBooking(paramsWithGift)

      expect(mockPayload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            giftCertificateCode: 'GIFT-1234',
            giftCertificateAmountCents: 1000,
            originalPriceCents: 5000,
          }),
        })
      )
    })

    it('should return error if transaction fails to start', async () => {
      mockPayload.db.beginTransaction.mockRejectedValue(new Error('Connection failed'))

      const result = await service.createPendingBooking(validParams)

      expect(result.success).toBe(false)
      expect(result.error).toBe('System busy, please try again')
    })

    it('should use existing transaction if provided in req', async () => {
      const existingReq = {
        payload: mockPayload,
        transactionID: 'existing-txn',
      }
      mockCapacityService.reserveSpots.mockResolvedValue({ success: true })
      mockPayload.create.mockResolvedValue({ id: 100, status: 'pending' })

      await service.createPendingBooking({ ...validParams, req: existingReq as any })

      // Should NOT start new transaction
      expect(mockPayload.db.beginTransaction).not.toHaveBeenCalled()
      // Should NOT commit (caller manages transaction)
      expect(mockPayload.db.commitTransaction).not.toHaveBeenCalled()
    })
  })

  describe('confirmBooking', () => {
    it('should confirm a pending booking', async () => {
      mockPayload.findByID.mockResolvedValue({ id: 1, status: 'pending', paymentStatus: 'unpaid' })
      mockPayload.update.mockResolvedValue({ id: 1, status: 'confirmed', paymentStatus: 'paid' })

      const result = await service.confirmBooking(1, 'pi_123')

      expect(result.success).toBe(true)
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'bookings',
        id: 1,
        data: expect.objectContaining({
          status: 'confirmed',
          paymentStatus: 'paid',
          stripePaymentIntentId: 'pi_123',
          expiresAt: null,
        }),
        req: undefined,
      })
    })

    it('should skip if already paid (idempotency)', async () => {
      mockPayload.findByID.mockResolvedValue({ id: 1, status: 'confirmed', paymentStatus: 'paid' })

      const result = await service.confirmBooking(1, 'pi_123')

      expect(result.success).toBe(true)
      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('should return error if booking not found', async () => {
      mockPayload.findByID.mockResolvedValue(null)

      const result = await service.confirmBooking(999)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Booking not found')
    })

    it('should include additional data when provided', async () => {
      mockPayload.findByID.mockResolvedValue({ id: 1, status: 'pending', paymentStatus: 'unpaid' })
      mockPayload.update.mockResolvedValue({ id: 1, status: 'confirmed' })

      await service.confirmBooking(1, 'pi_123', {
        giftCertificateCode: 'GIFT-1234',
        stripeAmountCents: 4000,
      })

      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'bookings',
        id: 1,
        data: expect.objectContaining({
          giftCertificateCode: 'GIFT-1234',
          stripeAmountCents: 4000,
        }),
        req: undefined,
      })
    })
  })

  describe('cancelBooking', () => {
    it('should cancel a booking and release capacity', async () => {
      mockPayload.findByID.mockResolvedValue({
        id: 1,
        status: 'confirmed',
        sessions: [1, 2, 3],
        numberOfPeople: 2,
      })
      mockPayload.update.mockResolvedValue({ id: 1, status: 'cancelled' })

      const result = await service.cancelBooking(1)

      expect(result.success).toBe(true)
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'bookings',
        id: 1,
        data: { status: 'cancelled' },
        req: undefined,
      })
      expect(mockCapacityService.releaseSpots).toHaveBeenCalledWith([1, 2, 3], 2, undefined)
    })

    it('should skip if already cancelled', async () => {
      mockPayload.findByID.mockResolvedValue({ id: 1, status: 'cancelled' })

      const result = await service.cancelBooking(1)

      expect(result.success).toBe(true)
      expect(mockPayload.update).not.toHaveBeenCalled()
      expect(mockCapacityService.releaseSpots).not.toHaveBeenCalled()
    })

    it('should return error if booking not found', async () => {
      mockPayload.findByID.mockResolvedValue(null)

      const result = await service.cancelBooking(999)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Booking not found')
    })

    it('should handle populated session objects', async () => {
      mockPayload.findByID.mockResolvedValue({
        id: 1,
        status: 'confirmed',
        sessions: [{ id: 1 }, { id: 2 }],
        numberOfPeople: 1,
      })
      mockPayload.update.mockResolvedValue({ id: 1, status: 'cancelled' })

      await service.cancelBooking(1)

      expect(mockCapacityService.releaseSpots).toHaveBeenCalledWith([1, 2], 1, undefined)
    })
  })

  describe('handleExpiredBookings', () => {
    it('should cleanup expired pending bookings', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { id: 1, sessions: [1, 2], numberOfPeople: 2 },
          { id: 2, sessions: [3], numberOfPeople: 1 },
        ],
      })
      mockPayload.delete.mockResolvedValue({})

      const result = await service.handleExpiredBookings()

      expect(result.processed).toBe(2)
      expect(result.errors).toBe(0)
      expect(mockPayload.delete).toHaveBeenCalledTimes(2)
      expect(mockCapacityService.releaseSpots).toHaveBeenCalledTimes(2)
    })

    it('should query for expired pending bookings', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await service.handleExpiredBookings()

      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'bookings',
        where: {
          status: { equals: 'pending' },
          expiresAt: { less_than: expect.any(String) },
        },
        limit: 100,
        req: undefined,
      })
    })

    it('should continue processing if one booking fails', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { id: 1, sessions: [1], numberOfPeople: 1 },
          { id: 2, sessions: [2], numberOfPeople: 1 },
        ],
      })
      mockPayload.delete
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce({})

      const result = await service.handleExpiredBookings()

      expect(result.processed).toBe(1)
      expect(result.errors).toBe(1)
    })

    it('should return zero counts when no expired bookings', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result = await service.handleExpiredBookings()

      expect(result.processed).toBe(0)
      expect(result.errors).toBe(0)
    })
  })

  describe('handleStatusChange', () => {
    const makeBooking = (overrides: Partial<Booking> = {}): Booking => ({
      id: 1,
      bookingType: 'class',
      sessions: [1, 2],
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      numberOfPeople: 2,
      status: 'confirmed',
      paymentStatus: 'paid',
      bookingDate: new Date().toISOString(),
      checkedIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    })

    it('should release capacity when cancelled from confirmed', async () => {
      const previousDoc = makeBooking({ status: 'confirmed' })
      const currentDoc = makeBooking({ status: 'cancelled' })

      const result = await service.handleStatusChange(currentDoc, previousDoc)

      expect(result.capacityChanged).toBe(true)
      expect(result.capacityDelta).toBe(2)
      expect(mockCapacityService.releaseSpots).toHaveBeenCalledWith([1, 2], 2, undefined)
    })

    it('should release capacity when cancelled from pending', async () => {
      const previousDoc = makeBooking({ status: 'pending' })
      const currentDoc = makeBooking({ status: 'cancelled' })

      const result = await service.handleStatusChange(currentDoc, previousDoc)

      expect(result.capacityChanged).toBe(true)
      expect(mockCapacityService.releaseSpots).toHaveBeenCalledWith([1, 2], 2, undefined)
    })

    it('should NOT change capacity when pending → confirmed', async () => {
      const previousDoc = makeBooking({ status: 'pending' })
      const currentDoc = makeBooking({ status: 'confirmed' })

      const result = await service.handleStatusChange(currentDoc, previousDoc)

      expect(result.capacityChanged).toBe(false)
      expect(mockCapacityService.releaseSpots).not.toHaveBeenCalled()
      expect(mockCapacityService.reserveSpots).not.toHaveBeenCalled()
    })

    it('should adjust capacity when numberOfPeople changes on confirmed', async () => {
      const previousDoc = makeBooking({ status: 'confirmed', numberOfPeople: 3 })
      const currentDoc = makeBooking({ status: 'confirmed', numberOfPeople: 2 })

      const result = await service.handleStatusChange(currentDoc, previousDoc)

      expect(result.capacityChanged).toBe(true)
      expect(result.capacityDelta).toBe(1) // Released 1 spot
      expect(mockCapacityService.releaseSpots).toHaveBeenCalledWith([1, 2], 1, undefined)
    })

    it('should reserve more capacity when numberOfPeople increases', async () => {
      const previousDoc = makeBooking({ status: 'confirmed', numberOfPeople: 2 })
      const currentDoc = makeBooking({ status: 'confirmed', numberOfPeople: 4 })
      mockCapacityService.reserveSpots.mockResolvedValue({ success: true })

      const result = await service.handleStatusChange(currentDoc, previousDoc)

      expect(result.capacityChanged).toBe(true)
      expect(result.capacityDelta).toBe(-2) // Reserved 2 more
      expect(mockCapacityService.reserveSpots).toHaveBeenCalledWith([1, 2], 2, undefined)
    })

    it('should handle empty sessions array', async () => {
      const currentDoc = makeBooking({ sessions: [] })

      const result = await service.handleStatusChange(currentDoc, null)

      expect(result.capacityChanged).toBe(false)
    })
  })

  describe('createBookingService', () => {
    it('should create a BookingService instance', () => {
      const mockPayload = {} as Payload
      const service = createBookingService(mockPayload)
      expect(service).toBeInstanceOf(BookingService)
    })
  })
})

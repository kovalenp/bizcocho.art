import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CheckoutService, createCheckoutService, CheckoutInput, GiftOnlyCheckoutData } from './checkout'
import type { Payload } from 'payload'
import type { Booking, Class, Session } from '../payload-types'

// Mock logger
vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}))

// Mock i18n messages
vi.mock('../i18n/messages', () => ({
  getMessages: vi.fn(() => ({
    common: {
      session: 'Session',
      sessions: 'sessions',
      person: 'person',
      people: 'people',
    },
    course: {
      fullEnrollment: 'Full course enrollment',
    },
    giftCode: {
      discountApplied: 'Discount applied',
    },
  })),
}))

// Mock Stripe
const mockStripeSession = {
  id: 'cs_test_123',
  url: 'https://checkout.stripe.com/test',
}

const mockStripe = {
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue(mockStripeSession),
    },
  },
}

vi.mock('../lib/stripe', () => ({
  getStripe: vi.fn(() => mockStripe),
}))

// Mock CapacityService
const mockCapacityService = {
  reserveSpots: vi.fn(),
  releaseSpots: vi.fn(),
}

vi.mock('./capacity', () => ({
  createCapacityService: vi.fn(() => mockCapacityService),
  CapacityService: vi.fn(),
}))

// Mock GiftCertificateService
const mockGiftService = {
  calculateDiscount: vi.fn(),
  reserveCode: vi.fn(),
  releaseCode: vi.fn(),
  applyCode: vi.fn(),
}

vi.mock('./gift-certificates', () => ({
  createGiftCertificateService: vi.fn(() => mockGiftService),
  GiftCertificateService: vi.fn(),
}))

describe('CheckoutService', () => {
  let mockPayload: {
    findByID: ReturnType<typeof vi.fn>
    find: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  let service: CheckoutService

  const mockClass: Class = {
    id: 1,
    title: 'Pottery Class',
    slug: 'pottery-class',
    type: 'class',
    priceCents: 5000,
    currency: 'eur',
    durationMinutes: 180,
    maxCapacity: 8,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const mockSession: Session = {
    id: 10,
    sessionType: 'class',
    class: 1,
    startDateTime: '2024-06-15T18:00:00.000Z',
    timezone: 'Europe/Madrid',
    status: 'scheduled',
    availableSpots: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const mockBooking: Booking = {
    id: 100,
    bookingType: 'class',
    sessions: [10],
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
  }

  const validInput: CheckoutInput = {
    classId: 1,
    sessionId: 10,
    customer: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
    },
    numberOfPeople: 2,
    locale: 'en',
  }

  beforeEach(() => {
    process.env.SITE_URL = 'https://example.com'

    mockPayload = {
      findByID: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    }

    // Reset mocks
    mockCapacityService.reserveSpots.mockReset().mockResolvedValue({ success: true })
    mockCapacityService.releaseSpots.mockReset().mockResolvedValue(undefined)
    mockGiftService.calculateDiscount.mockReset()
    mockGiftService.reserveCode.mockReset().mockResolvedValue({ success: true })
    mockGiftService.releaseCode.mockReset().mockResolvedValue({ success: true })
    mockGiftService.applyCode.mockReset().mockResolvedValue({ success: true })
    mockStripe.checkout.sessions.create.mockReset().mockResolvedValue(mockStripeSession)

    service = new CheckoutService(mockPayload as unknown as Payload)
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.SITE_URL
  })

  describe('initiateCheckout', () => {
    it('should successfully create a checkout session for a class booking', async () => {
      mockPayload.findByID
        .mockResolvedValueOnce(mockClass) // class lookup
        .mockResolvedValueOnce(mockSession) // session lookup
      mockPayload.create.mockResolvedValue(mockBooking)
      mockPayload.update.mockResolvedValue(mockBooking)

      const result = await service.initiateCheckout(validInput)

      expect(result.success).toBe(true)
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/test')
      expect(result.bookingId).toBe(100)
      expect(mockCapacityService.reserveSpots).toHaveBeenCalledWith([10], 2)
      expect(mockPayload.create).toHaveBeenCalled()
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalled()
    })

    it('should return error if class not found', async () => {
      mockPayload.findByID.mockResolvedValue(null)

      const result = await service.initiateCheckout(validInput)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Class not found')
      expect(result.status).toBe(404)
    })

    it('should return error if class not published', async () => {
      mockPayload.findByID.mockResolvedValue({ ...mockClass, isPublished: false })

      const result = await service.initiateCheckout(validInput)

      expect(result.success).toBe(false)
      expect(result.error).toBe('This offering is not available')
      expect(result.status).toBe(400)
    })

    it('should return error if session not found', async () => {
      mockPayload.findByID
        .mockResolvedValueOnce(mockClass)
        .mockResolvedValueOnce(null)

      const result = await service.initiateCheckout(validInput)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Session not found')
      expect(result.status).toBe(404)
    })

    it('should return error if capacity reservation fails', async () => {
      mockPayload.findByID
        .mockResolvedValueOnce(mockClass)
        .mockResolvedValueOnce(mockSession)
      mockCapacityService.reserveSpots.mockResolvedValue({
        success: false,
        error: 'Not enough spots',
      })

      const result = await service.initiateCheckout(validInput)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not enough spots')
      expect(result.status).toBe(409)
    })

    it('should handle gift code discount', async () => {
      mockPayload.findByID
        .mockResolvedValueOnce(mockClass)
        .mockResolvedValueOnce(mockSession)
      mockPayload.create.mockResolvedValue(mockBooking)
      mockPayload.update.mockResolvedValue(mockBooking)
      mockGiftService.calculateDiscount.mockResolvedValue({
        discountCents: 2000,
        remainingToPayCents: 8000,
      })

      const result = await service.initiateCheckout({
        ...validInput,
        giftCode: 'GIFT-1234',
      })

      expect(result.success).toBe(true)
      expect(mockGiftService.reserveCode).toHaveBeenCalledWith('GIFT-1234', 2000)
    })

    it('should return giftOnlyCheckout when gift covers full amount', async () => {
      mockPayload.findByID
        .mockResolvedValueOnce(mockClass)
        .mockResolvedValueOnce(mockSession)
      mockGiftService.calculateDiscount.mockResolvedValue({
        discountCents: 10000,
        remainingToPayCents: 0,
      })

      const result = await service.initiateCheckout({
        ...validInput,
        giftCode: 'GIFT-FULL',
      })

      expect(result.success).toBe(true)
      expect(result.giftOnlyCheckout).toBe(true)
      expect(result.giftOnlyData).toBeDefined()
      expect(result.giftOnlyData?.giftCode).toBe('GIFT-FULL')
      // Should NOT reserve capacity (that's done in gift-only flow)
      expect(mockCapacityService.reserveSpots).not.toHaveBeenCalled()
    })

    it('should rollback capacity if gift code reservation fails', async () => {
      mockPayload.findByID
        .mockResolvedValueOnce(mockClass)
        .mockResolvedValueOnce(mockSession)
      mockGiftService.calculateDiscount.mockResolvedValue({
        discountCents: 2000,
        remainingToPayCents: 8000,
      })
      mockGiftService.reserveCode.mockResolvedValue({
        success: false,
        error: 'Insufficient funds',
      })

      const result = await service.initiateCheckout({
        ...validInput,
        giftCode: 'GIFT-1234',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Insufficient funds')
      expect(mockCapacityService.releaseSpots).toHaveBeenCalledWith([10], 2)
    })

    it('should rollback all reservations if booking creation fails', async () => {
      mockPayload.findByID
        .mockResolvedValueOnce(mockClass)
        .mockResolvedValueOnce(mockSession)
      mockGiftService.calculateDiscount.mockResolvedValue({
        discountCents: 2000,
        remainingToPayCents: 8000,
      })
      mockPayload.create.mockRejectedValue(new Error('DB error'))

      const result = await service.initiateCheckout({
        ...validInput,
        giftCode: 'GIFT-1234',
      })

      expect(result.success).toBe(false)
      expect(mockCapacityService.releaseSpots).toHaveBeenCalled()
      expect(mockGiftService.releaseCode).toHaveBeenCalledWith('GIFT-1234', 2000)
    })

    it('should handle course bookings (all sessions)', async () => {
      const courseClass = { ...mockClass, type: 'course' }
      const courseSessions = [
        { ...mockSession, id: 1 },
        { ...mockSession, id: 2 },
        { ...mockSession, id: 3 },
      ]

      mockPayload.findByID.mockResolvedValueOnce(courseClass)
      mockPayload.find.mockResolvedValue({ docs: courseSessions })
      mockPayload.create.mockResolvedValue({ ...mockBooking, bookingType: 'course' })
      mockPayload.update.mockResolvedValue(mockBooking)

      const result = await service.initiateCheckout({
        ...validInput,
        sessionId: undefined, // Course doesn't need sessionId
      })

      expect(result.success).toBe(true)
      expect(mockCapacityService.reserveSpots).toHaveBeenCalledWith([1, 2, 3], 2)
    })
  })

  describe('completeGiftOnlyCheckout', () => {
    const giftOnlyData: GiftOnlyCheckoutData = {
      classId: 1,
      sessionIds: [10],
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      numberOfPeople: 2,
      locale: 'en',
      giftCode: 'GIFT-FULL',
      giftDiscountCents: 10000,
      totalPriceCents: 10000,
      bookingType: 'class',
    }

    it('should successfully complete a gift-only checkout', async () => {
      mockGiftService.calculateDiscount.mockResolvedValue({
        discountCents: 10000,
        remainingToPayCents: 0,
      })
      mockPayload.findByID.mockResolvedValue(mockClass)
      mockPayload.create.mockResolvedValue({ ...mockBooking, status: 'confirmed' })

      const result = await service.completeGiftOnlyCheckout(giftOnlyData)

      expect(result.success).toBe(true)
      expect(result.confirmed).toBe(true)
      expect(result.bookingId).toBeDefined()
      expect(result.redirectUrl).toContain('/booking/success')
      expect(mockCapacityService.reserveSpots).toHaveBeenCalled()
      expect(mockGiftService.reserveCode).toHaveBeenCalled()
      expect(mockGiftService.applyCode).toHaveBeenCalled()
    })

    it('should return error if gift code no longer covers full amount', async () => {
      mockGiftService.calculateDiscount.mockResolvedValue({
        discountCents: 5000,
        remainingToPayCents: 5000,
      })

      const result = await service.completeGiftOnlyCheckout(giftOnlyData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('no longer covers the full amount')
      expect(result.status).toBe(400)
    })

    it('should return error if class not found', async () => {
      mockGiftService.calculateDiscount.mockResolvedValue({
        discountCents: 10000,
        remainingToPayCents: 0,
      })
      mockPayload.findByID.mockResolvedValue(null)

      const result = await service.completeGiftOnlyCheckout(giftOnlyData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Class not found')
      expect(result.status).toBe(404)
    })

    it('should rollback on booking creation failure', async () => {
      mockGiftService.calculateDiscount.mockResolvedValue({
        discountCents: 10000,
        remainingToPayCents: 0,
      })
      mockPayload.findByID.mockResolvedValue(mockClass)
      mockPayload.create.mockRejectedValue(new Error('DB error'))

      const result = await service.completeGiftOnlyCheckout(giftOnlyData)

      expect(result.success).toBe(false)
      expect(mockCapacityService.releaseSpots).toHaveBeenCalled()
      expect(mockGiftService.releaseCode).toHaveBeenCalled()
    })
  })

  describe('createCheckoutService', () => {
    it('should create a CheckoutService instance', () => {
      const service = createCheckoutService({} as Payload)
      expect(service).toBeInstanceOf(CheckoutService)
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PaymentService, createPaymentService, CreateCheckoutParams } from './payment'
import type { Payload } from 'payload'
import type { Booking, Class, Session } from '../payload-types'
import Stripe from 'stripe'

// Mock logger
vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}))

// Mock Stripe
vi.mock('stripe', () => {
  const mockStripe = vi.fn(() => ({
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  }))
  return { default: mockStripe }
})

// Mock BookingService
const mockBookingService = {
  confirmBooking: vi.fn(),
  cancelBooking: vi.fn(),
}

vi.mock('./booking', () => ({
  createBookingService: vi.fn(() => mockBookingService),
  BookingService: vi.fn(),
}))

// Mock GiftCertificateService
const mockGiftService = {
  applyCode: vi.fn(),
}

vi.mock('./gift-certificates', () => ({
  createGiftCertificateService: vi.fn(() => mockGiftService),
  GiftCertificateService: vi.fn(),
}))

describe('PaymentService', () => {
  let mockPayload: {
    find: ReturnType<typeof vi.fn>
    findByID: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  let mockStripeInstance: {
    checkout: { sessions: { create: ReturnType<typeof vi.fn> } }
    webhooks: { constructEvent: ReturnType<typeof vi.fn> }
  }
  let service: PaymentService

  const mockBooking: Booking = {
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
  }

  const mockClass: Class = {
    id: 1,
    title: 'Test Class',
    slug: 'test-class',
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
    id: 1,
    sessionType: 'class',
    class: 1,
    startDateTime: '2024-01-15T18:00:00.000Z',
    timezone: 'Europe/Madrid',
    status: 'scheduled',
    availableSpots: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    // Set env var for Stripe
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.SITE_URL = 'https://example.com'

    mockPayload = {
      find: vi.fn(),
      findByID: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }

    // Get the mock Stripe instance
    const StripeMock = Stripe as unknown as ReturnType<typeof vi.fn>
    mockStripeInstance = {
      checkout: { sessions: { create: vi.fn() } },
      webhooks: { constructEvent: vi.fn() },
    }
    StripeMock.mockReturnValue(mockStripeInstance)

    service = new PaymentService(mockPayload as unknown as Payload)
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.SITE_URL
  })

  describe('constructor', () => {
    it('should throw if STRIPE_SECRET_KEY is not set', () => {
      delete process.env.STRIPE_SECRET_KEY

      expect(() => new PaymentService(mockPayload as unknown as Payload)).toThrow(
        'STRIPE_SECRET_KEY is not configured'
      )
    })

    it('should accept stripeSecretKey as parameter', () => {
      delete process.env.STRIPE_SECRET_KEY

      expect(() => new PaymentService(mockPayload as unknown as Payload, 'sk_test_direct')).not.toThrow()
    })
  })

  describe('createCheckoutSession', () => {
    const validParams: CreateCheckoutParams = {
      booking: mockBooking,
      classDoc: mockClass,
      sessions: [mockSession],
      locale: 'en',
      amountCents: 5000,
    }

    it('should create a checkout session successfully', async () => {
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })

      const result = await service.createCheckoutSession(validParams)

      expect(result.success).toBe(true)
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test_123')
      expect(result.sessionId).toBe('cs_test_123')
    })

    it('should include correct metadata', async () => {
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })

      await service.createCheckoutSession(validParams)

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            bookingId: '1',
            bookingType: 'class',
            classId: '1',
            sessionIds: '1',
            firstName: 'John',
            lastName: 'Doe',
            locale: 'en',
          }),
        })
      )
    })

    it('should include gift code in metadata when provided', async () => {
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })

      await service.createCheckoutSession({
        ...validParams,
        giftCode: 'GIFT-1234',
        giftDiscountCents: 1000,
      })

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            giftCode: 'GIFT-1234',
            giftDiscountCents: '1000',
          }),
        })
      )
    })

    it('should use course description for course bookings', async () => {
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })

      const courseBooking = { ...mockBooking, bookingType: 'course' as const }
      await service.createCheckoutSession({
        ...validParams,
        booking: courseBooking,
        sessions: [mockSession, { ...mockSession, id: 2 }],
      })

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                product_data: expect.objectContaining({
                  description: expect.stringContaining('Full course enrollment'),
                }),
              }),
            }),
          ],
        })
      )
    })

    it('should handle Stripe errors gracefully', async () => {
      mockStripeInstance.checkout.sessions.create.mockRejectedValue(new Error('Stripe error'))

      const result = await service.createCheckoutSession(validParams)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create checkout session')
    })
  })

  describe('verifyWebhookSignature', () => {
    it('should return event on valid signature', () => {
      const mockEvent = { type: 'checkout.session.completed' } as Stripe.Event
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent)

      const result = service.verifyWebhookSignature('body', 'sig', 'secret')

      expect(result).toBe(mockEvent)
    })

    it('should return null on invalid signature', () => {
      mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const result = service.verifyWebhookSignature('body', 'sig', 'secret')

      expect(result).toBeNull()
    })
  })

  describe('handleWebhook', () => {
    describe('checkout.session.completed', () => {
      it('should confirm booking on successful payment', async () => {
        mockBookingService.confirmBooking.mockResolvedValue({ success: true })

        const event: Partial<Stripe.Event> = {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_123',
              payment_intent: 'pi_123',
              metadata: {
                bookingId: '1',
                bookingType: 'class',
              },
            } as Stripe.Checkout.Session,
          },
        }

        const result = await service.handleWebhook(event as Stripe.Event)

        expect(result.success).toBe(true)
        expect(result.action).toBe('booking_confirmed')
        expect(mockBookingService.confirmBooking).toHaveBeenCalledWith(1, 'pi_123', expect.any(Object))
      })

      it('should apply gift code when present', async () => {
        mockBookingService.confirmBooking.mockResolvedValue({ success: true })
        mockGiftService.applyCode.mockResolvedValue({ success: true })

        const event: Partial<Stripe.Event> = {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_123',
              payment_intent: 'pi_123',
              amount_total: 4000,
              metadata: {
                bookingId: '1',
                giftCode: 'GIFT-1234',
                giftDiscountCents: '1000',
              },
            } as Stripe.Checkout.Session,
          },
        }

        await service.handleWebhook(event as Stripe.Event)

        expect(mockGiftService.applyCode).toHaveBeenCalledWith({
          code: 'GIFT-1234',
          bookingId: 1,
          amountCents: 1000,
        })
      })

      it('should handle gift certificate activation', async () => {
        mockPayload.findByID.mockResolvedValue({ id: 1, status: 'pending' })
        mockPayload.update.mockResolvedValue({ id: 1, status: 'active' })

        const event: Partial<Stripe.Event> = {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_123',
              payment_intent: 'pi_123',
              metadata: {
                purchaseType: 'gift_certificate',
                giftCertificateId: '1',
              },
            } as Stripe.Checkout.Session,
          },
        }

        const result = await service.handleWebhook(event as Stripe.Event)

        expect(result.success).toBe(true)
        expect(result.action).toBe('gift_activated')
        expect(mockPayload.update).toHaveBeenCalledWith({
          collection: 'gift-certificates',
          id: 1,
          data: expect.objectContaining({ status: 'active' }),
        })
      })

      it('should skip if gift certificate already active (idempotency)', async () => {
        mockPayload.findByID.mockResolvedValue({ id: 1, status: 'active' })

        const event: Partial<Stripe.Event> = {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_123',
              metadata: {
                purchaseType: 'gift_certificate',
                giftCertificateId: '1',
              },
            } as Stripe.Checkout.Session,
          },
        }

        const result = await service.handleWebhook(event as Stripe.Event)

        expect(result.success).toBe(true)
        expect(mockPayload.update).not.toHaveBeenCalled()
      })
    })

    describe('checkout.session.expired', () => {
      it('should cancel and delete expired booking', async () => {
        mockBookingService.cancelBooking.mockResolvedValue({ success: true })
        mockPayload.delete.mockResolvedValue({})

        const event: Partial<Stripe.Event> = {
          type: 'checkout.session.expired',
          data: {
            object: {
              id: 'cs_123',
              metadata: {
                bookingId: '1',
              },
            } as Stripe.Checkout.Session,
          },
        }

        const result = await service.handleWebhook(event as Stripe.Event)

        expect(result.success).toBe(true)
        expect(result.action).toBe('booking_expired')
        expect(mockBookingService.cancelBooking).toHaveBeenCalledWith(1)
        expect(mockPayload.delete).toHaveBeenCalledWith({
          collection: 'bookings',
          id: 1,
        })
      })

      it('should delete expired gift certificate', async () => {
        mockPayload.delete.mockResolvedValue({})

        const event: Partial<Stripe.Event> = {
          type: 'checkout.session.expired',
          data: {
            object: {
              id: 'cs_123',
              metadata: {
                purchaseType: 'gift_certificate',
                giftCertificateId: '1',
              },
            } as Stripe.Checkout.Session,
          },
        }

        const result = await service.handleWebhook(event as Stripe.Event)

        expect(result.success).toBe(true)
        expect(result.action).toBe('gift_expired')
        expect(mockPayload.delete).toHaveBeenCalledWith({
          collection: 'gift-certificates',
          id: 1,
        })
      })
    })

    describe('unhandled events', () => {
      it('should return ignored for unhandled event types', async () => {
        const event: Partial<Stripe.Event> = {
          type: 'payment_intent.created',
          data: { object: {} },
        }

        const result = await service.handleWebhook(event as Stripe.Event)

        expect(result.success).toBe(true)
        expect(result.action).toBe('ignored')
      })
    })
  })

  describe('createPaymentService', () => {
    it('should create a PaymentService instance', () => {
      const service = createPaymentService(mockPayload as unknown as Payload)
      expect(service).toBeInstanceOf(PaymentService)
    })
  })
})

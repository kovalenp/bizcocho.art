import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NotificationService, createNotificationService } from './notifications'
import type { Payload } from 'payload'
import type { Booking, Session, Class, GiftCertificate } from '../payload-types'

// Mock logger
vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}))

// Mock email functions
const mockSendBookingConfirmationEmail = vi.fn().mockResolvedValue(undefined)
const mockSendCourseConfirmationEmail = vi.fn().mockResolvedValue(undefined)
const mockSendGiftCertificateToRecipient = vi.fn().mockResolvedValue(undefined)
const mockSendGiftCertificatePurchaseConfirmation = vi.fn().mockResolvedValue(undefined)

vi.mock('../lib/email', () => ({
  sendBookingConfirmationEmail: (...args: unknown[]) => mockSendBookingConfirmationEmail(...args),
  sendCourseConfirmationEmail: (...args: unknown[]) => mockSendCourseConfirmationEmail(...args),
  sendGiftCertificateToRecipient: (...args: unknown[]) => mockSendGiftCertificateToRecipient(...args),
  sendGiftCertificatePurchaseConfirmation: (...args: unknown[]) => mockSendGiftCertificatePurchaseConfirmation(...args),
}))

describe('NotificationService', () => {
  let mockPayload: {
    findByID: ReturnType<typeof vi.fn>
  }
  let service: NotificationService

  const makeSession = (overrides: Partial<Session> = {}): Session => ({
    id: 1,
    startDateTime: new Date().toISOString(),
    endDateTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'scheduled',
    sessionType: 'class',
    class: {
      id: 1,
      title: 'Pottery Class',
      type: 'class',
      maxCapacity: 10,
      priceCents: 5000,
      currency: 'eur',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Class,
    availableSpots: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  const makeBooking = (overrides: Partial<Booking> = {}): Booking => ({
    id: 1,
    bookingType: 'class',
    sessions: [makeSession()],
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

  const makeGiftCertificate = (overrides: Partial<GiftCertificate> = {}): GiftCertificate => ({
    id: 1,
    code: 'ABCD-1234',
    type: 'gift',
    status: 'active',
    initialValueCents: 5000,
    currentBalanceCents: 5000,
    currency: 'eur',
    purchaser: {
      email: 'buyer@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    },
    recipient: {
      email: 'recipient@example.com',
      name: 'Bob Wilson',
      personalMessage: 'Happy Birthday!',
    },
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    redemptions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn(),
    }
    service = new NotificationService(mockPayload as unknown as Payload)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('sendBookingConfirmation', () => {
    it('should send class booking confirmation email', async () => {
      const booking = makeBooking({ bookingType: 'class' })
      mockPayload.findByID.mockResolvedValue(booking)

      await service.sendBookingConfirmation(1, { locale: 'en' })

      expect(mockSendBookingConfirmationEmail).toHaveBeenCalledWith({
        booking,
        session: booking.sessions[0],
        locale: 'en',
      })
    })

    it('should send course confirmation email for course bookings', async () => {
      const sessions = [makeSession({ id: 1 }), makeSession({ id: 2 }), makeSession({ id: 3 })]
      const booking = makeBooking({ bookingType: 'course', sessions })
      mockPayload.findByID.mockResolvedValue(booking)

      await service.sendBookingConfirmation(1, { locale: 'es' })

      expect(mockSendCourseConfirmationEmail).toHaveBeenCalledWith({
        booking,
        classDoc: sessions[0].class,
        sessions,
        locale: 'es',
      })
    })

    it('should fetch class if not populated', async () => {
      const session = { ...makeSession(), class: 5 } // class as ID
      const booking = makeBooking({ sessions: [session as unknown as Session] })
      const classDoc = { id: 5, title: 'Art Class' }

      mockPayload.findByID
        .mockResolvedValueOnce(booking)
        .mockResolvedValueOnce(classDoc)

      await service.sendBookingConfirmation(1)

      expect(mockPayload.findByID).toHaveBeenCalledWith({
        collection: 'classes',
        id: 5,
      })
    })

    it('should use default locale if not provided', async () => {
      const booking = makeBooking()
      mockPayload.findByID.mockResolvedValue(booking)

      await service.sendBookingConfirmation(1)

      expect(mockSendBookingConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'en' })
      )
    })

    it('should not throw if booking not found', async () => {
      mockPayload.findByID.mockResolvedValue(null)

      // Should not throw
      await expect(service.sendBookingConfirmation(999)).resolves.not.toThrow()
    })

    it('should not throw if email sending fails', async () => {
      const booking = makeBooking()
      mockPayload.findByID.mockResolvedValue(booking)
      mockSendBookingConfirmationEmail.mockRejectedValue(new Error('SMTP error'))

      // Should not throw
      await expect(service.sendBookingConfirmation(1)).resolves.not.toThrow()
    })

    it('should not throw if sessions array is empty', async () => {
      const booking = makeBooking({ sessions: [] })
      mockPayload.findByID.mockResolvedValue(booking)

      await expect(service.sendBookingConfirmation(1)).resolves.not.toThrow()
    })
  })

  describe('sendGiftCertificateActivation', () => {
    it('should send emails to both recipient and purchaser', async () => {
      const cert = makeGiftCertificate()
      mockPayload.findByID.mockResolvedValue(cert)

      await service.sendGiftCertificateActivation(1, { locale: 'en' })

      expect(mockSendGiftCertificateToRecipient).toHaveBeenCalledWith({
        code: 'ABCD-1234',
        amountCents: 5000,
        currency: 'eur',
        expiresAt: cert.expiresAt,
        recipientEmail: 'recipient@example.com',
        recipientName: 'Bob Wilson',
        personalMessage: 'Happy Birthday!',
        purchaserName: 'Jane Smith',
        locale: 'en',
      })

      expect(mockSendGiftCertificatePurchaseConfirmation).toHaveBeenCalledWith({
        code: 'ABCD-1234',
        amountCents: 5000,
        currency: 'eur',
        purchaserEmail: 'buyer@example.com',
        purchaserName: 'Jane Smith',
        recipientEmail: 'recipient@example.com',
        recipientName: 'Bob Wilson',
        locale: 'en',
      })
    })

    it('should handle missing purchaser/recipient info gracefully', async () => {
      const cert = makeGiftCertificate({
        purchaser: undefined,
        recipient: undefined,
      })
      mockPayload.findByID.mockResolvedValue(cert)

      await service.sendGiftCertificateActivation(1)

      expect(mockSendGiftCertificateToRecipient).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: '',
          recipientName: '',
          purchaserName: '',
        })
      )
    })

    it('should use Spanish locale when specified', async () => {
      const cert = makeGiftCertificate()
      mockPayload.findByID.mockResolvedValue(cert)

      await service.sendGiftCertificateActivation(1, { locale: 'es' })

      expect(mockSendGiftCertificateToRecipient).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'es' })
      )
      expect(mockSendGiftCertificatePurchaseConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'es' })
      )
    })

    it('should not throw if certificate not found', async () => {
      mockPayload.findByID.mockResolvedValue(null)

      await expect(service.sendGiftCertificateActivation(999)).resolves.not.toThrow()
    })

    it('should not throw if email sending fails', async () => {
      const cert = makeGiftCertificate()
      mockPayload.findByID.mockResolvedValue(cert)
      mockSendGiftCertificateToRecipient.mockRejectedValue(new Error('SMTP error'))

      await expect(service.sendGiftCertificateActivation(1)).resolves.not.toThrow()
    })
  })

  describe('createNotificationService', () => {
    it('should create a service instance', () => {
      const mockPayload = {} as Payload
      const service = createNotificationService(mockPayload)
      expect(service).toBeInstanceOf(NotificationService)
    })
  })
})

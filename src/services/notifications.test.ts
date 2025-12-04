import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NotificationService, createNotificationService } from './notifications'
import type { Payload } from 'payload'
import type { Booking, Session, Class, GiftCertificate } from '../payload-types'

// Mock logger
vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}))

// Mock sendEmail
const mockSendEmail = vi.fn().mockResolvedValue(undefined)

vi.mock('../lib/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

// Mock React Email render - needs to handle both HTML and plainText calls
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockImplementation((_element, options) => {
    if (options?.plainText) {
      return Promise.resolve('Plain text email content')
    }
    return Promise.resolve('<html>test</html>')
  }),
}))

// Mock email templates
vi.mock('../emails/templates/BookingConfirmation', () => ({
  BookingConfirmation: vi.fn().mockReturnValue({}),
}))
vi.mock('../emails/templates/CourseConfirmation', () => ({
  CourseConfirmation: vi.fn().mockReturnValue({}),
}))
vi.mock('../emails/templates/GiftCertificateRecipient', () => ({
  GiftCertificateRecipient: vi.fn().mockReturnValue({}),
}))
vi.mock('../emails/templates/GiftCertificatePurchase', () => ({
  GiftCertificatePurchase: vi.fn().mockReturnValue({}),
}))

// Mock translations
vi.mock('../emails/translations', () => ({
  bookingConfirmationTranslations: {
    en: { subject: 'Booking Confirmation' },
    es: { subject: 'Confirmación de Reserva' },
  },
  courseConfirmationTranslations: {
    en: { subject: 'Course Confirmation' },
    es: { subject: 'Confirmación de Curso' },
  },
  giftCertificateRecipientTranslations: {
    en: { subject: 'You received a gift certificate!' },
    es: { subject: 'Has recibido un certificado de regalo!' },
  },
  giftCertificatePurchaseTranslations: {
    en: { subject: 'Gift Certificate Purchase Confirmation' },
    es: { subject: 'Confirmación de Compra de Certificado de Regalo' },
  },
}))

describe('NotificationService', () => {
  let mockPayload: {
    findByID: ReturnType<typeof vi.fn>
  }
  let service: NotificationService

  const makeClass = (overrides: Partial<Class> = {}): Class => ({
    id: 1,
    title: 'Pottery Class',
    type: 'class',
    maxCapacity: 10,
    priceCents: 5000,
    currency: 'eur',
    location: 'Studio 42',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Class)

  const makeSession = (overrides: Partial<Session> = {}): Session => ({
    id: 1,
    startDateTime: new Date().toISOString(),
    endDateTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'scheduled',
    sessionType: 'class',
    class: makeClass(),
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
    // Clear all mocks first
    vi.clearAllMocks()
    mockSendEmail.mockClear()

    mockPayload = {
      findByID: vi.fn(),
    }
    service = new NotificationService(mockPayload as unknown as Payload)
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockSendEmail.mockClear()
  })

  describe('sendBookingConfirmation', () => {
    it('should send class booking confirmation email', async () => {
      const classDoc = makeClass()
      const booking = makeBooking({ bookingType: 'class' })
      mockPayload.findByID
        .mockResolvedValueOnce(booking) // booking fetch
        .mockResolvedValueOnce(classDoc) // class fetch with locale

      await service.sendBookingConfirmation(1, { locale: 'en' })

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
        })
      )
    })

    it('should send course confirmation email for course bookings', async () => {
      const classDoc = makeClass()
      const sessions = [makeSession({ id: 1 }), makeSession({ id: 2 }), makeSession({ id: 3 })]
      const booking = makeBooking({ bookingType: 'course', sessions })
      mockPayload.findByID
        .mockResolvedValueOnce(booking)
        .mockResolvedValueOnce(classDoc)

      await service.sendBookingConfirmation(1, { locale: 'es' })

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
        })
      )
    })

    it('should fetch class with locale for translated title', async () => {
      const classDoc = makeClass({ id: 5, title: 'Art Class' })
      const session = makeSession({ class: 5 as unknown as Class })
      const booking = makeBooking({ sessions: [session] })

      mockPayload.findByID
        .mockResolvedValueOnce(booking)
        .mockResolvedValueOnce(classDoc)

      await service.sendBookingConfirmation(1, { locale: 'es' })

      // Verify booking is fetched with locale
      expect(mockPayload.findByID).toHaveBeenNthCalledWith(1, {
        collection: 'bookings',
        id: 1,
        depth: 2,
        locale: 'es',
      })

      // Verify class is fetched with locale
      expect(mockPayload.findByID).toHaveBeenNthCalledWith(2, {
        collection: 'classes',
        id: 5,
        locale: 'es',
      })
    })

    it('should use default locale if not provided', async () => {
      const classDoc = makeClass()
      const booking = makeBooking()
      mockPayload.findByID
        .mockResolvedValueOnce(booking)
        .mockResolvedValueOnce(classDoc)

      await service.sendBookingConfirmation(1)

      // Should use 'en' as default locale
      expect(mockPayload.findByID).toHaveBeenNthCalledWith(1, {
        collection: 'bookings',
        id: 1,
        depth: 2,
        locale: 'en',
      })
    })

    it('should not throw if booking not found', async () => {
      mockPayload.findByID.mockResolvedValue(null)

      // Should not throw
      await expect(service.sendBookingConfirmation(999)).resolves.not.toThrow()
    })

    it('should not throw if email sending fails', async () => {
      const classDoc = makeClass()
      const booking = makeBooking()
      mockPayload.findByID
        .mockResolvedValueOnce(booking)
        .mockResolvedValueOnce(classDoc)
      mockSendEmail.mockRejectedValue(new Error('SMTP error'))

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
      // Reset mockSendEmail to ensure clean state
      mockSendEmail.mockReset()
      mockSendEmail.mockResolvedValue(undefined)

      const cert = makeGiftCertificate()
      mockPayload.findByID.mockResolvedValue(cert)

      await service.sendGiftCertificateActivation(1, { locale: 'en' })

      // Should send two emails: one to recipient, one to purchaser
      expect(mockSendEmail).toHaveBeenCalledTimes(2)
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'recipient@example.com' })
      )
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'buyer@example.com' })
      )
    })

    it('should skip emails when purchaser/recipient info is missing', async () => {
      const cert = makeGiftCertificate({
        purchaser: undefined,
        recipient: undefined,
      })
      mockPayload.findByID.mockResolvedValue(cert)

      await service.sendGiftCertificateActivation(1)

      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should use Spanish locale when specified', async () => {
      // Reset mockSendEmail to ensure clean state
      mockSendEmail.mockReset()
      mockSendEmail.mockResolvedValue(undefined)

      const cert = makeGiftCertificate()
      mockPayload.findByID.mockResolvedValue(cert)

      await service.sendGiftCertificateActivation(1, { locale: 'es' })

      // Emails should be sent (locale affects template content)
      expect(mockSendEmail).toHaveBeenCalledTimes(2)
    })

    it('should not throw if certificate not found', async () => {
      mockPayload.findByID.mockResolvedValue(null)

      await expect(service.sendGiftCertificateActivation(999)).resolves.not.toThrow()
    })

    it('should not throw if email sending fails', async () => {
      const cert = makeGiftCertificate()
      mockPayload.findByID.mockResolvedValue(cert)
      mockSendEmail.mockRejectedValue(new Error('SMTP error'))

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

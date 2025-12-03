import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import nodemailer from 'nodemailer'

// Mock nodemailer before importing the module under test
vi.mock('nodemailer', () => {
  const sendMailMock = vi.fn()
  return {
    default: {
      createTransport: vi.fn(() => ({
        sendMail: sendMailMock,
      })),
    },
  }
})

// Mock logger to avoid noise during tests
vi.mock('./logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

import { sendBookingConfirmationEmail } from './email'
import { logError, logWarn } from './logger'

describe('Email Service', () => {
  const mockBooking = {
    id: 1,
    email: 'test@example.com',
    numberOfPeople: 2,
  }
  
  const mockSession = {
    startDateTime: new Date().toISOString(),
    class: {
      title: 'Test Class',
      priceCents: 2000,
      currency: 'eur',
    }
  }

  let transporterMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    transporterMock = nodemailer.createTransport()
  })

  it('should send email successfully on first attempt', async () => {
    transporterMock.sendMail.mockResolvedValueOnce('success')

    await sendBookingConfirmationEmail({
      booking: mockBooking as any,
      session: mockSession,
      locale: 'en',
    })

    expect(transporterMock.sendMail).toHaveBeenCalledTimes(1)
    expect(logWarn).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it('should retry on failure and succeed', async () => {
    transporterMock.sendMail
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('success')

    await sendBookingConfirmationEmail({
      booking: mockBooking as any,
      session: mockSession,
      locale: 'en',
    })

    expect(transporterMock.sendMail).toHaveBeenCalledTimes(2)
    expect(logWarn).toHaveBeenCalledTimes(1)
    expect(logError).not.toHaveBeenCalled()
  })

  it('should fail after max retries', async () => {
    transporterMock.sendMail
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockRejectedValueOnce(new Error('Error 3'))

    await expect(sendBookingConfirmationEmail({
      booking: mockBooking as any,
      session: mockSession,
      locale: 'en',
    })).rejects.toThrow('Error 3')

    expect(transporterMock.sendMail).toHaveBeenCalledTimes(3)
    expect(logWarn).toHaveBeenCalledTimes(2)
    expect(logError).toHaveBeenCalledTimes(1)
  })
})

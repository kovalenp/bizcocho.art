import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn(),
    },
  })),
}))

// Mock logger to avoid noise during tests
vi.mock('./logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}))

import { sendEmail, resetTransport } from './email'
import { logError, logWarn } from './logger'

describe('Email Service', () => {
  const mockEmailOptions = {
    to: 'test@example.com',
    subject: 'Test Subject',
    html: '<h1>Test</h1>',
    text: 'Test',
  }

  let transporterMock: ReturnType<typeof nodemailer.createTransport>

  beforeEach(() => {
    vi.clearAllMocks()
    resetTransport() // Reset cached transport between tests
    transporterMock = nodemailer.createTransport() as ReturnType<typeof nodemailer.createTransport>
  })

  it('should send email successfully on first attempt', async () => {
    ;(transporterMock.sendMail as ReturnType<typeof vi.fn>).mockResolvedValueOnce('success')

    await sendEmail(mockEmailOptions)

    expect(transporterMock.sendMail).toHaveBeenCalledTimes(1)
    expect(transporterMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: mockEmailOptions.to,
        subject: mockEmailOptions.subject,
        html: mockEmailOptions.html,
        text: mockEmailOptions.text,
      })
    )
    expect(logWarn).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it('should retry on failure and succeed', async () => {
    ;(transporterMock.sendMail as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('success')

    await sendEmail(mockEmailOptions)

    expect(transporterMock.sendMail).toHaveBeenCalledTimes(2)
    expect(logWarn).toHaveBeenCalledTimes(1)
    expect(logError).not.toHaveBeenCalled()
  })

  it('should fail after max retries', async () => {
    ;(transporterMock.sendMail as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockRejectedValueOnce(new Error('Error 3'))

    await expect(sendEmail(mockEmailOptions)).rejects.toThrow('Error 3')

    expect(transporterMock.sendMail).toHaveBeenCalledTimes(3)
    expect(logWarn).toHaveBeenCalledTimes(2)
    expect(logError).toHaveBeenCalledTimes(1)
  })

  it('should include from address in email', async () => {
    ;(transporterMock.sendMail as ReturnType<typeof vi.fn>).mockResolvedValueOnce('success')

    await sendEmail(mockEmailOptions)

    expect(transporterMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining('bizcocho.art'),
      })
    )
  })
})

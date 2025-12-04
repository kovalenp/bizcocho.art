import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { Resend } from 'resend'
import { logError, logWarn, logInfo } from './logger'

// Discriminated union for type-safe transport handling
type EmailTransport =
  | { type: 'nodemailer'; transporter: Transporter }
  | { type: 'resend'; client: Resend }

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

let cachedTransport: EmailTransport | null = null

/**
 * Creates or returns cached email transport based on environment.
 */
function getTransport(): EmailTransport {
  if (cachedTransport) {
    return cachedTransport
  }

  const isDev = process.env.NODE_ENV !== 'production'

  if (isDev) {
    // Development: Mailpit
    logInfo('Using Mailpit SMTP transport for development')
    cachedTransport = {
      type: 'nodemailer',
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '1025', 10),
        secure: false,
      }),
    }
    return cachedTransport
  }

  // Production: Prefer Resend SDK for analytics
  if (process.env.RESEND_API_KEY) {
    logInfo('Using Resend SDK transport for production')
    cachedTransport = {
      type: 'resend',
      client: new Resend(process.env.RESEND_API_KEY),
    }
    return cachedTransport
  }

  // Fallback: SMTP (works with Resend SMTP or other providers)
  logInfo('Using SMTP transport for production')
  cachedTransport = {
    type: 'nodemailer',
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: true,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    }),
  }
  return cachedTransport
}

/**
 * Get the "from" address for emails.
 */
function getFromAddress(): string {
  return process.env.SMTP_FROM || '"bizcocho.art" <hola@bizcocho.art>'
}

/**
 * Get the "reply-to" address (extracts email from from address).
 */
function getReplyToAddress(): string {
  const from = getFromAddress()
  const match = from.match(/<(.+)>/)
  return match ? match[1] : from
}

/**
 * Send an email with retry logic.
 * Retries 3 times with exponential backoff (1s, 2s, 4s).
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const maxRetries = 3
  let attempt = 0
  const from = getFromAddress()
  const replyTo = getReplyToAddress()

  while (attempt < maxRetries) {
    try {
      const transport = getTransport()

      if (transport.type === 'resend') {
        await transport.client.emails.send({
          from,
          replyTo,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        })
      } else {
        await transport.transporter.sendMail({
          from,
          replyTo,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        })
      }
      return
    } catch (error) {
      attempt++
      const isLastAttempt = attempt === maxRetries
      const delay = 1000 * Math.pow(2, attempt - 1)

      if (isLastAttempt) {
        logError('Failed to send email after retries', error, {
          to: options.to,
          subject: options.subject,
          attempt,
        })
        throw error
      } else {
        logWarn(`Email send failed, retrying in ${delay}ms...`, {
          attempt,
          error: error instanceof Error ? error.message : error,
        })
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
}

/**
 * Reset the cached transport (useful for testing).
 */
export function resetTransport(): void {
  cachedTransport = null
}

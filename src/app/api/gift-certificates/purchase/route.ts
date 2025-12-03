import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { generateCode } from '@/lib/gift-codes'
import { logError, logInfo } from '@/lib/logger'
import { getMessages } from '@/i18n/messages'
import type { Locale } from '@/i18n/config'
import { encodeGiftCertificateMetadata } from '@/lib/stripe-metadata'

// Preset amounts in cents
const PRESET_AMOUNTS = [2500, 5000, 10000] // 25€, 50€, 100€
const MIN_CUSTOM_AMOUNT = 1000 // 10€
const MAX_CUSTOM_AMOUNT = 50000 // 500€

type PurchaseRequestBody = {
  amountCents: number
  // Flat fields from the form
  purchaserName: string
  purchaserEmail: string
  recipientName: string
  recipientEmail: string
  personalMessage?: string
  locale?: 'en' | 'es'
}

function validateAmount(amountCents: number): boolean {
  // Check if it's a preset amount
  if (PRESET_AMOUNTS.includes(amountCents)) {
    return true
  }
  // Check if it's a valid custom amount
  return amountCents >= MIN_CUSTOM_AMOUNT && amountCents <= MAX_CUSTOM_AMOUNT
}

export async function POST(request: NextRequest) {
  const stripe = getStripe()

  try {
    const body: PurchaseRequestBody = await request.json()
    const { amountCents, purchaserName, purchaserEmail, recipientName, recipientEmail, personalMessage, locale = 'en' } = body

    // Validate required fields
    if (!amountCents || !purchaserName || !purchaserEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!recipientEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
    }

    // Parse purchaser name into first and last name
    const nameParts = purchaserName.trim().split(/\s+/)
    const purchaserFirstName = nameParts[0] || ''
    const purchaserLastName = nameParts.slice(1).join(' ') || ''

    // Validate amount
    if (!validateAmount(amountCents)) {
      return NextResponse.json(
        { error: `Invalid amount. Must be 25€, 50€, 100€, or a custom amount between ${MIN_CUSTOM_AMOUNT / 100}€ and ${MAX_CUSTOM_AMOUNT / 100}€` },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Generate unique code
    const code = generateCode()

    // Calculate expiration (12 months from now)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    // Create pending gift certificate
    const giftCertificate = await payload.create({
      collection: 'gift-certificates',
      data: {
        code,
        type: 'gift',
        status: 'pending',
        initialValueCents: amountCents,
        currentBalanceCents: amountCents,
        currency: 'eur',
        expiresAt: expiresAt.toISOString(),
        purchaser: {
          email: purchaserEmail,
          firstName: purchaserFirstName,
          lastName: purchaserLastName,
          phone: '',
        },
        recipient: {
          email: recipientEmail,
          name: recipientName || '',
          personalMessage: personalMessage || '',
        },
      },
    })

    logInfo('Gift certificate created (pending)', {
      id: giftCertificate.id,
      code,
      amountCents,
      purchaserEmail,
      recipientEmail,
    })

    // Format amount for display
    const formattedAmount = (amountCents / 100).toFixed(2)

    // Get localized messages
    const messages = getMessages(locale as Locale)

    // Build typed metadata
    const metadata = encodeGiftCertificateMetadata({
      giftCertificateId: giftCertificate.id,
      code,
      amountCents,
      purchaserEmail,
      purchaserFirstName,
      purchaserLastName,
      recipientEmail,
      recipientName: recipientName || undefined,
      locale: locale as 'en' | 'es',
    })

    // Create Stripe Checkout Session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: messages.giftCertificates.productName,
              description: `${formattedAmount}€ ${messages.giftCertificates.productName.toLowerCase()} - ${recipientName || recipientEmail}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.SITE_URL}/${locale}/gift-certificates/success?session_id={CHECKOUT_SESSION_ID}&code=${code}`,
      cancel_url: `${process.env.SITE_URL}/${locale}/gift-certificates?cancelled=true`,
      customer_email: purchaserEmail,
      metadata,
    })

    // Update gift certificate with Stripe session ID
    await payload.update({
      collection: 'gift-certificates',
      id: giftCertificate.id,
      data: {
        stripePaymentIntentId: stripeSession.id,
      },
    })

    return NextResponse.json({
      success: true,
      checkoutUrl: stripeSession.url,
      giftCertificateId: giftCertificate.id,
    })
  } catch (error) {
    logError('Gift certificate purchase failed', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create gift certificate purchase', details: errorMessage },
      { status: 500 }
    )
  }
}

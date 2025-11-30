import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { createPaymentService } from '@/services/payment'
import { logError } from '@/lib/logger'

// Disable body parsing to get raw body for webhook signature verification
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    logError('STRIPE_WEBHOOK_SECRET not configured', new Error('Missing webhook secret'))
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  try {
    // Get raw body as buffer for signature verification
    const buf = await request.arrayBuffer()
    const body = Buffer.from(buf).toString('utf8')
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      logError('Missing stripe-signature header', new Error('Missing signature'))
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })
    const paymentService = createPaymentService(payload)

    // Verify signature
    const event = paymentService.verifyWebhookSignature(body, signature, webhookSecret)
    if (!event) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Handle the event
    const result = await paymentService.handleWebhook(event)

    if (!result.success) {
      // Check if it's a non-critical error or ignore action
      if (result.action === 'ignored') {
        return NextResponse.json({ received: true }, { status: 200 })
      }

      return NextResponse.json(
        { error: result.error || 'Webhook handler failed' },
        { status: 500 }
      )
    }

    // Notifications are sent via Payload collection hooks (afterChange)
    // when booking/gift-certificate status changes to confirmed/active

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    logError('Webhook processing failed', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

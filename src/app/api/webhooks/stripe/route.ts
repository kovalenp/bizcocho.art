import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { sendBookingConfirmationEmail } from '@/lib/email'

// Disable body parsing to get raw body for webhook signature verification
export const runtime = 'nodejs'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  })
}

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
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
      console.error('Missing stripe-signature header')
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      console.log('✅ Webhook signature verified:', event.type)
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Extract booking metadata
        const bookingId = session.metadata?.bookingId
        const classSessionId = session.metadata?.classSessionId

        if (!bookingId) {
          console.error('No booking ID in session metadata')
          return NextResponse.json(
            { error: 'Missing booking ID' },
            { status: 400 }
          )
        }

        // Update booking to confirmed and paid
        const booking = await payload.update({
          collection: 'bookings',
          id: parseInt(bookingId, 10),
          data: {
            status: 'confirmed',
            paymentStatus: 'paid',
            stripePaymentIntentId: session.payment_intent as string,
          },
        })

        // Get class session details for email
        const classSessionDoc = await payload.findByID({
          collection: 'class-sessions',
          id: classSessionId!,
          depth: 2,
        })

        // Send confirmation email
        try {
          await sendBookingConfirmationEmail({
            booking,
            classSession: classSessionDoc,
            locale: 'en', // TODO: Get from session metadata or booking
          })
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError)
          // Don't fail the webhook if email fails
        }

        console.log('Booking confirmed:', bookingId)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session

        const bookingId = session.metadata?.bookingId
        const classSessionId = session.metadata?.classSessionId
        const numberOfPeople = parseInt(session.metadata?.numberOfPeople || '0', 10)

        if (!bookingId || !classSessionId) {
          console.error('Missing booking or session ID in expired session')
          return NextResponse.json({ received: true }, { status: 200 })
        }

        // Delete the booking
        await payload.delete({
          collection: 'bookings',
          id: parseInt(bookingId, 10),
        })

        // Restore available spots
        const classSessionDoc = await payload.findByID({
          collection: 'class-sessions',
          id: classSessionId,
        })

        if (classSessionDoc) {
          const currentSpots = classSessionDoc.availableSpots || 0
          await payload.update({
            collection: 'class-sessions',
            id: classSessionId,
            data: {
              availableSpots: currentSpots + numberOfPeople,
            },
          })
        }

        console.log('Expired session, booking deleted and spots restored:', bookingId)
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

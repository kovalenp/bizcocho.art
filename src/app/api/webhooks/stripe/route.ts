import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { sendBookingConfirmationEmail, sendCourseConfirmationEmail } from '@/lib/email'
import { logError, logInfo, logDebug } from '@/lib/logger'

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

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      logDebug('Webhook signature verified', { eventType: event.type })
    } catch (err) {
      logError('Webhook signature verification failed', err)
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
        const bookingType = (session.metadata?.bookingType || 'class') as 'class' | 'course'
        const classId = session.metadata?.classId
        const sessionIds = session.metadata?.sessionIds // comma-separated
        const locale = (session.metadata?.locale as 'en' | 'es') || 'en'

        if (!bookingId) {
          logError('No booking ID in session metadata', new Error('Missing booking ID'))
          return NextResponse.json(
            { error: 'Missing booking ID' },
            { status: 400 }
          )
        }

        // P1 FIX: Idempotency check - skip if already paid
        const existingBooking = await payload.findByID({
          collection: 'bookings',
          id: parseInt(bookingId, 10),
        })

        if (existingBooking?.paymentStatus === 'paid') {
          logInfo('Booking already paid, skipping duplicate webhook', { bookingId })
          return NextResponse.json({ received: true }, { status: 200 })
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

        // Send confirmation email based on booking type
        try {
          if (!classId) {
            logError('Missing classId in metadata', new Error('Missing classId'), { bookingId })
          } else {
            const classIdNum = parseInt(classId, 10)
            if (isNaN(classIdNum)) {
              logError('Invalid class ID in metadata', new Error('Invalid class ID'), { classId })
            } else {
              // Fetch the class
              const classDoc = await payload.findByID({
                collection: 'classes',
                id: classIdNum,
                depth: 1,
              })

              if (bookingType === 'course') {
                // Course enrollment - fetch all booked sessions
                const sessionIdNums = sessionIds
                  ? sessionIds.split(',').map((id) => parseInt(id, 10)).filter((id) => !isNaN(id))
                  : []

                const sessions = await payload.find({
                  collection: 'sessions',
                  where: { id: { in: sessionIdNums } },
                  sort: 'startDateTime',
                  limit: 100,
                })

                await sendCourseConfirmationEmail({
                  booking,
                  classDoc,
                  sessions: sessions.docs,
                  locale,
                })
              } else {
                // Single class booking - get first session
                const sessionIdNums = sessionIds
                  ? sessionIds.split(',').map((id) => parseInt(id, 10)).filter((id) => !isNaN(id))
                  : []

                if (sessionIdNums.length > 0) {
                  const sessionDoc = await payload.findByID({
                    collection: 'sessions',
                    id: sessionIdNums[0],
                    depth: 2,
                  })

                  await sendBookingConfirmationEmail({
                    booking,
                    session: sessionDoc,
                    locale,
                  })
                }
              }
            }
          }
        } catch (emailError) {
          logError('Failed to send confirmation email', emailError, { bookingId, bookingType })
          // Don't fail the webhook if email fails
        }

        logInfo('Booking confirmed', { bookingId, bookingType })
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session

        const bookingId = session.metadata?.bookingId
        const sessionIds = session.metadata?.sessionIds // comma-separated
        const numberOfPeople = parseInt(session.metadata?.numberOfPeople || '0', 10)

        if (!bookingId) {
          logError('Missing booking ID in expired session', new Error('Missing booking ID'))
          return NextResponse.json({ received: true }, { status: 200 })
        }

        // Check if booking exists (may have been already deleted)
        const existingBooking = await payload.findByID({
          collection: 'bookings',
          id: parseInt(bookingId, 10),
        }).catch(() => null)

        if (!existingBooking) {
          logInfo('Booking already deleted', { bookingId })
          return NextResponse.json({ received: true }, { status: 200 })
        }

        // Delete the booking
        await payload.delete({
          collection: 'bookings',
          id: parseInt(bookingId, 10),
        })

        // Restore available spots for all sessions (unified approach)
        if (sessionIds && numberOfPeople > 0) {
          const sessionIdNums = sessionIds
            .split(',')
            .map((id) => parseInt(id, 10))
            .filter((id) => !isNaN(id))

          if (sessionIdNums.length > 0) {
            const sessions = await payload.find({
              collection: 'sessions',
              where: { id: { in: sessionIdNums } },
              limit: 100,
            })

            const updatePromises = sessions.docs.map((sessionDoc) => {
              const currentSpots = sessionDoc.availableSpots || 0
              return payload.update({
                collection: 'sessions',
                id: sessionDoc.id,
                data: {
                  availableSpots: currentSpots + numberOfPeople,
                },
              })
            })

            await Promise.all(updatePromises)
            logInfo('Expired session, restored spots', {
              sessionsCount: sessions.docs.length,
              bookingId,
              numberOfPeople,
            })
          }
        }

        logInfo('Expired session, booking deleted', { bookingId })
        break
      }

      default:
        logDebug('Unhandled event type', { eventType: event.type })
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    logError('Webhook handler failed', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

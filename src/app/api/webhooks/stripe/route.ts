import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { sendBookingConfirmationEmail, sendCourseConfirmationEmail } from '@/lib/email'

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
      console.log('Webhook signature verified:', event.type)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
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
        const bookingType = session.metadata?.bookingType || 'class'
        const sessionId = session.metadata?.sessionId
        const courseId = session.metadata?.courseId
        const locale = (session.metadata?.locale as 'en' | 'es') || 'en'

        if (!bookingId) {
          console.error('No booking ID in session metadata')
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
          console.log('Booking already paid, skipping duplicate webhook:', bookingId)
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
          if (bookingType === 'course' && courseId) {
            // Parse courseId as number (comes from metadata as string)
            const courseIdNum = parseInt(courseId, 10)
            if (isNaN(courseIdNum)) {
              console.error('Invalid course ID in metadata:', courseId)
            } else {
              // Fetch course and sessions for email
              const course = await payload.findByID({
                collection: 'courses',
                id: courseIdNum,
                depth: 2,
              })

              const sessions = await payload.find({
                collection: 'sessions',
                where: {
                  course: { equals: courseIdNum },
                  status: { equals: 'scheduled' },
                },
                sort: 'startDateTime',
                limit: 100,
              })

              await sendCourseConfirmationEmail({
                booking,
                course,
                sessions: sessions.docs,
                locale,
              })
            }
          } else if (sessionId) {
            // Parse sessionId as number (comes from metadata as string)
            const sessionIdNum = parseInt(sessionId, 10)
            if (isNaN(sessionIdNum)) {
              console.error('Invalid session ID in metadata:', sessionId)
            } else {
              // Class booking - get session details for email
              const sessionDoc = await payload.findByID({
                collection: 'sessions',
                id: sessionIdNum,
                depth: 2,
              })

              await sendBookingConfirmationEmail({
                booking,
                session: sessionDoc,
                locale,
              })
            }
          }
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError)
          // Don't fail the webhook if email fails
        }

        console.log('Booking confirmed:', bookingId, 'type:', bookingType)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session

        const bookingId = session.metadata?.bookingId
        const bookingType = session.metadata?.bookingType || 'class'
        const sessionId = session.metadata?.sessionId
        const courseId = session.metadata?.courseId
        const numberOfPeople = parseInt(session.metadata?.numberOfPeople || '0', 10)

        if (!bookingId) {
          console.error('Missing booking ID in expired session')
          return NextResponse.json({ received: true }, { status: 200 })
        }

        // Check if booking exists (may have been already deleted)
        const existingBooking = await payload.findByID({
          collection: 'bookings',
          id: parseInt(bookingId, 10),
        }).catch(() => null)

        if (!existingBooking) {
          console.log('Booking already deleted:', bookingId)
          return NextResponse.json({ received: true }, { status: 200 })
        }

        // Delete the booking
        await payload.delete({
          collection: 'bookings',
          id: parseInt(bookingId, 10),
        })

        // Restore available spots based on booking type
        if (bookingType === 'course' && courseId) {
          const courseIdNum = parseInt(courseId, 10)
          if (!isNaN(courseIdNum)) {
            // Restore spots for all course sessions
            const sessions = await payload.find({
              collection: 'sessions',
              where: {
                course: { equals: courseIdNum },
              },
              limit: 100,
            })

            const updatePromises = sessions.docs.map(sessionDoc => {
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
            console.log('Expired course session, restored spots for', sessions.docs.length, 'sessions')
          }
        } else if (sessionId) {
          const sessionIdNum = parseInt(sessionId, 10)
          if (!isNaN(sessionIdNum)) {
            // Restore spots for single class session
            const sessionDoc = await payload.findByID({
              collection: 'sessions',
              id: sessionIdNum,
            }).catch(() => null)

            if (sessionDoc) {
              const currentSpots = sessionDoc.availableSpots || 0
              await payload.update({
                collection: 'sessions',
                id: sessionIdNum,
                data: {
                  availableSpots: currentSpots + numberOfPeople,
                },
              })
            }
          }
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

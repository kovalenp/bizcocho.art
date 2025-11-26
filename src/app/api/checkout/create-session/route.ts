import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logError } from '@/lib/logger'

type CheckoutRequestBody = {
  classId: string // Required: the class/course ID
  sessionId?: string // Optional: specific session for class-type bookings
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
  locale?: string
}

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
  try {
    const body: CheckoutRequestBody = await request.json()
    const { classId, sessionId, firstName, lastName, email, phone, numberOfPeople, locale = 'en' } = body

    // Validate required fields
    if (!classId || !firstName || !lastName || !email || !phone || !numberOfPeople) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const classIdNum = parseInt(classId, 10)
    if (isNaN(classIdNum)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Fetch the class
    const classDoc = await payload.findByID({
      collection: 'classes',
      id: classIdNum,
      depth: 1,
    })

    if (!classDoc) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    if (!classDoc.isPublished) {
      return NextResponse.json({ error: 'This offering is not available' }, { status: 400 })
    }

    // Determine which sessions to book based on class type
    let sessionsToBook: Array<{ id: number; availableSpots: number | null | undefined }>

    if (classDoc.type === 'course') {
      // Course: book ALL sessions
      const allSessions = await payload.find({
        collection: 'sessions',
        where: {
          class: { equals: classDoc.id },
          status: { equals: 'scheduled' },
        },
        limit: 100,
      })

      if (allSessions.docs.length === 0) {
        return NextResponse.json({ error: 'No sessions available for this course' }, { status: 400 })
      }

      sessionsToBook = allSessions.docs.map((s) => ({
        id: s.id,
        availableSpots: s.availableSpots,
      }))
    } else {
      // Class: book specific session (sessionId required)
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required for class bookings' }, { status: 400 })
      }

      const sessionIdNum = parseInt(sessionId, 10)
      if (isNaN(sessionIdNum)) {
        return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
      }

      const sessionDoc = await payload.findByID({
        collection: 'sessions',
        id: sessionIdNum,
        depth: 0,
      })

      if (!sessionDoc) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      if (sessionDoc.status === 'cancelled') {
        return NextResponse.json({ error: 'This session has been cancelled' }, { status: 400 })
      }

      // Verify session belongs to this class
      const sessionClassId = typeof sessionDoc.class === 'object' ? sessionDoc.class.id : sessionDoc.class
      if (sessionClassId !== classDoc.id) {
        return NextResponse.json({ error: 'Session does not belong to this class' }, { status: 400 })
      }

      sessionsToBook = [{ id: sessionDoc.id, availableSpots: sessionDoc.availableSpots }]
    }

    // Check capacity across all sessions to book
    const minAvailableSpots = Math.min(
      ...sessionsToBook.map((s) => s.availableSpots ?? classDoc.maxCapacity ?? 0)
    )

    if (numberOfPeople > minAvailableSpots) {
      return NextResponse.json({ error: 'Not enough capacity available' }, { status: 400 })
    }

    // Calculate total price
    const totalPriceCents = (classDoc.priceCents || 0) * numberOfPeople
    const currency = classDoc.currency || 'eur'

    // Reserve spots on all sessions
    const sessionIds = sessionsToBook.map((s) => s.id)
    const updatePromises = sessionsToBook.map((session) => {
      const currentSpots = session.availableSpots ?? classDoc.maxCapacity ?? 0
      return payload.update({
        collection: 'sessions',
        id: session.id,
        data: {
          availableSpots: currentSpots - numberOfPeople,
        },
      })
    })
    await Promise.all(updatePromises)

    // Verify no session went negative (race condition check)
    const verifiedSessions = await payload.find({
      collection: 'sessions',
      where: { id: { in: sessionIds } },
      limit: 100,
    })

    const hasNegativeSpots = verifiedSessions.docs.some(
      (s) => s.availableSpots != null && s.availableSpots < 0
    )

    if (hasNegativeSpots) {
      // Rollback: restore spots
      const rollbackPromises = verifiedSessions.docs.map((session) => {
        const currentSpots = session.availableSpots ?? 0
        return payload.update({
          collection: 'sessions',
          id: session.id,
          data: {
            availableSpots: currentSpots + numberOfPeople,
          },
        })
      })
      await Promise.all(rollbackPromises)

      return NextResponse.json({ error: 'Not enough capacity available - please try again' }, { status: 409 })
    }

    // Create booking with sessions array (expires in 10 minutes if unpaid)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const bookingType = classDoc.type // 'class' or 'course'

    let booking
    try {
      booking = await payload.create({
        collection: 'bookings',
        data: {
          bookingType,
          sessions: sessionIds,
          firstName,
          lastName,
          email,
          phone,
          numberOfPeople,
          status: 'pending',
          paymentStatus: 'unpaid',
          bookingDate: new Date().toISOString(),
          expiresAt,
        },
      })
    } catch (bookingError) {
      // Rollback spots if booking creation fails
      const rollbackPromises = verifiedSessions.docs.map((session) => {
        const currentSpots = session.availableSpots ?? 0
        return payload.update({
          collection: 'sessions',
          id: session.id,
          data: {
            availableSpots: currentSpots + numberOfPeople,
          },
        })
      })
      await Promise.all(rollbackPromises)
      throw bookingError
    }

    // Build Stripe description
    const classTitle = (classDoc.title as string) || 'Booking'
    let description: string

    if (bookingType === 'course') {
      description = `Full course enrollment - ${sessionsToBook.length} sessions, ${numberOfPeople} ${numberOfPeople === 1 ? 'person' : 'people'}`
    } else {
      // Single session - get date/time
      const firstSession = verifiedSessions.docs[0]
      const startDateTime = new Date(firstSession.startDateTime)
      const sessionDate = startDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const sessionTime = startDateTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
      description = `${sessionDate} at ${sessionTime} - ${numberOfPeople} ${numberOfPeople === 1 ? 'person' : 'people'}`
    }

    // Create Stripe Checkout Session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: classTitle,
              description,
            },
            unit_amount: totalPriceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.SITE_URL}/${locale}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/${locale}/booking/cancel?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: email,
      metadata: {
        bookingId: booking.id.toString(),
        bookingType,
        classId: classIdNum.toString(),
        sessionIds: sessionIds.join(','), // Store all session IDs
        firstName,
        lastName,
        phone,
        numberOfPeople: numberOfPeople.toString(),
        locale,
      },
    })

    // Update booking with Stripe session ID
    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: {
        stripePaymentIntentId: stripeSession.id,
      },
    })

    return NextResponse.json(
      {
        success: true,
        checkoutUrl: stripeSession.url,
        bookingId: booking.id,
      },
      { status: 200 }
    )
  } catch (error) {
    logError('Checkout session creation failed', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to create checkout session', details: errorMessage }, { status: 500 })
  }
}

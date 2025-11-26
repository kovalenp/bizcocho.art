import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

type CourseCheckoutRequestBody = {
  courseId: string
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
    const body: CourseCheckoutRequestBody = await request.json()
    const { courseId, firstName, lastName, email, phone, numberOfPeople, locale = 'en' } = body

    // Validate required fields
    if (!courseId || !firstName || !lastName || !email || !phone || !numberOfPeople) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Parse courseId as number (PostgreSQL uses numeric IDs)
    const courseIdNum = parseInt(courseId, 10)
    if (isNaN(courseIdNum)) {
      return NextResponse.json(
        { error: 'Invalid course ID' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Fetch the course
    const course = await payload.findByID({
      collection: 'courses',
      id: courseIdNum,
      depth: 1,
    })

    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      )
    }

    if (!course.isPublished) {
      return NextResponse.json(
        { error: 'Course is not available' },
        { status: 400 }
      )
    }

    // Fetch course sessions to check availability
    const sessions = await payload.find({
      collection: 'sessions',
      where: {
        course: { equals: course.id },
        status: { equals: 'scheduled' },
      },
      limit: 100,
    })

    if (sessions.docs.length === 0) {
      return NextResponse.json(
        { error: 'No sessions available for this course' },
        { status: 400 }
      )
    }

    // Check capacity across all sessions (use minimum available)
    const minAvailableSpots = Math.min(
      ...sessions.docs.map(s => s.availableSpots ?? course.maxCapacity ?? 0)
    )

    if (numberOfPeople > minAvailableSpots) {
      return NextResponse.json(
        { error: 'Not enough capacity available' },
        { status: 400 }
      )
    }

    // Calculate total price
    const totalPriceCents = (course.priceCents || 0) * numberOfPeople
    const currency = course.currency || 'eur'

    // P1 FIX: Atomic capacity reservation for course sessions
    // Decrement available spots on all course sessions first
    const updatePromises = sessions.docs.map(session => {
      const currentSpots = session.availableSpots ?? course.maxCapacity ?? 0
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
      where: {
        course: { equals: course.id },
        status: { equals: 'scheduled' },
      },
      limit: 100,
    })

    const hasNegativeSpots = verifiedSessions.docs.some(
      s => s.availableSpots != null && s.availableSpots < 0
    )

    if (hasNegativeSpots) {
      // Rollback: restore spots on all sessions
      const rollbackPromises = verifiedSessions.docs.map(session => {
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

      return NextResponse.json(
        { error: 'Not enough capacity available - please try again' },
        { status: 409 }
      )
    }

    // Create booking (pending payment)
    // Set expiration to 30 minutes (Stripe checkout session default timeout)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    let booking
    try {
      booking = await payload.create({
        collection: 'bookings',
        data: {
          bookingType: 'course',
          course: course.id,
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
      const rollbackPromises = verifiedSessions.docs.map(session => {
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

    // Format course info for Stripe
    const courseTitle = (course.title as string) || 'Course Enrollment'
    const sessionCount = sessions.docs.length

    // Create Stripe Checkout Session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: courseTitle,
              description: `Full course enrollment - ${sessionCount} sessions, ${numberOfPeople} ${numberOfPeople === 1 ? 'person' : 'people'}`,
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
        bookingType: 'course',
        courseId: courseIdNum.toString(),
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
    console.error('Course checkout session creation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: errorMessage },
      { status: 500 }
    )
  }
}

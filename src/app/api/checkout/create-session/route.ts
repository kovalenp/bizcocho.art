import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

type CheckoutRequestBody = {
  classSession: string
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
    const { classSession, firstName, lastName, email, phone, numberOfPeople, locale = 'en' } = body

    // Validate required fields
    if (!classSession || !firstName || !lastName || !email || !phone || !numberOfPeople) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Check if the class session exists
    const classSessionDoc = await payload.findByID({
      collection: 'class-sessions',
      id: classSession,
      depth: 2,
    })

    if (!classSessionDoc) {
      return NextResponse.json(
        { error: 'Class session not found' },
        { status: 404 }
      )
    }

    // Check if session is cancelled
    if (classSessionDoc.status === 'cancelled') {
      return NextResponse.json(
        { error: 'This class session has been cancelled' },
        { status: 400 }
      )
    }

    // Get the class template to determine max capacity and price
    const classTemplate = typeof classSessionDoc.classTemplate === 'object'
      ? classSessionDoc.classTemplate
      : await payload.findByID({
          collection: 'class-templates',
          id: typeof classSessionDoc.classTemplate === 'number'
            ? classSessionDoc.classTemplate
            : parseInt(classSessionDoc.classTemplate as string, 10),
        })

    // Get current available spots
    const currentAvailableSpots = classSessionDoc.availableSpots !== undefined && classSessionDoc.availableSpots !== null
      ? classSessionDoc.availableSpots
      : classTemplate.maxCapacity || 0

    // Check if there's enough capacity
    if (numberOfPeople > currentAvailableSpots) {
      return NextResponse.json(
        { error: 'Not enough capacity available' },
        { status: 400 }
      )
    }

    // Calculate total price (priceCents × numberOfPeople)
    const pricePerPersonCents = classTemplate.priceCents || 0
    const totalPriceCents = pricePerPersonCents * numberOfPeople
    const currency = classTemplate.currency || 'eur'

    // Create temporary booking (pending payment)
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        classSession: typeof classSession === 'string' ? parseInt(classSession, 10) : classSession,
        firstName,
        lastName,
        email,
        phone,
        numberOfPeople,
        status: 'pending',
        paymentStatus: 'unpaid',
        bookingDate: new Date().toISOString(),
      },
    })

    // Decrement available spots immediately (will be restored if payment fails)
    const newAvailableSpots = currentAvailableSpots - numberOfPeople

    await payload.update({
      collection: 'class-sessions',
      id: classSession,
      data: {
        availableSpots: Math.max(0, newAvailableSpots),
      },
    })

    // Format class session date and time for display
    const startDateTime = new Date(classSessionDoc.startDateTime)
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

    // Get class title (handle localized field)
    const classTitle = (classTemplate.title as string) || 'Class Booking'

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: classTitle,
              description: `${sessionDate} at ${sessionTime} - ${numberOfPeople} ${numberOfPeople === 1 ? 'person' : 'people'}`,
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
        classSessionId: classSession,
        firstName,
        lastName,
        phone,
        numberOfPeople: numberOfPeople.toString(),
      },
    })

    // Update booking with Stripe session ID
    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: {
        stripePaymentIntentId: session.id, // Store checkout session ID for now
      },
    })

    return NextResponse.json(
      {
        success: true,
        checkoutUrl: session.url,
        bookingId: booking.id,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Checkout session creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

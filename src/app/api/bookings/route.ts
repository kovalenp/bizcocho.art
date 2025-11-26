import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/logger'

type BookingRequestBody = {
  sessionId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
}

export async function POST(request: NextRequest) {
  try {
    const body: BookingRequestBody = await request.json()
    const { sessionId, firstName, lastName, email, phone, numberOfPeople } = body

    // Validate required fields
    if (!sessionId || !firstName || !lastName || !email || !phone || !numberOfPeople) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Check if the session exists
    const sessionDoc = await payload.findByID({
      collection: 'sessions',
      id: sessionId,
      depth: 2,
    })

    if (!sessionDoc) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Check if session is cancelled
    if (sessionDoc.status === 'cancelled') {
      return NextResponse.json(
        { error: 'This session has been cancelled' },
        { status: 400 }
      )
    }

    // Get the class to determine max capacity
    if (!sessionDoc.class) {
      return NextResponse.json(
        { error: 'Session has no associated class' },
        { status: 400 }
      )
    }

    const classDoc = typeof sessionDoc.class === 'object'
      ? sessionDoc.class
      : await payload.findByID({
          collection: 'classes',
          id: typeof sessionDoc.class === 'number' ? sessionDoc.class : parseInt(String(sessionDoc.class), 10),
        })

    // Get current available spots (use session's availableSpots if set, otherwise use class's maxCapacity)
    const currentAvailableSpots = sessionDoc.availableSpots !== undefined && sessionDoc.availableSpots !== null
      ? sessionDoc.availableSpots
      : classDoc.maxCapacity || 0

    // Check if there's enough capacity
    if (numberOfPeople > currentAvailableSpots) {
      return NextResponse.json(
        { error: 'Not enough capacity available' },
        { status: 400 }
      )
    }

    // Create the booking with sessions array (unified model)
    const parsedSessionId = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        bookingType: 'class',
        sessions: [parsedSessionId],
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

    // Update the session's available spots
    const newAvailableSpots = currentAvailableSpots - numberOfPeople

    await payload.update({
      collection: 'sessions',
      id: sessionId,
      data: {
        availableSpots: Math.max(0, newAvailableSpots),
      },
    })

    return NextResponse.json(
      {
        success: true,
        booking: {
          id: booking.id,
          email: booking.email,
        }
      },
      { status: 201 }
    )
  } catch (error) {
    logError('Failed to create booking', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}

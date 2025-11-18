import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

type BookingRequestBody = {
  classSession: string
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
}

export async function POST(request: NextRequest) {
  try {
    const body: BookingRequestBody = await request.json()
    const { classSession, firstName, lastName, email, phone, numberOfPeople } = body

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

    // Get the class template to determine max capacity
    const classTemplate = typeof classSessionDoc.classTemplate === 'object'
      ? classSessionDoc.classTemplate
      : await payload.findByID({
          collection: 'class-templates',
          id: typeof classSessionDoc.classTemplate === 'number' ? classSessionDoc.classTemplate : parseInt(classSessionDoc.classTemplate as string, 10),
        })

    // Get current available spots (use session's availableSpots if set, otherwise use template's maxCapacity)
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

    // Create the booking
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

    // Update the session's available spots
    const newAvailableSpots = currentAvailableSpots - numberOfPeople

    await payload.update({
      collection: 'class-sessions',
      id: classSession,
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
    console.error('Booking error:', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}

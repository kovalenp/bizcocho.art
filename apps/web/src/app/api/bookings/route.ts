import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

type BookingRequestBody = {
  classTemplate: string
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
}

export async function POST(request: NextRequest) {
  try {
    const body: BookingRequestBody = await request.json()
    const { classTemplate, firstName, lastName, email, phone, numberOfPeople } = body

    // Validate required fields
    if (!classTemplate || !firstName || !lastName || !email || !phone || !numberOfPeople) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Check if the class template exists
    const classTemplateDoc = await payload.findByID({
      collection: 'class-templates',
      id: classTemplate,
    })

    if (!classTemplateDoc) {
      return NextResponse.json(
        { error: 'Class template not found' },
        { status: 404 }
      )
    }

    // Get current available spots (use availableSpots if set, otherwise use maxCapacity)
    const currentAvailableSpots = classTemplateDoc.availableSpots !== undefined && classTemplateDoc.availableSpots !== null
      ? classTemplateDoc.availableSpots
      : classTemplateDoc.maxCapacity || 0

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
        classTemplate: typeof classTemplate === 'string' ? parseInt(classTemplate, 10) : classTemplate,
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

    // Update the available spots
    const newAvailableSpots = currentAvailableSpots - numberOfPeople

    await payload.update({
      collection: 'class-templates',
      id: classTemplate,
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

import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { createBookingService } from '@/services/booking'
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
    const bookingService = createBookingService(payload)

    const parsedSessionId = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId
    if (isNaN(parsedSessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    const result = await bookingService.createPendingBooking({
      bookingType: 'class', // Defaulting to class for single session booking
      sessionIds: [parsedSessionId],
      firstName,
      lastName,
      email,
      phone,
      numberOfPeople,
    })

    if (!result.success) {
      // Determine status code based on error message (heuristic)
      const status = result.error?.includes('not found') ? 404 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json(
      {
        success: true,
        booking: {
          id: result.booking?.id,
          email: result.booking?.email,
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

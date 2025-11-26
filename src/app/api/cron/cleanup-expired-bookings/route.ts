import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Cleanup expired pending bookings and restore session capacity.
 * This endpoint should be called by a cron job every 5-10 minutes.
 *
 * To secure this endpoint in production, add a secret token check:
 * - Set CRON_SECRET in environment variables
 * - Pass it as Authorization header or query parameter
 */
export async function POST(request: NextRequest) {
  // Optional: Verify cron secret for security
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const now = new Date().toISOString()

    // Find expired pending bookings
    const expiredBookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { status: { equals: 'pending' } },
          { paymentStatus: { equals: 'unpaid' } },
          { expiresAt: { less_than: now } },
        ],
      },
      limit: 100,
    })

    if (expiredBookings.docs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired bookings found',
        cleaned: 0,
      })
    }

    let cleanedCount = 0
    const errors: string[] = []

    for (const booking of expiredBookings.docs) {
      try {
        const numberOfPeople = booking.numberOfPeople || 1

        if (booking.bookingType === 'class' && booking.session) {
          // Restore spots for class session
          const sessionId = typeof booking.session === 'object' ? booking.session.id : booking.session
          const session = await payload.findByID({
            collection: 'sessions',
            id: sessionId,
          }).catch(() => null)

          if (session) {
            await payload.update({
              collection: 'sessions',
              id: sessionId,
              data: {
                availableSpots: (session.availableSpots || 0) + numberOfPeople,
              },
            })
          }
        } else if (booking.bookingType === 'course' && booking.course) {
          // Restore spots for all course sessions
          const courseId = typeof booking.course === 'object' ? booking.course.id : booking.course
          const sessions = await payload.find({
            collection: 'sessions',
            where: {
              course: { equals: courseId },
            },
            limit: 100,
          })

          const updatePromises = sessions.docs.map(session =>
            payload.update({
              collection: 'sessions',
              id: session.id,
              data: {
                availableSpots: (session.availableSpots || 0) + numberOfPeople,
              },
            })
          )

          await Promise.all(updatePromises)
        }

        // Delete the expired booking
        await payload.delete({
          collection: 'bookings',
          id: booking.id,
        })

        cleanedCount++
      } catch (error) {
        const errorMsg = `Failed to cleanup booking ${booking.id}: ${error}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    console.log(`Cleaned up ${cleanedCount} expired bookings`)

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired bookings`,
      cleaned: cleanedCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Cleanup cron error:', error)
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    )
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request)
}

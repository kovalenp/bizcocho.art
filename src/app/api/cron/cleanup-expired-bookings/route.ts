import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { logError, logInfo } from '@/lib/logger'

/**
 * Cleanup expired pending bookings and restore session capacity.
 * Bookings expire after 10 minutes if unpaid.
 * This endpoint should be called by a cron job every 5 minutes.
 *
 * Local testing: curl http://localhost:4321/api/cron/cleanup-expired-bookings
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

        // Get session IDs from the booking (unified approach for both class and course)
        const sessionIds = Array.isArray(booking.sessions)
          ? booking.sessions.map((s: { id: number } | number) => (typeof s === 'object' ? s.id : s))
          : []

        if (sessionIds.length > 0) {
          // Restore spots for all sessions in the booking
          const sessions = await payload.find({
            collection: 'sessions',
            where: { id: { in: sessionIds } },
            limit: 100,
          })

          const updatePromises = sessions.docs.map((session) =>
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
        const errorMsg = `Failed to cleanup booking ${booking.id}`
        logError(errorMsg, error, { bookingId: booking.id })
        errors.push(errorMsg)
      }
    }

    logInfo('Cleaned up expired bookings', { cleanedCount, errorCount: errors.length })

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired bookings`,
      cleaned: cleanedCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    logError('Cleanup cron failed', error)
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

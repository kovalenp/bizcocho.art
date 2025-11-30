import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { createBookingService } from '@/services/booking'
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
    const bookingService = createBookingService(payload)

    // Use BookingService to handle expired bookings (uses CapacityService internally)
    const result = await bookingService.handleExpiredBookings()

    if (result.processed === 0 && result.errors === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired bookings found',
        cleaned: 0,
      })
    }

    logInfo('Cleaned up expired bookings', { cleaned: result.processed, errors: result.errors })

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.processed} expired bookings`,
      cleaned: result.processed,
      errors: result.errors > 0 ? result.errors : undefined,
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

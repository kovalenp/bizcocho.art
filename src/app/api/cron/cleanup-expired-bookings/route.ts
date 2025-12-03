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
 * Requires CRON_SECRET environment variable for authentication.
 * Pass it as Authorization header: `Authorization: Bearer <CRON_SECRET>`
 *
 * Local testing: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:4321/api/cron/cleanup-expired-bookings
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (required)
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    logError('CRON_SECRET environment variable is not configured', new Error('Missing CRON_SECRET'))
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
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

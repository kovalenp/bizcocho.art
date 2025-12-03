import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutService, GiftOnlyCheckoutData } from '@/services/checkout'
import { logError } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body: GiftOnlyCheckoutData = await request.json()

    // Validate required fields
    if (
      !body.classId ||
      !body.sessionIds?.length ||
      !body.firstName ||
      !body.lastName ||
      !body.email ||
      !body.giftCode
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const checkoutService = createCheckoutService(payload)

    const result = await checkoutService.completeGiftOnlyCheckout(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      )
    }

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      redirectUrl: result.redirectUrl,
    })
  } catch (error) {
    logError('Gift-only checkout failed', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to complete gift-only checkout', details: errorMessage },
      { status: 500 }
    )
  }
}

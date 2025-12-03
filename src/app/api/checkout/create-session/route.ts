import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutService } from '@/services/checkout'
import { logError } from '@/lib/logger'

type CheckoutRequestBody = {
  classId: string
  sessionId?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
  locale?: string
  giftCode?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequestBody = await request.json()
    const {
      classId,
      sessionId,
      firstName,
      lastName,
      email,
      phone,
      numberOfPeople,
      locale = 'en',
      giftCode,
    } = body

    // Basic field validation
    if (!classId || !firstName || !lastName || !email || !phone || !numberOfPeople) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const classIdNum = parseInt(classId, 10)
    if (isNaN(classIdNum)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 })
    }

    const sessionIdNum = sessionId ? parseInt(sessionId, 10) : undefined
    if (sessionId && isNaN(sessionIdNum!)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const checkoutService = createCheckoutService(payload)

    const result = await checkoutService.initiateCheckout({
      classId: classIdNum,
      sessionId: sessionIdNum,
      customer: { firstName, lastName, email, phone },
      numberOfPeople,
      locale: locale as 'en' | 'es',
      giftCode,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      )
    }

    // Gift code covers full amount - return data for client to redirect
    if (result.giftOnlyCheckout && result.giftOnlyData) {
      return NextResponse.json({
        success: true,
        giftOnlyCheckout: true,
        redirectUrl: '/api/checkout/gift-only',
        checkoutData: result.giftOnlyData,
      })
    }

    // Normal Stripe checkout
    return NextResponse.json({
      success: true,
      checkoutUrl: result.checkoutUrl,
      bookingId: result.bookingId,
    })
  } catch (error) {
    logError('Checkout session creation failed', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: errorMessage },
      { status: 500 }
    )
  }
}

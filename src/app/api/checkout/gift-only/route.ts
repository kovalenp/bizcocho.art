import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { createGiftCertificateService } from '@/services/gift-certificates'
import { sendBookingConfirmationEmail, sendCourseConfirmationEmail } from '@/lib/email'
import { logError, logInfo } from '@/lib/logger'

type GiftOnlyCheckoutBody = {
  classId: number
  sessionIds: number[]
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
  locale: 'en' | 'es'
  giftCode: string
  giftDiscountCents: number
  totalPriceCents: number
  bookingType: 'class' | 'course'
}

export async function POST(request: NextRequest) {
  try {
    const body: GiftOnlyCheckoutBody = await request.json()
    const {
      classId,
      sessionIds,
      firstName,
      lastName,
      email,
      phone,
      numberOfPeople,
      locale = 'en',
      giftCode,
      giftDiscountCents,
      totalPriceCents,
      bookingType,
    } = body

    // Validate required fields
    if (!classId || !sessionIds?.length || !firstName || !lastName || !email || !giftCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const giftService = createGiftCertificateService(payload)

    // Re-validate the gift code
    const discountResult = await giftService.calculateDiscount(giftCode, totalPriceCents)

    if ('error' in discountResult) {
      return NextResponse.json({ error: discountResult.error }, { status: 400 })
    }

    // Verify it still covers the full amount
    if (discountResult.remainingToPayCents > 0) {
      return NextResponse.json({
        error: 'Gift code no longer covers the full amount. Please use regular checkout.',
      }, { status: 400 })
    }

    // Reserve spots on all sessions
    const sessions = await payload.find({
      collection: 'sessions',
      where: { id: { in: sessionIds } },
      limit: sessionIds.length,
    })

    if (sessions.docs.length !== sessionIds.length) {
      return NextResponse.json({ error: 'One or more sessions not found' }, { status: 404 })
    }

    // Fetch the class for email
    const classDoc = await payload.findByID({
      collection: 'classes',
      id: classId,
      depth: 1,
    })

    if (!classDoc) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    // Check capacity
    const minAvailableSpots = Math.min(
      ...sessions.docs.map((s) => s.availableSpots ?? classDoc.maxCapacity ?? 0)
    )

    if (numberOfPeople > minAvailableSpots) {
      return NextResponse.json({ error: 'Not enough capacity available' }, { status: 400 })
    }

    // Reserve spots
    const updatePromises = sessions.docs.map((session) => {
      const currentSpots = session.availableSpots ?? classDoc.maxCapacity ?? 0
      return payload.update({
        collection: 'sessions',
        id: session.id,
        data: { availableSpots: currentSpots - numberOfPeople },
      })
    })
    await Promise.all(updatePromises)

    // Verify no session went negative (race condition check)
    const verifiedSessions = await payload.find({
      collection: 'sessions',
      where: { id: { in: sessionIds } },
      limit: sessionIds.length,
    })

    const hasNegativeSpots = verifiedSessions.docs.some(
      (s) => s.availableSpots != null && s.availableSpots < 0
    )

    if (hasNegativeSpots) {
      // Rollback
      const rollbackPromises = verifiedSessions.docs.map((session) => {
        const currentSpots = session.availableSpots ?? 0
        return payload.update({
          collection: 'sessions',
          id: session.id,
          data: { availableSpots: currentSpots + numberOfPeople },
        })
      })
      await Promise.all(rollbackPromises)

      return NextResponse.json({ error: 'Not enough capacity available - please try again' }, { status: 409 })
    }

    // Create confirmed booking (no payment needed)
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        bookingType,
        sessions: sessionIds,
        firstName,
        lastName,
        email,
        phone,
        numberOfPeople,
        status: 'confirmed',
        paymentStatus: 'paid', // Paid via gift code
        bookingDate: new Date().toISOString(),
        giftCertificateCode: giftCode,
        giftCertificateAmountCents: giftDiscountCents,
        stripeAmountCents: 0, // No Stripe payment
        originalPriceCents: totalPriceCents,
      },
    })

    // Apply the gift code
    const applyResult = await giftService.applyCode({
      code: giftCode,
      bookingId: booking.id,
      amountCents: giftDiscountCents,
    })

    if (!applyResult.success) {
      logError('Failed to apply gift code after booking', new Error(applyResult.error || 'Unknown error'), {
        bookingId: booking.id,
        giftCode,
      })
      // Don't fail the booking - it's already created. Log and continue.
    }

    // Send confirmation email
    try {
      if (bookingType === 'course') {
        await sendCourseConfirmationEmail({
          booking,
          classDoc,
          sessions: verifiedSessions.docs,
          locale,
        })
      } else {
        const firstSession = verifiedSessions.docs[0]
        await sendBookingConfirmationEmail({
          booking,
          session: { ...firstSession, class: classDoc },
          locale,
        })
      }
    } catch (emailError) {
      logError('Failed to send confirmation email', emailError, { bookingId: booking.id })
      // Don't fail the booking if email fails
    }

    logInfo('Gift-only booking confirmed', {
      bookingId: booking.id,
      giftCode,
      giftDiscountCents,
      bookingType,
    })

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      redirectUrl: `/${locale}/booking/success?booking_id=${booking.id}`,
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

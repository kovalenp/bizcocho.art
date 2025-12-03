import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { createGiftCertificateService } from '@/services/gift-certificates'
import { createCapacityService } from '@/services/capacity'
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

    // Fetch the class for email
    const classDoc = await payload.findByID({
      collection: 'classes',
      id: classId,
      depth: 1,
    })

    if (!classDoc) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    // Reserve spots using CapacityService (handles verification and rollback)
    const capacityService = createCapacityService(payload)
    const reserveResult = await capacityService.reserveSpots(sessionIds, numberOfPeople)

    if (!reserveResult.success) {
      return NextResponse.json(
        { error: reserveResult.error || 'Not enough capacity available' },
        { status: 409 }
      )
    }

    // Reserve gift code (atomic decrement)
    const reserveCodeResult = await giftService.reserveCode(giftCode, giftDiscountCents)
    if (!reserveCodeResult.success) {
      await capacityService.releaseSpots(sessionIds, numberOfPeople)
      return NextResponse.json(
        { error: reserveCodeResult.error || 'Gift code validation failed' },
        { status: 409 }
      )
    }

    let booking
    try {
      // Create confirmed booking (no payment needed)
      booking = await payload.create({
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

      // Apply the gift code (log usage only, balance already reserved)
      const applyResult = await giftService.applyCode({
        code: giftCode,
        bookingId: booking.id,
        amountCents: giftDiscountCents,
        skipBalanceDeduction: true,
      })

      if (!applyResult.success) {
        logError('Failed to apply gift code after booking', new Error(applyResult.error || 'Unknown error'), {
          bookingId: booking.id,
          giftCode,
        })
        // Don't fail the booking - it's already created. Log and continue.
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
      // Rollback: release capacity and gift code on failure
      await capacityService.releaseSpots(sessionIds, numberOfPeople)
      await giftService.releaseCode(giftCode, giftDiscountCents)

      logError('Gift-only checkout failed', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(
        { error: 'Failed to complete gift-only checkout', details: errorMessage },
        { status: 500 }
      )
    }
  } catch (error) {
    logError('Gift-only checkout failed (outer)', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to complete gift-only checkout', details: errorMessage },
      { status: 500 }
    )
  }
}

import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logError } from '@/lib/logger'
import { createGiftCertificateService } from '@/services/gift-certificates'
import { createCapacityService } from '@/services/capacity'

type CheckoutRequestBody = {
  classId: string // Required: the class/course ID
  sessionId?: string // Optional: specific session for class-type bookings
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
  locale?: string
  giftCode?: string // Optional: gift certificate or promo code
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  })
}

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  try {
    const body: CheckoutRequestBody = await request.json()
    const { classId, sessionId, firstName, lastName, email, phone, numberOfPeople, locale = 'en', giftCode } = body

    // Validate required fields
    if (!classId || !firstName || !lastName || !email || !phone || !numberOfPeople) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const classIdNum = parseInt(classId, 10)
    if (isNaN(classIdNum)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Fetch the class
    const classDoc = await payload.findByID({
      collection: 'classes',
      id: classIdNum,
      depth: 1,
    })

    if (!classDoc) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    if (!classDoc.isPublished) {
      return NextResponse.json({ error: 'This offering is not available' }, { status: 400 })
    }

    // Determine which sessions to book based on class type
    let sessionsToBook: Array<{ id: number; availableSpots: number | null | undefined }>

    if (classDoc.type === 'course') {
      // Course: book ALL sessions
      const allSessions = await payload.find({
        collection: 'sessions',
        where: {
          class: { equals: classDoc.id },
          status: { equals: 'scheduled' },
        },
        limit: 100,
      })

      if (allSessions.docs.length === 0) {
        return NextResponse.json({ error: 'No sessions available for this course' }, { status: 400 })
      }

      sessionsToBook = allSessions.docs.map((s) => ({
        id: s.id,
        availableSpots: s.availableSpots,
      }))
    } else {
      // Class: book specific session (sessionId required)
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required for class bookings' }, { status: 400 })
      }

      const sessionIdNum = parseInt(sessionId, 10)
      if (isNaN(sessionIdNum)) {
        return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
      }

      const sessionDoc = await payload.findByID({
        collection: 'sessions',
        id: sessionIdNum,
        depth: 0,
      })

      if (!sessionDoc) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      if (sessionDoc.status === 'cancelled') {
        return NextResponse.json({ error: 'This session has been cancelled' }, { status: 400 })
      }

      // Verify session belongs to this class
      const sessionClassId = typeof sessionDoc.class === 'object' ? sessionDoc.class.id : sessionDoc.class
      if (sessionClassId !== classDoc.id) {
        return NextResponse.json({ error: 'Session does not belong to this class' }, { status: 400 })
      }

      sessionsToBook = [{ id: sessionDoc.id, availableSpots: sessionDoc.availableSpots }]
    }

    // Calculate total price
    const totalPriceCents = (classDoc.priceCents || 0) * numberOfPeople
    const currency = classDoc.currency || 'eur'

    // Handle gift code discount
    let giftDiscountCents = 0
    let amountToChargeCents = totalPriceCents
    let giftService

    if (giftCode) {
      giftService = createGiftCertificateService(payload)
      const discountResult = await giftService.calculateDiscount(giftCode, totalPriceCents)

      if ('error' in discountResult) {
        return NextResponse.json({ error: discountResult.error }, { status: 400 })
      }

      giftDiscountCents = discountResult.discountCents
      amountToChargeCents = discountResult.remainingToPayCents
    }

    // If gift code covers full amount, redirect to gift-only checkout
    // Return early BEFORE reserving spots to avoid double-reservation (gift-only endpoint reserves them)
    const bookingType = classDoc.type // 'class' or 'course'
    
    if (giftCode && amountToChargeCents === 0) {
      return NextResponse.json({
        success: true,
        giftOnlyCheckout: true,
        redirectUrl: `/api/checkout/gift-only`,
        checkoutData: {
          classId: classIdNum,
          sessionIds: sessionsToBook.map((s) => s.id),
          firstName,
          lastName,
          email,
          phone,
          numberOfPeople,
          locale,
          giftCode,
          giftDiscountCents,
          totalPriceCents,
          bookingType,
        },
      })
    }

    // Reserve spots using CapacityService (handles verification and rollback)
    const sessionIds = sessionsToBook.map((s) => s.id)
    const capacityService = createCapacityService(payload)
    const reserveResult = await capacityService.reserveSpots(sessionIds, numberOfPeople)

    if (!reserveResult.success) {
      return NextResponse.json(
        { error: reserveResult.error || 'Not enough capacity available' },
        { status: 409 }
      )
    }
    
    // Reserve gift code (atomic decrement)
    if (giftCode && giftService && giftDiscountCents > 0) {
      const reserveCodeResult = await giftService.reserveCode(giftCode, giftDiscountCents)
      if (!reserveCodeResult.success) {
        // Rollback capacity if gift code reservation fails
        await capacityService.releaseSpots(sessionIds, numberOfPeople)
        return NextResponse.json(
          { error: reserveCodeResult.error || 'Gift code validation failed' },
          { status: 409 }
        )
      }
    }

    // Create booking with sessions array (expires in 10 minutes if unpaid)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    let booking
    try {
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
          status: 'pending',
          paymentStatus: 'unpaid',
          bookingDate: new Date().toISOString(),
          expiresAt,
          // Gift code info
          giftCertificateCode: giftCode || undefined,
          giftCertificateAmountCents: giftDiscountCents || undefined,
          originalPriceCents: totalPriceCents,
        },
      })
    } catch (bookingError) {
      // Rollback spots and gift code if booking creation fails
      await capacityService.releaseSpots(sessionIds, numberOfPeople)
      
      if (giftCode && giftService && giftDiscountCents > 0) {
        await giftService.releaseCode(giftCode, giftDiscountCents)
      }
      throw bookingError
    }

    // Fetch sessions for description building
    const bookedSessions = await payload.find({
      collection: 'sessions',
      where: { id: { in: sessionIds } },
      limit: sessionIds.length,
    })

    // Build Stripe description
    const classTitle = (classDoc.title as string) || 'Booking'
    let description: string

    if (bookingType === 'course') {
      description = `Full course enrollment - ${sessionsToBook.length} sessions, ${numberOfPeople} ${numberOfPeople === 1 ? 'person' : 'people'}`
    } else {
      // Single session - get date/time
      const firstSession = bookedSessions.docs[0]
      const startDateTime = new Date(firstSession.startDateTime)
      const sessionDate = startDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const sessionTime = startDateTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
      description = `${sessionDate} at ${sessionTime} - ${numberOfPeople} ${numberOfPeople === 1 ? 'person' : 'people'}`
    }

    // Build Stripe line item description with discount info
    let stripeDescription = description
    if (giftDiscountCents > 0) {
      const discountFormatted = (giftDiscountCents / 100).toFixed(2)
      stripeDescription += locale === 'es'
        ? ` (Descuento aplicado: €${discountFormatted})`
        : ` (Discount applied: €${discountFormatted})`
    }

    // Create Stripe Checkout Session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: classTitle,
              description: stripeDescription,
            },
            unit_amount: amountToChargeCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.SITE_URL}/${locale}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/${locale}/booking/cancel?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: email,
      metadata: {
        bookingId: booking.id.toString(),
        bookingType,
        classId: classIdNum.toString(),
        sessionIds: sessionIds.join(','), // Store all session IDs
        firstName,
        lastName,
        phone,
        numberOfPeople: numberOfPeople.toString(),
        locale,
        // Gift code info
        giftCode: giftCode || '',
        giftDiscountCents: giftDiscountCents.toString(),
        originalPriceCents: totalPriceCents.toString(),
      },
    })

    // Update booking with Stripe session ID
    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: {
        stripePaymentIntentId: stripeSession.id,
      },
    })

    return NextResponse.json(
      {
        success: true,
        checkoutUrl: stripeSession.url,
        bookingId: booking.id,
      },
      { status: 200 }
    )
  } catch (error) {
    logError('Checkout session creation failed', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to create checkout session', details: errorMessage }, { status: 500 })
  }
}

import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { createGiftCertificateService } from '@/services/gift-certificates'
import { logError } from '@/lib/logger'

type ValidateRequestBody = {
  code: string
  totalCents?: number // Optional: if provided, calculates discount amount
}

export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequestBody = await request.json()
    const { code, totalCents } = body

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const giftService = createGiftCertificateService(payload)

    const validation = await giftService.validateCode(code)

    if (!validation.valid) {
      return NextResponse.json(
        { valid: false, error: validation.error },
        { status: 200 }
      )
    }

    // If totalCents provided, calculate discount
    if (totalCents !== undefined && totalCents > 0) {
      const discountResult = await giftService.calculateDiscount(code, totalCents)

      if ('error' in discountResult) {
        return NextResponse.json(
          { valid: false, error: discountResult.error },
          { status: 200 }
        )
      }

      return NextResponse.json({
        valid: true,
        type: validation.type,
        discountCents: discountResult.discountCents,
        remainingToPayCents: discountResult.remainingToPayCents,
        newGiftBalanceCents: discountResult.newGiftBalanceCents,
        // Include validation details
        currentBalanceCents: validation.currentBalanceCents,
        discountType: validation.discountType,
        discountValue: validation.discountValue,
        currency: validation.currency,
        expiresAt: validation.expiresAt,
      })
    }

    // Just validation without discount calculation
    return NextResponse.json({
      valid: true,
      type: validation.type,
      currentBalanceCents: validation.currentBalanceCents,
      discountType: validation.discountType,
      discountValue: validation.discountValue,
      currency: validation.currency,
      expiresAt: validation.expiresAt,
    })
  } catch (error) {
    logError('Gift code validation failed', error)
    return NextResponse.json(
      { error: 'Failed to validate code' },
      { status: 500 }
    )
  }
}

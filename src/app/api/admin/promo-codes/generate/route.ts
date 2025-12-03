import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { generateCode } from '@/lib/gift-codes'
import { logError, logInfo } from '@/lib/logger'

type GeneratePromoCodesBody = {
  count: number // 1-1000
  discountType: 'percentage' | 'fixed'
  discountValue: number // percentage (0-100) or cents
  maxUses?: number | null // null = unlimited
  expiresAt?: string // ISO date string
  notes?: string
}

const MAX_CODES_PER_REQUEST = 1000

export async function POST(request: NextRequest) {
  try {
    // Authenticate admin user
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: GeneratePromoCodesBody = await request.json()
    const { count, discountType, discountValue, maxUses, expiresAt, notes } = body

    // Validate required fields
    if (!count || !discountType || discountValue === undefined) {
      return NextResponse.json({ error: 'Missing required fields: count, discountType, discountValue' }, { status: 400 })
    }

    // Validate count
    if (count < 1 || count > MAX_CODES_PER_REQUEST) {
      return NextResponse.json({ error: `Count must be between 1 and ${MAX_CODES_PER_REQUEST}` }, { status: 400 })
    }

    // Validate discount type
    if (discountType !== 'percentage' && discountType !== 'fixed') {
      return NextResponse.json({ error: 'discountType must be "percentage" or "fixed"' }, { status: 400 })
    }

    // Validate discount value
    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return NextResponse.json({ error: 'Percentage discount must be between 0 and 100' }, { status: 400 })
    }

    if (discountType === 'fixed' && discountValue < 0) {
      return NextResponse.json({ error: 'Fixed discount must be a positive number (in cents)' }, { status: 400 })
    }

    // Generate codes
    const createdCodes: string[] = []
    const errors: string[] = []

    for (let i = 0; i < count; i++) {
      const code = generateCode()

      try {
        await payload.create({
          collection: 'gift-certificates',
          data: {
            code,
            type: 'promo',
            status: 'active',
            discountType,
            discountValue,
            maxUses: maxUses ?? null,
            currentUses: 0,
            expiresAt: expiresAt || null,
            notes: notes || `Bulk generated: ${new Date().toISOString()}`,
          },
        })

        createdCodes.push(code)
      } catch (_createError) {
        // Code collision - try again with a new code
        const retryCode = generateCode()
        try {
          await payload.create({
            collection: 'gift-certificates',
            data: {
              code: retryCode,
              type: 'promo',
              status: 'active',
              discountType,
              discountValue,
              maxUses: maxUses ?? null,
              currentUses: 0,
              expiresAt: expiresAt || null,
              notes: notes || `Bulk generated: ${new Date().toISOString()}`,
            },
          })

          createdCodes.push(retryCode)
        } catch (_retryError) {
          errors.push(`Failed to create code ${i + 1}`)
        }
      }
    }

    logInfo('Bulk promo codes generated', {
      requested: count,
      created: createdCodes.length,
      errors: errors.length,
      discountType,
      discountValue,
      maxUses,
    })

    return NextResponse.json({
      success: true,
      codes: createdCodes,
      created: createdCodes.length,
      requested: count,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    logError('Bulk promo code generation failed', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to generate promo codes', details: errorMessage },
      { status: 500 }
    )
  }
}

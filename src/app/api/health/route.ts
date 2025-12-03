import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { logError, logInfo } from '@/lib/logger'

export async function GET() {
  try {
    const payload = await getPayload({ config })

    // Attempt a simple database query to check connection health
    await payload.find({
      collection: 'users',
      limit: 1,
    })

    logInfo('Health check successful')
    return NextResponse.json({ status: 'ok', database: 'connected' }, { status: 200 })
  } catch (error) {
    logError('Health check failed', error)
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

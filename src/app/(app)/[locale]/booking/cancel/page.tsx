import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getStripe } from '@/lib/stripe'
import { createBookingService } from '@/services/booking'
import { logError } from '@/lib/logger'
import { getMessages } from '@/i18n/messages'
import type { Locale } from '@/i18n/config'

// Render at request time (DB not available during build)
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ session_id?: string }>
}

export default async function BookingCancelPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { session_id: sessionId } = await searchParams

  if (!sessionId) {
    redirect(`/${locale}`)
  }

  // Handle cleanup using BookingService (releases capacity + gift codes)
  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    const bookingId = session.metadata?.bookingId
    if (bookingId) {
      const payload = await getPayload({ config })
      const bookingService = createBookingService(payload)

      // Cancel booking - handles capacity release and gift code release
      await bookingService.cancelBooking(parseInt(bookingId, 10))
    }
  } catch (error) {
    logError('Error handling cancelled booking', error, { sessionId })
    // Continue to show the page even if cleanup fails
  }

  const messages = getMessages(locale as Locale)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 md:p-12">
        <div className="text-center">
          {/* Cancel Icon */}
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-yellow-100">
              <svg
                className="h-16 w-16 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Cancel Message */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {messages.cancel.title}
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            {messages.cancel.message}
          </p>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
            <h2 className="font-semibold text-blue-900 mb-2">
              {messages.cancel.tryAgainTitle}
            </h2>
            <p className="text-blue-800 text-sm">
              {messages.cancel.tryAgainMessage}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-center">
            <Link
              href={`/${locale}`}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
            >
              {messages.cancel.browseOfferings}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

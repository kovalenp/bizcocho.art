import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Stripe from 'stripe'

type PageProps = {
  searchParams: Promise<{ session_id?: string }>
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  })
}

export default async function BookingCancelPage({ searchParams }: PageProps) {
  const params = await searchParams
  const sessionId = params.session_id

  if (!sessionId) {
    redirect('/')
  }

  // Handle cleanup: delete booking and restore spots
  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.metadata) {
      const bookingId = session.metadata.bookingId
      const classSessionId = session.metadata.classSessionId
      const numberOfPeople = parseInt(session.metadata.numberOfPeople || '0', 10)

      if (bookingId && classSessionId) {
        const payload = await getPayload({ config })

        // Delete the booking
        await payload.delete({
          collection: 'bookings',
          id: parseInt(bookingId, 10),
        })

        // Restore available spots
        const classSessionDoc = await payload.findByID({
          collection: 'class-sessions',
          id: classSessionId,
        })

        if (classSessionDoc) {
          const currentSpots = classSessionDoc.availableSpots || 0
          await payload.update({
            collection: 'class-sessions',
            id: classSessionId,
            data: {
              availableSpots: currentSpots + numberOfPeople,
            },
          })
        }
      }
    }
  } catch (error) {
    console.error('Error handling cancelled booking:', error)
    // Continue to show the page even if cleanup fails
  }

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
            Booking Cancelled
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Your booking has been cancelled and no payment was processed. The class spots have been
            released back to availability.
          </p>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
            <h2 className="font-semibold text-blue-900 mb-2">Want to try again?</h2>
            <p className="text-blue-800 text-sm">
              If you changed your mind or encountered an issue, you can return to the class page
              and complete your booking. The session is still available.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/classes"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
            >
              Browse Classes
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

import type { Messages } from '@/i18n/messages'

type BookingStatusMessageProps = {
  status: 'loading' | 'success' | 'error'
  messages: Messages
}

/**
 * Component for displaying booking status messages (loading, success, error).
 */
export function BookingStatusMessage({ status, messages }: BookingStatusMessageProps) {
  if (status === 'loading') {
    return (
      <div className="p-8 bg-blue-50 border-2 border-blue-300 rounded-lg text-center">
        <div className="animate-spin text-6xl mb-4">⟳</div>
        <h3 className="text-2xl font-semibold text-blue-900 mb-2">
          {messages.booking.redirecting || 'Redirecting to payment...'}
        </h3>
        <p className="text-blue-800 text-lg">
          {messages.booking.pleaseWait || 'Please wait while we redirect you to secure checkout.'}
        </p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="p-8 bg-green-50 border-2 border-green-300 rounded-lg text-center">
        <div className="text-6xl mb-4">✓</div>
        <h3 className="text-2xl font-semibold text-green-900 mb-2">
          {messages.booking.successTitle}
        </h3>
        <p className="text-green-800 text-lg">{messages.booking.success}</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
        {messages.booking.error}
      </div>
    )
  }

  return null
}

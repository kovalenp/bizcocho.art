import type { CollectionConfig } from 'payload'
import type { Booking } from '../payload-types'
import { createBookingService } from '../services/booking'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'bookingType', 'sessions', 'numberOfPeople', 'status', 'paymentStatus'],
  },
  fields: [
    {
      name: 'bookingType',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Class Booking',
          value: 'class',
        },
        {
          label: 'Course Enrollment',
          value: 'course',
        },
      ],
      admin: {
        description: 'Type of booking: individual class session or full course enrollment',
        position: 'sidebar',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        description: 'User who made the booking (optional for guest bookings)',
      },
    },
    {
      name: 'firstName',
      type: 'text',
      required: true,
      admin: {
        description: 'First name of the person booking',
      },
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
      admin: {
        description: 'Last name of the person booking',
      },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      admin: {
        description: 'Email address for booking confirmation',
      },
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      admin: {
        description: 'Phone number for contact',
      },
    },
    {
      name: 'sessions',
      type: 'relationship',
      relationTo: 'sessions',
      hasMany: true,
      required: true,
      admin: {
        description: 'Sessions included in this booking (1 for class, multiple for course)',
      },
    },
    {
      name: 'numberOfPeople',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 1,
      admin: {
        description: 'Number of spots booked',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        {
          label: 'Pending',
          value: 'pending',
        },
        {
          label: 'Confirmed',
          value: 'confirmed',
        },
        {
          label: 'Cancelled',
          value: 'cancelled',
        },
        {
          label: 'Attended',
          value: 'attended',
        },
        {
          label: 'No-Show',
          value: 'no-show',
        },
      ],
    },
    {
      name: 'paymentStatus',
      type: 'select',
      required: true,
      defaultValue: 'unpaid',
      index: true,
      options: [
        {
          label: 'Unpaid',
          value: 'unpaid',
        },
        {
          label: 'Paid',
          value: 'paid',
        },
        {
          label: 'Refunded',
          value: 'refunded',
        },
        {
          label: 'Failed',
          value: 'failed',
        },
      ],
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      admin: {
        description: 'Stripe Payment Intent ID',
      },
    },
    {
      name: 'giftCertificateCode',
      type: 'text',
      admin: {
        description: 'Gift certificate or promo code used for this booking',
      },
    },
    {
      name: 'giftCertificateAmountCents',
      type: 'number',
      min: 0,
      admin: {
        description: 'Amount covered by gift certificate/promo code (in cents)',
      },
    },
    {
      name: 'stripeAmountCents',
      type: 'number',
      min: 0,
      admin: {
        description: 'Amount charged via Stripe (in cents)',
      },
    },
    {
      name: 'originalPriceCents',
      type: 'number',
      min: 0,
      admin: {
        description: 'Original total price before discounts (in cents)',
      },
    },
    {
      name: 'bookingDate',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      index: true,
      admin: {
        description: 'Expiration time for pending reservations (auto-cleaned up after this time)',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'checkedIn',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether the user has checked in for the class',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes or special requests',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation === 'create' || operation === 'update') {
          // Validation: Must have at least one session
          const sessions = data?.sessions
          if (!sessions || (Array.isArray(sessions) && sessions.length === 0)) {
            throw new Error('Booking must include at least one session')
          }

          // Auto-set bookingType based on first session's parent class type
          if (Array.isArray(sessions) && sessions.length > 0 && req?.payload) {
            const firstSessionId = typeof sessions[0] === 'object' ? sessions[0].id : sessions[0]

            try {
              const session = await req.payload.findByID({
                collection: 'sessions',
                id: firstSessionId,
                depth: 0,
              })

              if (session?.sessionType) {
                data.bookingType = session.sessionType // 'class' or 'course'
              }
            } catch {
              // Session lookup failed, keep existing bookingType
            }
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation, previousDoc }) => {
        // Only handle updates (capacity changes on status/numberOfPeople changes)
        if (operation !== 'update') {
          return doc
        }

        // Delegate to BookingService for capacity management
        const bookingService = createBookingService(req.payload)
        await bookingService.handleStatusChange(doc as Booking, previousDoc as Booking | null)

        return doc
      },
    ],
  },
}

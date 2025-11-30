import type { CollectionConfig } from 'payload'
import { logInfo } from '../lib/logger'

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
        const { payload } = req
        const numberOfPeople = doc.numberOfPeople

        // Get session IDs from the booking
        const sessionIds = Array.isArray(doc.sessions)
          ? doc.sessions.map((s: { id: number } | number) => (typeof s === 'object' ? s.id : s))
          : []

        if (sessionIds.length === 0) {
          return doc
        }

        // Determine capacity change
        // NOTE: The checkout API already reserves spots when creating the pending booking.
        // We only need to handle:
        // 1. Cancellation (restore spots)
        // 2. Number of people changes on confirmed bookings
        // We do NOT decrement on confirmation because checkout API already did that.
        let capacityChange = 0

        if (operation === 'update') {
          const wasConfirmed = previousDoc?.status === 'confirmed'
          const wasPending = previousDoc?.status === 'pending'
          const isConfirmed = doc.status === 'confirmed'
          const isCancelled = doc.status === 'cancelled'
          const previousPeople = previousDoc?.numberOfPeople || 0

          if ((wasConfirmed || wasPending) && isCancelled) {
            // Cancelled: restore capacity (spots were reserved at checkout)
            capacityChange = previousPeople
          } else if (wasConfirmed && isConfirmed && numberOfPeople !== previousPeople) {
            // Changed number of people on confirmed booking: adjust
            capacityChange = previousPeople - numberOfPeople
          }
          // Note: pending → confirmed does NOT change capacity because
          // the checkout API already reserved the spots
        }

        // Update all sessions in the booking
        if (capacityChange !== 0) {
          const sessions = await payload.find({
            collection: 'sessions',
            where: { id: { in: sessionIds } },
            limit: 100,
          })

          const updatePromises = sessions.docs.map((session) => {
            const currentSpots = session.availableSpots || 0
            const newSpots = currentSpots + capacityChange

            return payload.update({
              collection: 'sessions',
              id: session.id,
              data: {
                availableSpots: Math.max(0, newSpots),
              },
            })
          })

          await Promise.all(updatePromises)
          logInfo('Updated capacity for booking sessions', {
            bookingId: doc.id,
            bookingType: doc.bookingType,
            sessionsCount: sessions.docs.length,
            capacityChange,
          })
        }

        return doc
      },
    ],
  },
}

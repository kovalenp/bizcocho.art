import type { CollectionConfig } from 'payload'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'bookingType', 'session', 'course', 'numberOfPeople', 'status', 'paymentStatus'],
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
        description: 'Type of booking: individual class session or full course',
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
      name: 'session',
      type: 'relationship',
      relationTo: 'sessions',
      required: false,
      admin: {
        description: 'The specific session being booked (for class bookings)',
        condition: (data) => data.bookingType === 'class',
      },
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      required: false,
      admin: {
        description: 'The course being enrolled in (for course bookings)',
        condition: (data) => data.bookingType === 'course',
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
      index: true, // P3 FIX: Index for filtering by status
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
      index: true, // P3 FIX: Index for filtering by payment status
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
      index: true, // P3 FIX: Index for cleanup cron job queries
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
      async ({ data, operation }) => {
        // Validation: Must have either session OR course (not both, not neither)
        if (operation === 'create' || operation === 'update') {
          const hasSession = !!data?.session
          const hasCourse = !!data?.course

          if (!hasSession && !hasCourse) {
            throw new Error('Booking must be for either a session or a course')
          }

          if (hasSession && hasCourse) {
            throw new Error('Booking cannot be for both a session and a course')
          }

          // Auto-set bookingType based on relationships
          if (hasSession) {
            data.bookingType = 'class'
          } else if (hasCourse) {
            data.bookingType = 'course'
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation, previousDoc }) => {
        // Sync capacity across course sessions when course booking is created/updated
        if (doc.bookingType === 'course' && doc.course) {
          const { payload } = req
          const numberOfPeople = doc.numberOfPeople

          // Extract course ID (could be object or number)
          const courseId = typeof doc.course === 'object' ? doc.course.id : doc.course
          if (!courseId || (typeof courseId !== 'number' && isNaN(Number(courseId)))) {
            console.warn('Invalid course ID in booking:', doc.course)
            return doc
          }

          // Find all sessions for this course
          const sessions = await payload.find({
            collection: 'sessions',
            where: {
              course: {
                equals: typeof courseId === 'number' ? courseId : Number(courseId),
              },
            },
            limit: 100,
          })

          if (sessions.docs.length === 0) {
            console.warn(`No sessions found for course: ${doc.course}`)
            return doc
          }

          // Determine capacity change
          let capacityChange = 0

          if (operation === 'create' && doc.status === 'confirmed') {
            // New confirmed booking: reduce capacity
            capacityChange = -numberOfPeople
          } else if (operation === 'update') {
            const wasConfirmed = previousDoc?.status === 'confirmed'
            const isConfirmed = doc.status === 'confirmed'
            const previousPeople = previousDoc?.numberOfPeople || 0

            if (!wasConfirmed && isConfirmed) {
              // Just confirmed: reduce capacity
              capacityChange = -numberOfPeople
            } else if (wasConfirmed && !isConfirmed) {
              // Cancelled/changed from confirmed: restore capacity
              capacityChange = previousPeople
            } else if (wasConfirmed && isConfirmed && numberOfPeople !== previousPeople) {
              // Changed number of people: adjust
              capacityChange = previousPeople - numberOfPeople
            }
          }

          // Update all course sessions
          if (capacityChange !== 0) {
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
            console.log(
              `✅ Updated capacity for ${sessions.docs.length} course sessions (change: ${capacityChange})`
            )
          }
        }

        return doc
      },
    ],
  },
}

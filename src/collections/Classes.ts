import type { CollectionConfig } from 'payload'

export const Classes: CollectionConfig = {
  slug: 'classes',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'classType', 'instructor', 'priceCents', 'isPublished'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      localized: true,
    },
    {
      name: 'classType',
      type: 'select',
      required: true,
      defaultValue: 'one-time',
      options: [
        { label: 'One-Time Event', value: 'one-time' },
        { label: 'Recurring Class', value: 'recurring' },
      ],
      admin: {
        description: 'One-time: Create sessions manually. Recurring: Auto-generate sessions from schedule.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'instructor',
      type: 'relationship',
      relationTo: 'instructors',
      required: false,
    },
    {
      name: 'featuredImage',
      type: 'relationship',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'gallery',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      required: false,
    },
    {
      name: 'priceCents',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Price per person in cents (e.g., 4500 = €45.00)',
      },
    },
    {
      name: 'currency',
      type: 'select',
      defaultValue: 'eur',
      options: [
        { label: 'EUR (€)', value: 'eur' },
        { label: 'USD ($)', value: 'usd' },
      ],
    },
    {
      name: 'durationMinutes',
      type: 'number',
      required: true,
      defaultValue: 180,
      min: 15,
      admin: {
        description: 'Duration of the class in minutes',
      },
    },
    {
      name: 'maxCapacity',
      type: 'number',
      required: true,
      defaultValue: 8,
      min: 1,
      admin: {
        description: 'Maximum participants per session',
      },
    },
    {
      name: 'location',
      type: 'text',
      localized: true,
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
    // ========== SCHEDULE SECTION (only for recurring, after save) ==========
    {
      name: 'schedule',
      type: 'group',
      admin: {
        description: 'Configure automatic session generation for recurring classes.',
        condition: (data) => !!data?.id && data?.classType === 'recurring',
      },
      fields: [
        {
          name: 'startDate',
          type: 'date',
          admin: {
            description: 'First session date',
            date: { pickerAppearance: 'dayOnly' },
          },
        },
        {
          name: 'endDate',
          type: 'date',
          admin: {
            description: 'Last session date (leave empty for 3 months)',
            date: { pickerAppearance: 'dayOnly' },
          },
        },
        {
          name: 'recurrence',
          type: 'select',
          defaultValue: 'weekly',
          options: [
            { label: 'Weekly', value: 'weekly' },
            { label: 'Bi-weekly (every 2 weeks)', value: 'biweekly' },
            { label: 'Monthly (first occurrence)', value: 'monthly' },
          ],
        },
        {
          name: 'daysOfWeek',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Sunday', value: '0' },
            { label: 'Monday', value: '1' },
            { label: 'Tuesday', value: '2' },
            { label: 'Wednesday', value: '3' },
            { label: 'Thursday', value: '4' },
            { label: 'Friday', value: '5' },
            { label: 'Saturday', value: '6' },
          ],
        },
        {
          name: 'startTime',
          type: 'text',
          defaultValue: '18:00',
          admin: {
            description: 'Start time in HH:MM format',
          },
        },
        {
          name: 'timezone',
          type: 'text',
          defaultValue: 'Europe/Madrid',
        },
      ],
    },
    // ========== SESSIONS TAB ==========
    {
      name: 'sessions',
      type: 'join',
      collection: 'sessions',
      on: 'class',
      admin: {
        description: 'Sessions for this class',
        condition: (data) => !!data?.id,
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, req, operation, previousDoc }) => {
        const { payload } = req
        const classDoc = doc

        // Skip on create
        if (operation === 'create') {
          return doc
        }

        // Only generate sessions for recurring classes
        if (classDoc.classType !== 'recurring') {
          return doc
        }

        const schedule = classDoc.schedule
        if (!schedule?.startDate || !schedule?.daysOfWeek?.length || !schedule?.startTime) {
          return doc // Schedule not configured yet
        }

        // Check if schedule changed
        const scheduleChanged =
          !previousDoc?.schedule ||
          previousDoc.schedule.startDate !== schedule.startDate ||
          previousDoc.schedule.endDate !== schedule.endDate ||
          previousDoc.schedule.recurrence !== schedule.recurrence ||
          JSON.stringify(previousDoc.schedule.daysOfWeek) !== JSON.stringify(schedule.daysOfWeek) ||
          previousDoc.schedule.startTime !== schedule.startTime ||
          previousDoc.schedule.timezone !== schedule.timezone ||
          previousDoc.durationMinutes !== classDoc.durationMinutes ||
          previousDoc.maxCapacity !== classDoc.maxCapacity ||
          previousDoc.classType !== classDoc.classType

        if (!scheduleChanged) {
          return doc
        }

        console.log(`Schedule changed, regenerating sessions for class: ${classDoc.title}`)

        // Default end date to 3 months from start if not specified
        const start = new Date(schedule.startDate)
        const end = schedule.endDate
          ? new Date(schedule.endDate)
          : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000)

        const daysSet = new Set(schedule.daysOfWeek.map((d: string) => parseInt(d, 10)))
        const recurrence = schedule.recurrence || 'weekly'

        // Generate session dates
        const sessionDates: Date[] = []
        const current = new Date(start)
        let weekCount = 0
        let lastWeekNumber = -1

        while (current <= end) {
          const dayOfWeek = current.getDay()
          const weekNumber = Math.floor((current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))

          if (weekNumber !== lastWeekNumber) {
            if (lastWeekNumber !== -1) weekCount++
            lastWeekNumber = weekNumber
          }

          let shouldInclude = false
          if (daysSet.has(dayOfWeek)) {
            if (recurrence === 'weekly') {
              shouldInclude = true
            } else if (recurrence === 'biweekly') {
              shouldInclude = weekCount % 2 === 0
            } else if (recurrence === 'monthly') {
              // First occurrence of this day in each month
              const firstOfMonth = new Date(current.getFullYear(), current.getMonth(), 1)
              const firstOccurrence = new Date(firstOfMonth)
              while (firstOccurrence.getDay() !== dayOfWeek) {
                firstOccurrence.setDate(firstOccurrence.getDate() + 1)
              }
              shouldInclude = current.getDate() === firstOccurrence.getDate()
            }
          }

          if (shouldInclude) {
            sessionDates.push(new Date(current))
          }
          current.setDate(current.getDate() + 1)
        }

        if (sessionDates.length === 0) {
          console.log('No session dates generated - check schedule configuration')
          return doc
        }

        // Delete existing sessions
        await payload.delete({
          collection: 'sessions',
          where: { class: { equals: classDoc.id } },
          req,
        })

        // Parse start time
        const [hours, minutes] = (schedule.startTime || '18:00').split(':').map((n: string) => parseInt(n, 10))

        // Create sessions sequentially
        for (const date of sessionDates) {
          const startDateTime = new Date(date)
          startDateTime.setHours(hours, minutes, 0, 0)

          await payload.create({
            collection: 'sessions',
            data: {
              sessionType: 'class',
              class: classDoc.id,
              startDateTime: startDateTime.toISOString(),
              timezone: schedule.timezone || 'Europe/Madrid',
              status: 'scheduled',
              availableSpots: classDoc.maxCapacity,
            },
            req,
          })
        }
        console.log(`Generated ${sessionDates.length} sessions for class: ${classDoc.title}`)

        return doc
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const { payload } = req

        // Check for bookings
        const sessions = await payload.find({
          collection: 'sessions',
          where: { class: { equals: id } },
          limit: 100,
        })

        for (const session of sessions.docs) {
          const bookings = await payload.find({
            collection: 'bookings',
            where: { session: { equals: session.id } },
            limit: 1,
          })

          if (bookings.totalDocs > 0) {
            throw new Error('Cannot delete class with existing bookings')
          }
        }

        // Delete all sessions
        await payload.delete({
          collection: 'sessions',
          where: { class: { equals: id } },
        })

        return true
      },
    ],
  },
}

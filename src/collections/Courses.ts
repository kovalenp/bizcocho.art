import type { CollectionConfig } from 'payload'

export const Courses: CollectionConfig = {
  slug: 'courses',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'instructor', 'priceCents', 'maxCapacity', 'isPublished'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
      admin: {
        description: 'Course name (e.g., "Watercolor Fundamentals - 4 Week Course")',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      localized: true,
      admin: {
        description: 'URL-friendly identifier',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Course description and what students will learn',
      },
    },
    {
      name: 'instructor',
      type: 'relationship',
      relationTo: 'instructors',
      required: false,
      admin: {
        description: 'Assigned instructor for this course',
      },
    },
    {
      name: 'featuredImage',
      type: 'relationship',
      relationTo: 'media',
      admin: {
        description: 'Main course image',
      },
    },
    {
      name: 'gallery',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      required: false,
      admin: {
        description: 'Additional course images',
      },
    },
    {
      name: 'priceCents',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Total price for entire course in cents (e.g., 18000 = €180.00)',
      },
    },
    {
      name: 'currency',
      type: 'select',
      required: true,
      defaultValue: 'eur',
      options: [
        { label: 'EUR (€)', value: 'eur' },
        { label: 'USD ($)', value: 'usd' },
      ],
    },
    {
      name: 'maxCapacity',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 10,
      admin: {
        description: 'Maximum participants (applies to ALL course sessions)',
      },
    },
    {
      name: 'durationMinutes',
      type: 'number',
      required: true,
      min: 15,
      admin: {
        description: 'Duration of each session in minutes',
      },
    },
    {
      name: 'location',
      type: 'text',
      localized: true,
      admin: {
        description: 'Venue or location where course takes place',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        description: 'Category tags for filtering',
      },
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Published courses are visible on the website',
        position: 'sidebar',
      },
    },
    // ========== SCHEDULE SECTION (only visible after course is created) ==========
    {
      name: 'schedule',
      type: 'group',
      admin: {
        description: 'Configure automatic session generation. Save course first, then fill this section.',
        condition: (data) => !!data?.id, // Only show after course exists
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
            description: 'Last session date',
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
            { label: 'Monthly', value: 'monthly' },
          ],
          admin: {
            description: 'How often sessions repeat',
          },
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
          admin: {
            description: 'Days of the week when sessions occur',
          },
        },
        {
          name: 'startTime',
          type: 'text',
          defaultValue: '18:00',
          admin: {
            description: 'Session start time in HH:MM format (e.g., "17:00")',
          },
        },
        {
          name: 'timezone',
          type: 'text',
          defaultValue: 'Europe/Madrid',
          admin: {
            description: 'Timezone for the schedule',
          },
        },
      ],
    },
    // ========== SESSIONS TAB ==========
    {
      name: 'sessions',
      type: 'join',
      collection: 'sessions',
      on: 'course',
      admin: {
        description: 'Sessions for this course',
        condition: (data) => !!data?.id,
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, req, operation, previousDoc }) => {
        const { payload } = req
        const course = doc

        // Skip on create - user needs to save first, then configure schedule
        if (operation === 'create') {
          return doc
        }

        // Only regenerate sessions on UPDATE when schedule is filled and changed
        if (operation === 'update') {
          const schedule = course.schedule
          if (!schedule?.startDate || !schedule?.endDate || !schedule?.daysOfWeek?.length || !schedule?.startTime) {
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
            previousDoc.durationMinutes !== course.durationMinutes ||
            previousDoc.maxCapacity !== course.maxCapacity

          if (!scheduleChanged) {
            return doc
          }

          console.log(`Schedule changed, regenerating sessions...`)

          // Generate session dates based on recurrence pattern
          const sessionDates: Date[] = []
          const start = new Date(schedule.startDate)
          const end = new Date(schedule.endDate)
          const daysSet = new Set(schedule.daysOfWeek.map((d: string) => parseInt(d, 10)))
          const recurrence = schedule.recurrence || 'weekly'

          // Track weeks for bi-weekly pattern
          let weekCount = 0
          let lastWeekNumber = -1

          const current = new Date(start)
          while (current <= end) {
            const dayOfWeek = current.getDay()
            const weekNumber = Math.floor((current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))

            // Reset week count when week changes
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

          // Parse start time
          const [hours, minutes] = (schedule.startTime || '18:00').split(':').map((n: string) => parseInt(n, 10))

          // Delete existing course sessions
          await payload.delete({
            collection: 'sessions',
            where: { course: { equals: course.id } },
            req,
          })

          // Create sessions sequentially to avoid overwhelming database
          for (const date of sessionDates) {
            const startDateTime = new Date(date)
            startDateTime.setHours(hours, minutes, 0, 0)

            await payload.create({
              collection: 'sessions',
              data: {
                sessionType: 'course',
                course: course.id,
                startDateTime: startDateTime.toISOString(),
                timezone: schedule.timezone || 'Europe/Madrid',
                status: 'scheduled',
                availableSpots: course.maxCapacity,
              },
              req,
            })
          }
          console.log(`Generated ${sessionDates.length} sessions for course: ${course.title}`)
        }

        return doc
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const { payload } = req

        // Check if course has any bookings
        const bookings = await payload.find({
          collection: 'bookings',
          where: { course: { equals: id } },
          limit: 1,
        })

        if (bookings.totalDocs > 0) {
          throw new Error('Cannot delete course with existing bookings')
        }

        // Delete all course sessions
        await payload.delete({
          collection: 'sessions',
          where: { course: { equals: id } },
        })

        return true
      },
    ],
  },
}

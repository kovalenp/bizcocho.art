import type { CollectionConfig } from 'payload'
import { logInfo, logWarn } from '../lib/logger'

export const Classes: CollectionConfig = {
  slug: 'classes',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'instructor', 'priceCents', 'isPublished'],
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
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'class',
      options: [
        { label: 'Class', value: 'class' },
        { label: 'Course', value: 'course' },
      ],
      admin: {
        description: 'Class: book individual sessions. Course: book enrollment (all sessions).',
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
    // ========== SCHEDULE SECTION (visible after save) ==========
    {
      name: 'schedule',
      type: 'group',
      admin: {
        description: 'Configure automatic session generation.',
        condition: (data) => !!data?.id,
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

        // Skip on create - user needs to save first, then configure schedule
        if (operation === 'create') {
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
          previousDoc.type !== classDoc.type

        if (!scheduleChanged) {
          return doc
        }

        logInfo('Schedule changed, regenerating sessions', { classId: doc.id, title: classDoc.title, type: classDoc.type })

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
          logWarn('No session dates generated - check schedule configuration', { classId: doc.id })
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
              sessionType: classDoc.type, // 'class' or 'course' - mirrors parent
              class: classDoc.id,
              startDateTime: startDateTime.toISOString(),
              timezone: schedule.timezone || 'Europe/Madrid',
              status: 'scheduled',
              availableSpots: classDoc.maxCapacity,
            },
            req,
          })
        }
        logInfo('Generated sessions', { classId: doc.id, title: classDoc.title, type: classDoc.type, sessionCount: sessionDates.length })

        return doc
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const { payload } = req

        // Get all session IDs for this class
        const sessions = await payload.find({
          collection: 'sessions',
          where: { class: { equals: id } },
          limit: 1000,
        })

        if (sessions.docs.length > 0) {
          const sessionIds = sessions.docs.map((s) => s.id)

          // Check for any bookings referencing these sessions
          const bookings = await payload.find({
            collection: 'bookings',
            where: { sessions: { in: sessionIds } },
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

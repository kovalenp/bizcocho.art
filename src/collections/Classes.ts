import type { CollectionConfig } from 'payload'
import {
  createSessionManagementService,
  type ScheduleConfig,
  type ClassConfig,
} from '../services/session-manager'
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
        const classDoc = doc

        // Skip on create - user needs to save first, then configure schedule
        if (operation === 'create') {
          return doc
        }

        const schedule = classDoc.schedule
        if (!schedule?.startDate || !schedule?.daysOfWeek?.length || !schedule?.startTime) {
          return doc // Schedule not configured yet
        }

        // Use SessionManagementService for change detection and session generation
        const sessionService = createSessionManagementService(req.payload)

        const scheduleConfig: ScheduleConfig = {
          startDate: schedule.startDate,
          endDate: schedule.endDate || null,
          recurrence: schedule.recurrence || 'weekly',
          daysOfWeek: schedule.daysOfWeek,
          startTime: schedule.startTime,
          timezone: schedule.timezone || 'Europe/Madrid',
        }

        const classConfig: ClassConfig = {
          maxCapacity: classDoc.maxCapacity,
          type: classDoc.type,
        }

        const previousSchedule = previousDoc?.schedule
          ? {
              startDate: previousDoc.schedule.startDate,
              endDate: previousDoc.schedule.endDate || null,
              recurrence: previousDoc.schedule.recurrence || 'weekly',
              daysOfWeek: previousDoc.schedule.daysOfWeek || [],
              startTime: previousDoc.schedule.startTime,
              timezone: previousDoc.schedule.timezone || 'Europe/Madrid',
            }
          : null

        const previousClassConfig = previousDoc
          ? { maxCapacity: previousDoc.maxCapacity, type: previousDoc.type }
          : undefined

        const scheduleChanged = sessionService.hasScheduleChanged(
          scheduleConfig,
          previousSchedule,
          classConfig,
          previousClassConfig
        )

        if (!scheduleChanged) {
          return doc
        }

        logInfo('Schedule changed, regenerating sessions', {
          classId: doc.id,
          title: classDoc.title,
          type: classDoc.type,
        })

        const result = await sessionService.generateSessions(doc.id, scheduleConfig, classConfig)

        if (!result.success) {
          if (result.error?.includes('active bookings')) {
            throw new Error(result.error)
          }
          logWarn('Session generation failed', { classId: doc.id, error: result.error })
        }

        return doc
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const sessionService = createSessionManagementService(req.payload)
        const classId = typeof id === 'string' ? parseInt(id, 10) : id

        // Check for active bookings
        const hasBookings = await sessionService.hasActiveBookings(classId)
        if (hasBookings) {
          throw new Error('Cannot delete class with existing bookings')
        }

        // Delete all sessions (force = true skips booking check since we already did it)
        await sessionService.deleteSessions(classId, { force: true })

        return true
      },
    ],
  },
}

import type { CollectionConfig } from 'payload'

export const ClassTemplates: CollectionConfig = {
  slug: 'class-templates',
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
        {
          label: 'One-Time Event',
          value: 'one-time',
        },
        {
          label: 'Recurring Class',
          value: 'recurring',
        },
        {
          label: 'Membership Template',
          value: 'membership-template',
        },
      ],
      admin: {
        description: 'One-time: Single event. Recurring: Repeating schedule. Membership Template: Part of a subscription membership.',
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
      admin: {
        description: 'Assigned instructor for this class',
      },
    },
    {
      name: 'featuredImage',
      type: 'relationship',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Main image for the class',
      },
    },
    {
      name: 'gallery',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      required: false,
      admin: {
        description: 'Additional images for class detail carousel',
      },
    },
    {
      name: 'priceCents',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Price per session in cents (e.g., 4500 = €45.00)',
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'eur',
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
        description: 'Maximum number of participants per session',
      },
    },
    {
      name: 'location',
      type: 'text',
      localized: true,
      admin: {
        description: 'Class location or venue',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        description: 'Tags for filtering (e.g., Kids & Family, Wine, Ceramics)',
      },
    },
    {
      name: 'recurrencePatterns',
      type: 'array',
      admin: {
        description: 'Define recurring schedules for this class (e.g., "Every Thursday at 18:00")',
        condition: (data) => data.classType === 'recurring',
      },
      fields: [
        {
          name: 'frequency',
          type: 'select',
          required: true,
          defaultValue: 'weekly',
          options: [
            {
              label: 'Weekly',
              value: 'weekly',
            },
            {
              label: 'Bi-weekly',
              value: 'biweekly',
            },
            {
              label: 'Monthly',
              value: 'monthly',
            },
          ],
        },
        {
          name: 'daysOfWeek',
          type: 'select',
          hasMany: true,
          required: true,
          options: [
            { label: 'Monday', value: '1' },
            { label: 'Tuesday', value: '2' },
            { label: 'Wednesday', value: '3' },
            { label: 'Thursday', value: '4' },
            { label: 'Friday', value: '5' },
            { label: 'Saturday', value: '6' },
            { label: 'Sunday', value: '0' },
          ],
          admin: {
            description: 'Days of the week this class occurs',
          },
        },
        {
          name: 'startTime',
          type: 'text',
          required: true,
          admin: {
            description: 'Start time in HH:MM format (e.g., "18:00")',
          },
        },
        {
          name: 'startDate',
          type: 'date',
          required: true,
          admin: {
            description: 'Date when the recurrence starts',
          },
        },
        {
          name: 'endDate',
          type: 'date',
          admin: {
            description: 'Date when the recurrence ends (leave empty for indefinite)',
          },
        },
        {
          name: 'timezone',
          type: 'text',
          defaultValue: 'Europe/Madrid',
          required: true,
          admin: {
            description: 'Timezone for the recurring schedule',
          },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Whether this recurrence pattern is currently active',
          },
        },
      ],
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}

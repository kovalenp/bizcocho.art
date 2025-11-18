import type { CollectionConfig } from 'payload'

export const ClassSessions: CollectionConfig = {
  slug: 'class-sessions',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['classTemplate', 'startDateTime', 'status', 'availableSpots'],
  },
  fields: [
    {
      name: 'classTemplate',
      type: 'relationship',
      relationTo: 'class-templates',
      required: true,
      admin: {
        description: 'The class template this session belongs to',
      },
    },
    {
      name: 'startDateTime',
      type: 'date',
      required: true,
      admin: {
        description: 'Start date and time (stored in UTC)',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'endDateTime',
      type: 'date',
      required: true,
      admin: {
        description: 'End date and time (stored in UTC)',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'timezone',
      type: 'text',
      defaultValue: 'UTC',
      admin: {
        description: 'Timezone for display purposes (e.g., "Europe/Madrid")',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      options: [
        {
          label: 'Scheduled',
          value: 'scheduled',
        },
        {
          label: 'Cancelled',
          value: 'cancelled',
        },
        {
          label: 'Completed',
          value: 'completed',
        },
      ],
    },
    {
      name: 'availableSpots',
      type: 'number',
      admin: {
        description: 'Available spots (calculated: maxCapacity - bookings). Updated via hooks.',
        readOnly: true,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about this specific session',
      },
    },
  ],
}

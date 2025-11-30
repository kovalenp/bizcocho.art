import type { CollectionConfig } from 'payload'

export const Sessions: CollectionConfig = {
  slug: 'sessions',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['id', 'sessionType', 'class', 'startDateTime', 'status', 'availableSpots'],
  },
  fields: [
    {
      name: 'sessionType',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Class', value: 'class' },
        { label: 'Course', value: 'course' },
      ],
      admin: {
        description: 'Mirrors the parent class type',
      },
    },
    {
      name: 'class',
      type: 'relationship',
      relationTo: 'classes',
      required: true,
      index: true,
      admin: {
        description: 'The class/course this session belongs to',
      },
    },
    {
      name: 'startDateTime',
      type: 'date',
      required: true,
      index: true,
      admin: {
        description: 'Session start date and time',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'timezone',
      type: 'text',
      defaultValue: 'Europe/Madrid',
      admin: {
        description: 'Timezone (e.g., "Europe/Madrid")',
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      index: true,
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Completed', value: 'completed' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'availableSpots',
      type: 'number',
      required: false,
      min: 0,
      admin: {
        description: 'Auto-initialized from class maxCapacity, updated by bookings',
        position: 'sidebar',
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

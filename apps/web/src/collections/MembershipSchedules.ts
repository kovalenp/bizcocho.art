import type { CollectionConfig } from 'payload'

export const MembershipSchedules: CollectionConfig = {
  slug: 'membership-schedules',
  admin: {
    useAsTitle: 'id',
    description: 'Links memberships to specific class sessions available during a period',
  },
  fields: [
    {
      name: 'membership',
      type: 'relationship',
      relationTo: 'memberships',
      required: true,
      admin: {
        description: 'The membership this schedule belongs to',
      },
    },
    {
      name: 'classSessions',
      type: 'relationship',
      relationTo: 'class-sessions',
      hasMany: true,
      required: true,
      admin: {
        description: 'Class sessions that are available to membership subscribers',
      },
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
      admin: {
        description: 'When this schedule period starts',
      },
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
      admin: {
        description: 'When this schedule period ends',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this schedule is currently active',
      },
    },
  ],
}

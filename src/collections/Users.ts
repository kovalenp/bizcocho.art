import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'phone'],
  },
  auth: true,
  fields: [
    {
      name: 'firstName',
      type: 'text',
      admin: {
        description: 'First name',
      },
    },
    {
      name: 'lastName',
      type: 'text',
      admin: {
        description: 'Last name',
      },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description: 'Phone number',
      },
    },
    {
      name: 'address',
      type: 'text',
      admin: {
        description: 'Street address',
      },
    },
    {
      name: 'city',
      type: 'text',
    },
    {
      name: 'postalCode',
      type: 'text',
    },
    {
      name: 'country',
      type: 'text',
      defaultValue: 'Spain',
    },
  ],
}

import type { CollectionConfig } from 'payload'

export const Instructors: CollectionConfig = {
  slug: 'instructors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'specialties', 'isActive'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly identifier',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Instructor biography',
      },
    },
    {
      name: 'photo',
      type: 'relationship',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Instructor profile photo',
      },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'specialties',
      type: 'text',
      localized: true,
      admin: {
        description: 'Teaching specialties (e.g., "Watercolor, Acrylics, Portrait")',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this instructor is currently available',
      },
    },
  ],
}

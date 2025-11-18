import type { CollectionConfig } from 'payload'

export const Classes: CollectionConfig = {
  slug: 'classes',
  admin: {
    useAsTitle: 'title'
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
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'featuredImage',
      type: 'relationship',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Main image for the class'
      }
    },
    {
      name: 'gallery',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      required: false,
      admin: {
        description: 'Additional images for class detail carousel'
      }
    },
    {
      name: 'priceCents',
      type: 'number',
      required: true,
      min: 0
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'eur'
    },
    {
      name: 'start',
      type: 'date'
    },
    {
      name: 'end',
      type: 'date'
    },
    {
      name: 'capacity',
      type: 'number',
      defaultValue: 8
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false
    }
  ],
}
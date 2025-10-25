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
      required: true
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true
    },
    {
      name: 'description',
      type: 'textarea'
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
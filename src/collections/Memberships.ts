import type { CollectionConfig } from 'payload'

export const Memberships: CollectionConfig = {
  slug: 'memberships',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'monthlyPriceCents', 'billingCycle', 'isPublished'],
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
      admin: {
        description: 'Membership description and benefits',
      },
    },
    {
      name: 'classTemplates',
      type: 'relationship',
      relationTo: 'class-templates',
      hasMany: true,
      required: false,
      admin: {
        description: 'Class templates included in this membership',
      },
    },
    {
      name: 'featuredImage',
      type: 'relationship',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Main image for the membership',
      },
    },
    {
      name: 'monthlyPriceCents',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Monthly subscription price in cents (e.g., 12000 = €120.00)',
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'eur',
    },
    {
      name: 'billingCycle',
      type: 'select',
      required: true,
      defaultValue: 'monthly',
      options: [
        {
          label: 'Monthly',
          value: 'monthly',
        },
        {
          label: 'Quarterly',
          value: 'quarterly',
        },
        {
          label: 'Annual',
          value: 'annual',
        },
      ],
    },
    {
      name: 'maxEnrollments',
      type: 'number',
      required: true,
      defaultValue: 20,
      min: 1,
      admin: {
        description: 'Maximum number of active subscriptions',
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
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}

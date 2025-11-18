import type { CollectionConfig } from 'payload'

export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'membership', 'status', 'paymentStatus', 'nextBillingDate'],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Subscribed user',
      },
    },
    {
      name: 'membership',
      type: 'relationship',
      relationTo: 'memberships',
      required: true,
      admin: {
        description: 'The membership the user is subscribed to',
      },
    },
    {
      name: 'enrollmentDate',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        {
          label: 'Active',
          value: 'active',
        },
        {
          label: 'Paused',
          value: 'paused',
        },
        {
          label: 'Cancelled',
          value: 'cancelled',
        },
        {
          label: 'Expired',
          value: 'expired',
        },
      ],
    },
    {
      name: 'paymentStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        {
          label: 'Pending',
          value: 'pending',
        },
        {
          label: 'Paid',
          value: 'paid',
        },
        {
          label: 'Failed',
          value: 'failed',
        },
        {
          label: 'Refunded',
          value: 'refunded',
        },
      ],
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      admin: {
        description: 'Stripe Subscription ID',
      },
    },
    {
      name: 'nextBillingDate',
      type: 'date',
      admin: {
        description: 'Next billing date for subscription',
      },
    },
    {
      name: 'cancellationDate',
      type: 'date',
      admin: {
        description: 'Date when subscription was cancelled',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about this subscription',
      },
    },
  ],
}

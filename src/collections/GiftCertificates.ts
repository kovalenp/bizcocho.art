import type { CollectionConfig } from 'payload'
import {
  beforeChangeGiftCertificate,
  afterChangeGiftCertificate,
} from './hooks/gift-certificates'

export const GiftCertificates: CollectionConfig = {
  slug: 'gift-certificates',
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'type', 'status', 'currentBalanceCents', 'discountValue', 'currentUses', 'expiresAt'],
    group: 'Commerce',
  },
  fields: [
    // Identity
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Unique code (auto-generated if empty). Format: XXXX-XXXX',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Gift Certificate', value: 'gift' },
        { label: 'Promo Code', value: 'promo' },
      ],
      admin: {
        description: 'Gift = purchasable voucher with balance. Promo = admin-generated discount.',
      },
    },

    // Status & validity
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Active', value: 'active' },
        { label: 'Partial', value: 'partial' },
        { label: 'Redeemed', value: 'redeemed' },
        { label: 'Expired', value: 'expired' },
      ],
      admin: {
        description: 'pending = awaiting payment, active = ready to use, partial = has remaining balance, redeemed = fully used, expired = past expiration date',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      index: true,
      admin: {
        description: 'Expiration date (12 months from purchase for gifts)',
        date: { pickerAppearance: 'dayOnly' },
      },
    },

    // Value - for 'gift' type (fixed amount)
    {
      name: 'initialValueCents',
      type: 'number',
      min: 0,
      admin: {
        description: 'Initial value in cents (e.g., 5000 = 50€). For gift certificates only.',
        condition: (data) => data?.type === 'gift',
      },
    },
    {
      name: 'currentBalanceCents',
      type: 'number',
      min: 0,
      admin: {
        description: 'Current remaining balance in cents. For gift certificates only.',
        condition: (data) => data?.type === 'gift',
      },
    },
    {
      name: 'currency',
      type: 'select',
      defaultValue: 'eur',
      options: [
        { label: 'EUR', value: 'eur' },
        { label: 'USD', value: 'usd' },
      ],
      admin: {
        description: 'Currency for the gift certificate value',
        condition: (data) => data?.type === 'gift',
      },
    },

    // Value - for 'promo' type
    {
      name: 'discountType',
      type: 'select',
      options: [
        { label: 'Percentage', value: 'percentage' },
        { label: 'Fixed Amount', value: 'fixed' },
      ],
      admin: {
        description: 'Type of discount. For promo codes only.',
        condition: (data) => data?.type === 'promo',
      },
    },
    {
      name: 'discountValue',
      type: 'number',
      min: 0,
      admin: {
        description: 'Discount value: percentage (0-100) or fixed amount in cents. For promo codes only.',
        condition: (data) => data?.type === 'promo',
      },
    },

    // Usage limits (promo only)
    {
      name: 'maxUses',
      type: 'number',
      min: 1,
      admin: {
        description: 'Maximum number of uses. Leave empty for unlimited. For promo codes only.',
        condition: (data) => data?.type === 'promo',
      },
    },
    {
      name: 'currentUses',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Current number of times this code has been used.',
        condition: (data) => data?.type === 'promo',
      },
    },

    // Purchaser info (gift only)
    {
      name: 'purchaser',
      type: 'group',
      admin: {
        description: 'Information about the person who purchased this gift certificate',
        condition: (data) => data?.type === 'gift',
      },
      fields: [
        { name: 'email', type: 'email' },
        { name: 'firstName', type: 'text' },
        { name: 'lastName', type: 'text' },
        { name: 'phone', type: 'text' },
      ],
    },

    // Recipient info (gift only)
    {
      name: 'recipient',
      type: 'group',
      admin: {
        description: 'Information about the gift recipient',
        condition: (data) => data?.type === 'gift',
      },
      fields: [
        { name: 'email', type: 'email' },
        { name: 'name', type: 'text' },
        {
          name: 'personalMessage',
          type: 'textarea',
          admin: { description: 'Personal message from purchaser to recipient' },
        },
      ],
    },

    // Stripe (gift only)
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      admin: {
        description: 'Stripe Payment Intent ID for the purchase',
        condition: (data) => data?.type === 'gift',
      },
    },

    // Redemptions history
    {
      name: 'redemptions',
      type: 'array',
      admin: {
        description: 'History of redemptions for this certificate',
      },
      fields: [
        {
          name: 'booking',
          type: 'relationship',
          relationTo: 'bookings',
          required: true,
        },
        {
          name: 'amountCents',
          type: 'number',
          required: true,
          min: 0,
          admin: { description: 'Amount redeemed in cents' },
        },
        {
          name: 'redeemedAt',
          type: 'date',
          required: true,
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },

    // Admin notes
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes (e.g., "Black Friday 2024", "Influencer code")',
      },
    },
  ],
  hooks: {
    beforeChange: [beforeChangeGiftCertificate],
    afterChange: [afterChangeGiftCertificate],
  },
}

import Stripe from 'stripe'

/**
 * Stripe API version used across the application.
 * Update this when upgrading Stripe API version.
 */
export const STRIPE_API_VERSION = '2025-11-17.clover' as const

let stripeInstance: Stripe | null = null

/**
 * Get a singleton Stripe client instance.
 * Lazily initialized on first call.
 *
 * @throws Error if STRIPE_SECRET_KEY is not configured
 */
export function getStripe(): Stripe {
  if (stripeInstance) {
    return stripeInstance
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  })

  return stripeInstance
}

/**
 * Create a new Stripe client with a custom secret key.
 * Useful for testing or multi-tenant scenarios.
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  })
}

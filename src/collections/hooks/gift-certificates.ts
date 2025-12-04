import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'
import type { GiftCertificate } from '../../payload-types'
import { generateCode } from '../../lib/gift-codes'
import { createNotificationService } from '../../services/notifications'
import { logInfo } from '../../lib/logger'
import type { Locale } from '../../i18n/config'

/**
 * Handles gift certificate data before save.
 * - Auto-generates code if empty on creation
 * - Initializes currentBalanceCents from initialValueCents for gift type
 * - Sets status to active for promo codes on creation
 */
export const beforeChangeGiftCertificate: CollectionBeforeChangeHook<GiftCertificate> = async ({
  data,
  operation,
}) => {
  // Auto-generate code if empty on creation
  if (operation === 'create' && !data?.code) {
    data.code = generateCode()
  }

  // For gift certificates: initialize currentBalanceCents from initialValueCents
  if (operation === 'create' && data?.type === 'gift' && data?.initialValueCents) {
    data.currentBalanceCents = data.initialValueCents
  }

  // For promo codes: set status to active on creation
  if (operation === 'create' && data?.type === 'promo') {
    data.status = 'active'
  }

  return data
}

/**
 * Handles gift certificate changes after save.
 * - Sends activation notifications when status changes to 'active'
 */
export const afterChangeGiftCertificate: CollectionAfterChangeHook<GiftCertificate> = async ({
  doc,
  previousDoc,
  req,
}) => {
  // Send activation notification when gift certificate becomes active
  const wasActivated = previousDoc?.status !== 'active' && doc.status === 'active'

  // Only send for gift certificates (not promo codes) that were just activated
  if (wasActivated && doc.type === 'gift') {
    logInfo('Gift certificate activated, sending notifications', {
      giftCertificateId: doc.id,
      code: doc.code,
    })

    const notificationService = createNotificationService(req.payload)
    // Fire and forget - don't block the response
    const locale = (doc.locale as Locale) || 'en'
    notificationService.sendGiftCertificateActivation(doc.id, { locale }).catch(() => {
      // Error already logged in notification service
    })
  }

  return doc
}

import { randomBytes } from 'crypto'

// Characters excluding confusing ones: 0/O, 1/I/L
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Generate a unique gift/promo code in format XXXX-XXXX
 * Uses cryptographically secure random bytes
 */
export function generateCode(): string {
  const bytes = randomBytes(8)
  let code = ''

  for (let i = 0; i < 8; i++) {
    const index = bytes[i] % CHARS.length
    code += CHARS[index]
    if (i === 3) code += '-'
  }

  return code
}

/**
 * Normalize a code for comparison:
 * - Uppercase
 * - Remove spaces
 * - Trim whitespace
 */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/\s+/g, '').trim()
}

/**
 * Validate code format (XXXX-XXXX)
 */
export function isValidCodeFormat(code: string): boolean {
  const normalized = normalizeCode(code)
  // Allow with or without hyphen
  const withHyphen = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)
  const withoutHyphen = /^[A-Z0-9]{8}$/.test(normalized)
  return withHyphen || withoutHyphen
}

/**
 * Format code with hyphen if missing
 */
export function formatCode(code: string): string {
  const normalized = normalizeCode(code).replace(/-/g, '')
  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`
  }
  return normalized
}

import type { Class, Media, Instructor, Tag } from '@/payload-types'

/**
 * Type alias for display items.
 * With the unified model, we simply use Class which has a `type` field ('class' | 'course').
 */
export type DisplayItem = Class

/**
 * Type guard to check if class is a course (multi-session enrollment)
 */
export function isCourse(classDoc: Class): boolean {
  return classDoc.type === 'course'
}

/**
 * Type guard to check if class is a single-session class
 */
export function isClass(classDoc: Class): boolean {
  return classDoc.type === 'class'
}

/**
 * Get common display properties from a class
 */
export function getDisplayItemProps(classDoc: Class) {
  return {
    id: classDoc.id,
    title: classDoc.title as string,
    slug: classDoc.slug as string,
    description: classDoc.description as string | undefined,
    priceCents: classDoc.priceCents || 0,
    currency: (classDoc.currency || 'eur') as string,
    durationMinutes: classDoc.durationMinutes || 0,
    maxCapacity: classDoc.maxCapacity || 0,
    location: classDoc.location as string | undefined,
    isPublished: classDoc.isPublished || false,
    featuredImage: classDoc.featuredImage as Media | null,
    instructor: classDoc.instructor as Instructor | null,
    tags: (classDoc.tags || []) as Tag[],
    type: classDoc.type as 'class' | 'course',
  }
}

import type { Class, Course, Media, Instructor, Tag } from '@/payload-types'

/**
 * Discriminated union type for displaying classes and courses together
 * in listings (homepage, filters, etc.)
 */
export type DisplayItem =
  | {
      itemType: 'class'
      data: Class
    }
  | {
      itemType: 'course'
      data: Course
    }

/**
 * Helper to create a class display item
 */
export function createClassDisplayItem(classDoc: Class): DisplayItem {
  return {
    itemType: 'class',
    data: classDoc,
  }
}

/**
 * Helper to create a course display item
 */
export function createCourseDisplayItem(course: Course): DisplayItem {
  return {
    itemType: 'course',
    data: course,
  }
}

/**
 * Type guard to check if item is a class
 */
export function isClassItem(item: DisplayItem): item is { itemType: 'class'; data: Class } {
  return item.itemType === 'class'
}

/**
 * Type guard to check if item is a course
 */
export function isCourseItem(item: DisplayItem): item is { itemType: 'course'; data: Course } {
  return item.itemType === 'course'
}

/**
 * Get common display properties from a display item
 */
export function getDisplayItemProps(item: DisplayItem) {
  const data = item.data
  return {
    id: data.id,
    title: data.title as string,
    slug: data.slug as string,
    description: data.description as string | undefined,
    priceCents: data.priceCents || 0,
    currency: (data.currency || 'eur') as string,
    durationMinutes: data.durationMinutes || 0,
    maxCapacity: data.maxCapacity || 0,
    location: data.location as string | undefined,
    isPublished: data.isPublished || false,
    featuredImage: data.featuredImage as Media | null,
    instructor: data.instructor as Instructor | null,
    tags: (data.tags || []) as Tag[],
    itemType: item.itemType,
  }
}

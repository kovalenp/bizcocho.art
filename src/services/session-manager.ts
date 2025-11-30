import type { Payload } from 'payload'
import { logError, logInfo, logWarn } from '../lib/logger'

export type ScheduleConfig = {
  startDate: string
  endDate?: string | null
  recurrence: 'weekly' | 'biweekly' | 'monthly'
  daysOfWeek: string[]
  startTime: string
  timezone: string
}

export type ClassConfig = {
  maxCapacity: number
  type: 'class' | 'course'
  durationMinutes?: number
}

export type GenerateSessionsResult = {
  success: boolean
  error?: string
  sessionCount?: number
  sessionIds?: number[]
}

export type DeleteSessionsResult = {
  success: boolean
  error?: string
  deletedCount?: number
}

/**
 * Centralized service for managing session lifecycle.
 * Handles session generation, deletion, and schedule change detection.
 */
export class SessionManagementService {
  constructor(private payload: Payload) {}

  /**
   * Check if schedule configuration has changed.
   * Compares all schedule-related fields between old and new config.
   */
  hasScheduleChanged(
    newSchedule: ScheduleConfig | undefined | null,
    oldSchedule: ScheduleConfig | undefined | null,
    newClassConfig?: ClassConfig,
    oldClassConfig?: ClassConfig
  ): boolean {
    // No old schedule = first time configuration
    if (!oldSchedule) return !!newSchedule

    // No new schedule but had old = cleared schedule
    if (!newSchedule) return true

    // Compare schedule fields
    const scheduleFieldsChanged =
      oldSchedule.startDate !== newSchedule.startDate ||
      oldSchedule.endDate !== newSchedule.endDate ||
      oldSchedule.recurrence !== newSchedule.recurrence ||
      JSON.stringify(oldSchedule.daysOfWeek) !== JSON.stringify(newSchedule.daysOfWeek) ||
      oldSchedule.startTime !== newSchedule.startTime ||
      oldSchedule.timezone !== newSchedule.timezone

    if (scheduleFieldsChanged) return true

    // Compare class config if provided
    if (newClassConfig && oldClassConfig) {
      return (
        oldClassConfig.maxCapacity !== newClassConfig.maxCapacity ||
        oldClassConfig.type !== newClassConfig.type
      )
    }

    return false
  }

  /**
   * Generate session dates based on schedule configuration.
   * Pure function - no database operations.
   */
  getSessionDates(schedule: ScheduleConfig): Date[] {
    const start = new Date(schedule.startDate)
    const end = schedule.endDate
      ? new Date(schedule.endDate)
      : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000) // Default 3 months

    const daysSet = new Set(schedule.daysOfWeek.map((d) => parseInt(d, 10)))
    const recurrence = schedule.recurrence || 'weekly'

    const sessionDates: Date[] = []
    const current = new Date(start)
    let weekCount = 0
    let lastWeekNumber = -1

    while (current <= end) {
      const dayOfWeek = current.getDay()
      const weekNumber = Math.floor(
        (current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
      )

      if (weekNumber !== lastWeekNumber) {
        if (lastWeekNumber !== -1) weekCount++
        lastWeekNumber = weekNumber
      }

      let shouldInclude = false
      if (daysSet.has(dayOfWeek)) {
        if (recurrence === 'weekly') {
          shouldInclude = true
        } else if (recurrence === 'biweekly') {
          shouldInclude = weekCount % 2 === 0
        } else if (recurrence === 'monthly') {
          // First occurrence of this day in each month
          const firstOfMonth = new Date(current.getFullYear(), current.getMonth(), 1)
          const firstOccurrence = new Date(firstOfMonth)
          while (firstOccurrence.getDay() !== dayOfWeek) {
            firstOccurrence.setDate(firstOccurrence.getDate() + 1)
          }
          shouldInclude = current.getDate() === firstOccurrence.getDate()
        }
      }

      if (shouldInclude) {
        sessionDates.push(new Date(current))
      }
      current.setDate(current.getDate() + 1)
    }

    return sessionDates
  }

  /**
   * Check if a class has active bookings on any of its sessions.
   */
  async hasActiveBookings(classId: number): Promise<boolean> {
    try {
      const sessions = await this.payload.find({
        collection: 'sessions',
        where: { class: { equals: classId } },
        limit: 1000,
      })

      if (sessions.docs.length === 0) return false

      const sessionIds = sessions.docs.map((s) => s.id)
      const activeBookings = await this.payload.find({
        collection: 'bookings',
        where: {
          sessions: { in: sessionIds },
          status: { in: ['pending', 'confirmed'] },
        },
        limit: 1,
      })

      return activeBookings.totalDocs > 0
    } catch (error) {
      logError('Failed to check active bookings', error, { classId })
      return false
    }
  }

  /**
   * Delete all sessions for a class.
   * @param classId - The class ID
   * @param options.force - Skip booking check (dangerous, use with caution)
   */
  async deleteSessions(
    classId: number,
    options: { force?: boolean } = {}
  ): Promise<DeleteSessionsResult> {
    try {
      // Check for active bookings unless forced
      if (!options.force) {
        const hasBookings = await this.hasActiveBookings(classId)
        if (hasBookings) {
          return {
            success: false,
            error: 'Cannot delete sessions: active bookings exist. Cancel bookings first.',
          }
        }
      }

      const sessions = await this.payload.find({
        collection: 'sessions',
        where: { class: { equals: classId } },
        limit: 1000,
      })

      if (sessions.docs.length === 0) {
        return { success: true, deletedCount: 0 }
      }

      await this.payload.delete({
        collection: 'sessions',
        where: { class: { equals: classId } },
      })

      logInfo('Deleted sessions', { classId, deletedCount: sessions.docs.length })

      return { success: true, deletedCount: sessions.docs.length }
    } catch (error) {
      logError('Failed to delete sessions', error, { classId })
      return { success: false, error: 'Failed to delete sessions' }
    }
  }

  /**
   * Generate sessions for a class based on schedule configuration.
   * Deletes existing sessions first (with booking check).
   */
  async generateSessions(
    classId: number,
    schedule: ScheduleConfig,
    classConfig: ClassConfig
  ): Promise<GenerateSessionsResult> {
    try {
      // Validate schedule
      if (!schedule.startDate || !schedule.daysOfWeek?.length || !schedule.startTime) {
        return { success: false, error: 'Incomplete schedule configuration' }
      }

      // Generate session dates
      const sessionDates = this.getSessionDates(schedule)

      if (sessionDates.length === 0) {
        logWarn('No session dates generated - check schedule configuration', { classId })
        return { success: false, error: 'No session dates generated' }
      }

      // Delete existing sessions (with booking check)
      const deleteResult = await this.deleteSessions(classId)
      if (!deleteResult.success) {
        return { success: false, error: deleteResult.error }
      }

      // Parse start time
      const [hours, minutes] = (schedule.startTime || '18:00')
        .split(':')
        .map((n) => parseInt(n, 10))

      // Create sessions sequentially to avoid race conditions
      const sessionIds: number[] = []
      for (const date of sessionDates) {
        const startDateTime = new Date(date)
        startDateTime.setHours(hours, minutes, 0, 0)

        const session = await this.payload.create({
          collection: 'sessions',
          data: {
            sessionType: classConfig.type,
            class: classId,
            startDateTime: startDateTime.toISOString(),
            timezone: schedule.timezone || 'Europe/Madrid',
            status: 'scheduled',
            availableSpots: classConfig.maxCapacity,
          },
        })

        sessionIds.push(session.id)
      }

      logInfo('Generated sessions', {
        classId,
        sessionCount: sessionIds.length,
        type: classConfig.type,
      })

      return {
        success: true,
        sessionCount: sessionIds.length,
        sessionIds,
      }
    } catch (error) {
      logError('Failed to generate sessions', error, { classId })
      return { success: false, error: 'Failed to generate sessions' }
    }
  }

  /**
   * Regenerate sessions when schedule changes.
   * Convenience wrapper around generateSessions with change detection.
   */
  async regenerateSessions(
    classId: number,
    schedule: ScheduleConfig,
    classConfig: ClassConfig
  ): Promise<GenerateSessionsResult> {
    return this.generateSessions(classId, schedule, classConfig)
  }
}

/**
 * Factory function to create a SessionManagementService instance.
 */
export function createSessionManagementService(payload: Payload): SessionManagementService {
  return new SessionManagementService(payload)
}

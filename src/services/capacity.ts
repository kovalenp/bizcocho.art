import type { Payload } from 'payload'
import { logError } from '../lib/logger'

export type ReservationResult = {
  success: boolean
  error?: string
  reservedSpots?: number
}

export type CapacityInfo = {
  sessionId: number
  availableSpots: number
  maxCapacity: number
}

/**
 * Centralized service for managing session capacity.
 * Unified interface - works with arrays of session IDs (1 or many).
 */
export class CapacityService {
  constructor(private payload: Payload) {}

  /**
   * Reserve spots on one or more sessions.
   * Uses verify-and-rollback pattern to prevent overbooking.
   */
  async reserveSpots(
    sessionIds: number[],
    numberOfPeople: number
  ): Promise<ReservationResult> {
    if (sessionIds.length === 0) {
      return { success: false, error: 'No sessions provided' }
    }

    try {
      // Fetch all sessions
      const sessions = await this.payload.find({
        collection: 'sessions',
        where: { id: { in: sessionIds } },
        limit: sessionIds.length,
      })

      if (sessions.docs.length !== sessionIds.length) {
        return { success: false, error: 'One or more sessions not found' }
      }

      // Check minimum capacity across all sessions
      const minAvailable = Math.min(
        ...sessions.docs.map((s) => s.availableSpots ?? 0)
      )

      if (numberOfPeople > minAvailable) {
        return { success: false, error: 'Not enough capacity available' }
      }

      // Decrement all sessions
      const updatePromises = sessions.docs.map((session) => {
        const currentSpots = session.availableSpots ?? 0
        return this.payload.update({
          collection: 'sessions',
          id: session.id,
          data: { availableSpots: currentSpots - numberOfPeople },
        })
      })
      await Promise.all(updatePromises)

      // Verify no session went negative
      const verifiedSessions = await this.payload.find({
        collection: 'sessions',
        where: { id: { in: sessionIds } },
        limit: sessionIds.length,
      })

      const hasNegative = verifiedSessions.docs.some(
        (s) => s.availableSpots != null && s.availableSpots < 0
      )

      if (hasNegative) {
        // Rollback all
        const rollbackPromises = verifiedSessions.docs.map((session) => {
          const currentSpots = session.availableSpots ?? 0
          return this.payload.update({
            collection: 'sessions',
            id: session.id,
            data: { availableSpots: currentSpots + numberOfPeople },
          })
        })
        await Promise.all(rollbackPromises)
        return { success: false, error: 'Race condition detected - please try again' }
      }

      return { success: true, reservedSpots: numberOfPeople }
    } catch (error) {
      logError('Failed to reserve spots', error, { sessionIds, numberOfPeople })
      return { success: false, error: 'Failed to reserve spots' }
    }
  }

  /**
   * Release reserved spots on one or more sessions.
   */
  async releaseSpots(sessionIds: number[], numberOfPeople: number): Promise<void> {
    if (sessionIds.length === 0) return

    try {
      const sessions = await this.payload.find({
        collection: 'sessions',
        where: { id: { in: sessionIds } },
        limit: sessionIds.length,
      })

      const updatePromises = sessions.docs.map((session) => {
        const currentSpots = session.availableSpots ?? 0
        return this.payload.update({
          collection: 'sessions',
          id: session.id,
          data: { availableSpots: currentSpots + numberOfPeople },
        })
      })

      await Promise.all(updatePromises)
    } catch (error) {
      logError('Failed to release spots', error, { sessionIds, numberOfPeople })
    }
  }

  /**
   * Get availability info for one or more sessions.
   * Returns minimum availability across all sessions.
   */
  async getAvailability(sessionIds: number[]): Promise<{
    minAvailable: number
    sessions: CapacityInfo[]
  } | null> {
    if (sessionIds.length === 0) return null

    try {
      const sessions = await this.payload.find({
        collection: 'sessions',
        where: { id: { in: sessionIds } },
        depth: 1,
        limit: sessionIds.length,
      })

      if (sessions.docs.length === 0) return null

      // Get max capacity from first session's parent class
      const firstSession = sessions.docs[0]
      let maxCapacity = 0

      if (firstSession.class) {
        const classDoc =
          typeof firstSession.class === 'object'
            ? firstSession.class
            : await this.payload.findByID({ collection: 'classes', id: firstSession.class })
        maxCapacity = classDoc?.maxCapacity ?? 0
      }

      const sessionInfos: CapacityInfo[] = sessions.docs.map((session) => ({
        sessionId: session.id,
        availableSpots: session.availableSpots ?? maxCapacity,
        maxCapacity,
      }))

      const minAvailable = Math.min(...sessionInfos.map((s) => s.availableSpots))

      return {
        minAvailable,
        sessions: sessionInfos,
      }
    } catch (error) {
      logError('Failed to get availability', error, { sessionIds })
      return null
    }
  }

  /**
   * Get all session IDs for a class (useful for course enrollments).
   */
  async getClassSessionIds(classId: number): Promise<number[]> {
    try {
      const sessions = await this.payload.find({
        collection: 'sessions',
        where: {
          class: { equals: classId },
          status: { equals: 'scheduled' },
        },
        limit: 100,
      })

      return sessions.docs.map((s) => s.id)
    } catch (error) {
      logError('Failed to get class session IDs', error, { classId })
      return []
    }
  }
}

/**
 * Factory function to create a CapacityService instance.
 */
export function createCapacityService(payload: Payload): CapacityService {
  return new CapacityService(payload)
}

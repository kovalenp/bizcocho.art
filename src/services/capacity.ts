import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'
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
   * Uses atomic SQL updates to prevent overbooking race conditions.
   */
  async reserveSpots(
    sessionIds: number[],
    numberOfPeople: number,
    req?: PayloadRequest
  ): Promise<ReservationResult> {
    if (sessionIds.length === 0) {
      return { success: false, error: 'No sessions provided' }
    }

    const payload = req?.payload || this.payload

    try {
      // Fetch all sessions to ensure they exist
      // We still fetch them to validate existence, although the SQL update would also fail if not found
      const sessions = await payload.find({
        collection: 'sessions',
        where: { id: { in: sessionIds } },
        limit: sessionIds.length,
        req,
      })

      if (sessions.docs.length !== sessionIds.length) {
        return { success: false, error: 'One or more sessions not found' }
      }

      // Get access to Drizzle for atomic updates
      // We assume PostgresAdapter is used
      const adapter = payload.db as unknown as {
        drizzle: { execute: (query: any) => Promise<{ rows: any[] }> }
        tableNameMap: Map<string, string>
      }
      
      if (!adapter.drizzle || !adapter.tableNameMap) {
         throw new Error('Database adapter does not support atomic updates')
      }

      const tableName = adapter.tableNameMap.get('sessions')
      if (!tableName) {
        throw new Error('Sessions table name not found')
      }

      // Perform atomic updates in parallel
      // We track success individually to rollback partial failures if necessary
      const results = await Promise.all(
        sessions.docs.map(async (session) => {
          try {
            // Atomic decrement: only updates if capacity >= N
            // We use COALESCE(val, 0) to match existing logic where null/undefined is treated as 0 capacity
            // Note: internal ID 'id' is used. 
            const result = await adapter.drizzle.execute(sql`
              UPDATE ${sql.identifier(tableName)}
              SET "available_spots" = COALESCE("available_spots", 0) - ${numberOfPeople}
              WHERE "id" = ${session.id} 
              AND COALESCE("available_spots", 0) >= ${numberOfPeople}
              RETURNING "id"
            `)

            return { 
              sessionId: session.id, 
              success: result.rows.length > 0 
            }
          } catch (e) {
            logError(`Atomic update failed for session ${session.id}`, e)
            return { sessionId: session.id, success: false }
          }
        })
      )

      const failed = results.filter((r) => !r.success)

      if (failed.length > 0) {
        // Partial failure detected (e.g. one session in a course was full)
        // Rollback any successful reservations from this batch
        const successfulIds = results
          .filter((r) => r.success)
          .map((r) => r.sessionId)

        if (successfulIds.length > 0) {
          await this.releaseSpots(successfulIds, numberOfPeople, req)
        }

        return { success: false, error: 'Not enough capacity available' }
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
  async releaseSpots(
    sessionIds: number[], 
    numberOfPeople: number,
    req?: PayloadRequest
  ): Promise<void> {
    if (sessionIds.length === 0) return
    
    const payload = req?.payload || this.payload

    try {
      const sessions = await payload.find({
        collection: 'sessions',
        where: { id: { in: sessionIds } },
        limit: sessionIds.length,
        req,
      })

      const updatePromises = sessions.docs.map((session) => {
        const currentSpots = session.availableSpots ?? 0
        return payload.update({
          collection: 'sessions',
          id: session.id,
          data: { availableSpots: currentSpots + numberOfPeople },
          req,
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
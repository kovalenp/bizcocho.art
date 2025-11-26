import type { Payload } from 'payload'

export type ReservationResult = {
  success: boolean
  error?: string
  reservedSpots?: number
}

export type CapacityInfo = {
  sessionId: string | number
  availableSpots: number
  maxCapacity: number
}

/**
 * Centralized service for managing session capacity.
 * Handles reservations, confirmations, and releases with proper error handling.
 */
export class CapacityService {
  constructor(private payload: Payload) {}

  /**
   * Reserve spots on a single session (for class bookings).
   * Uses verify-and-rollback pattern to prevent overbooking.
   */
  async reserveClassSpots(
    sessionId: string | number,
    numberOfPeople: number
  ): Promise<ReservationResult> {
    try {
      // Fetch current session state
      const session = await this.payload.findByID({
        collection: 'sessions',
        id: sessionId,
      })

      if (!session) {
        return { success: false, error: 'Session not found' }
      }

      const currentSpots = session.availableSpots ?? 0

      if (numberOfPeople > currentSpots) {
        return { success: false, error: 'Not enough capacity available' }
      }

      // Decrement spots
      const newSpots = currentSpots - numberOfPeople

      await this.payload.update({
        collection: 'sessions',
        id: sessionId,
        data: { availableSpots: newSpots },
      })

      // Verify update (check for race condition)
      const verifiedSession = await this.payload.findByID({
        collection: 'sessions',
        id: sessionId,
      })

      if (verifiedSession.availableSpots != null && verifiedSession.availableSpots < 0) {
        // Rollback
        await this.payload.update({
          collection: 'sessions',
          id: sessionId,
          data: { availableSpots: verifiedSession.availableSpots + numberOfPeople },
        })
        return { success: false, error: 'Race condition detected - please try again' }
      }

      return { success: true, reservedSpots: numberOfPeople }
    } catch (error) {
      console.error('Failed to reserve class spots:', error)
      return { success: false, error: 'Failed to reserve spots' }
    }
  }

  /**
   * Reserve spots on all sessions for a course (for course enrollments).
   * Uses verify-and-rollback pattern to prevent overbooking.
   */
  async reserveCourseSpots(
    courseId: string | number,
    numberOfPeople: number
  ): Promise<ReservationResult> {
    try {
      // Fetch all course sessions
      const sessions = await this.payload.find({
        collection: 'sessions',
        where: {
          course: { equals: courseId },
          status: { equals: 'scheduled' },
        },
        limit: 100,
      })

      if (sessions.docs.length === 0) {
        return { success: false, error: 'No sessions available for this course' }
      }

      // Check minimum capacity across all sessions
      const minAvailable = Math.min(
        ...sessions.docs.map(s => s.availableSpots ?? 0)
      )

      if (numberOfPeople > minAvailable) {
        return { success: false, error: 'Not enough capacity available' }
      }

      // Decrement all sessions
      const updatePromises = sessions.docs.map(session => {
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
        where: {
          course: { equals: courseId },
          status: { equals: 'scheduled' },
        },
        limit: 100,
      })

      const hasNegative = verifiedSessions.docs.some(
        s => s.availableSpots != null && s.availableSpots < 0
      )

      if (hasNegative) {
        // Rollback all
        const rollbackPromises = verifiedSessions.docs.map(session => {
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
      console.error('Failed to reserve course spots:', error)
      return { success: false, error: 'Failed to reserve spots' }
    }
  }

  /**
   * Release reserved spots on a single session (for class booking cancellation/expiry).
   */
  async releaseClassSpots(
    sessionId: string | number,
    numberOfPeople: number
  ): Promise<void> {
    try {
      const session = await this.payload.findByID({
        collection: 'sessions',
        id: sessionId,
      }).catch(() => null)

      if (session) {
        const currentSpots = session.availableSpots ?? 0
        await this.payload.update({
          collection: 'sessions',
          id: sessionId,
          data: { availableSpots: currentSpots + numberOfPeople },
        })
      }
    } catch (error) {
      console.error('Failed to release class spots:', error)
    }
  }

  /**
   * Release reserved spots on all course sessions (for course booking cancellation/expiry).
   */
  async releaseCourseSpots(
    courseId: string | number,
    numberOfPeople: number
  ): Promise<void> {
    try {
      const sessions = await this.payload.find({
        collection: 'sessions',
        where: { course: { equals: courseId } },
        limit: 100,
      })

      const updatePromises = sessions.docs.map(session => {
        const currentSpots = session.availableSpots ?? 0
        return this.payload.update({
          collection: 'sessions',
          id: session.id,
          data: { availableSpots: currentSpots + numberOfPeople },
        })
      })

      await Promise.all(updatePromises)
    } catch (error) {
      console.error('Failed to release course spots:', error)
    }
  }

  /**
   * Get availability info for a session.
   */
  async getSessionAvailability(sessionId: string | number): Promise<CapacityInfo | null> {
    try {
      const session = await this.payload.findByID({
        collection: 'sessions',
        id: sessionId,
        depth: 1,
      })

      if (!session) return null

      // Get max capacity from parent class/course
      let maxCapacity = 0
      if (session.sessionType === 'class' && session.class) {
        const classDoc = typeof session.class === 'object'
          ? session.class
          : await this.payload.findByID({ collection: 'classes', id: session.class })
        maxCapacity = classDoc?.maxCapacity ?? 0
      } else if (session.sessionType === 'course' && session.course) {
        const courseDoc = typeof session.course === 'object'
          ? session.course
          : await this.payload.findByID({ collection: 'courses', id: session.course })
        maxCapacity = courseDoc?.maxCapacity ?? 0
      }

      return {
        sessionId: session.id,
        availableSpots: session.availableSpots ?? maxCapacity,
        maxCapacity,
      }
    } catch (error) {
      console.error('Failed to get session availability:', error)
      return null
    }
  }

  /**
   * Get availability info for all course sessions.
   */
  async getCourseAvailability(courseId: string | number): Promise<CapacityInfo[]> {
    try {
      const sessions = await this.payload.find({
        collection: 'sessions',
        where: {
          course: { equals: courseId },
          status: { equals: 'scheduled' },
        },
        sort: 'startDateTime',
        limit: 100,
      })

      const course = await this.payload.findByID({
        collection: 'courses',
        id: courseId,
      })

      const maxCapacity = course?.maxCapacity ?? 0

      return sessions.docs.map(session => ({
        sessionId: session.id,
        availableSpots: session.availableSpots ?? maxCapacity,
        maxCapacity,
      }))
    } catch (error) {
      console.error('Failed to get course availability:', error)
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

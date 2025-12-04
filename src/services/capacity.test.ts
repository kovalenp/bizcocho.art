import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CapacityService, createCapacityService } from './capacity'
import type { Payload } from 'payload'
import type { ReservationResult } from './capacity'

/**
 * Unit tests for CapacityService (Atomic SQL operations)
 *
 * Test Coverage:
 * - reserveSpots: Atomic success, insufficient capacity (atomic failure), partial failure & rollback, DB errors
 * - releaseSpots: Success (single/multiple), empty array, errors
 * - getAvailability: Success (single/multiple), not found, errors
 * - getClassSessionIds: Success, empty result, errors
 * - createCapacityService: Factory function
 */

// Mock logger
vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}))

// Mock SQL helper
vi.mock('@payloadcms/db-postgres', () => {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    toQuery: () => 'mock-query'
  })
  // Attach static method to the function
  ;(sql as typeof sql & { identifier: (val: string) => string }).identifier = (val: string) => `"${val}"`

  return { sql }
})

interface MockPayload {
  findByID: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  db: {
    drizzle?: {
      execute: ReturnType<typeof vi.fn>
    }
    tableNameMap?: Map<string, string>
  }
}

describe('CapacityService', () => {
  let mockPayload: MockPayload
  let mockDrizzleExecute: ReturnType<typeof vi.fn>
  let service: CapacityService

  beforeEach(() => {
    mockDrizzleExecute = vi.fn()
    
    mockPayload = {
      findByID: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
      db: {
        drizzle: {
          execute: mockDrizzleExecute,
        },
        tableNameMap: new Map([['sessions', 'sessions_table']]),
      },
    }
    service = new CapacityService(mockPayload as unknown as Payload)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('reserveSpots', () => {
    it('should return error when no sessions provided', async () => {
      const result = await service.reserveSpots([], 2)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'No sessions provided',
      })
      expect(mockPayload.find).not.toHaveBeenCalled()
    })

    it('should successfully reserve spots for a single session using atomic update', async () => {
      // Mock finding the session
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 1, availableSpots: 10 }],
      })

      // Mock successful atomic update (returns row ID)
      mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 1 }] })

      const result = await service.reserveSpots([1], 2)

      expect(result).toEqual<ReservationResult>({
        success: true,
        reservedSpots: 2,
      })
      
      // Verify SQL execution
      expect(mockDrizzleExecute).toHaveBeenCalledTimes(1)
      // Verify payload.update was NOT called (since we use raw SQL)
      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('should successfully reserve spots for multiple sessions', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { id: 1, availableSpots: 10 },
          { id: 2, availableSpots: 8 },
        ],
      })

      // Mock successful updates for both
      mockDrizzleExecute
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })

      const result = await service.reserveSpots([1, 2], 2)

      expect(result).toEqual<ReservationResult>({
        success: true,
        reservedSpots: 2,
      })
      expect(mockDrizzleExecute).toHaveBeenCalledTimes(2)
    })

    it('should fail when atomic update returns no rows (insufficient capacity)', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 1, availableSpots: 1 }],
      })

      // Mock failed update (condition available_spots >= N failed)
      mockDrizzleExecute.mockResolvedValue({ rows: [] })

      const result = await service.reserveSpots([1], 2)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'Not enough capacity available',
      })
    })

    it('should handle partial failure and rollback successful ones', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { id: 1, availableSpots: 10 }, // Has space
          { id: 2, availableSpots: 1 },  // Full
        ],
      })

      // First succeeds, second fails
      mockDrizzleExecute
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })

      // Mock releaseSpots internal call (uses standard payload.update)
      mockPayload.update.mockResolvedValue({})
      
      // Spy on releaseSpots to ensure it's called correctly
      const releaseSpy = vi.spyOn(service, 'releaseSpots')

      const result = await service.reserveSpots([1, 2], 2)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'Not enough capacity available',
      })

      // Should have attempted to rollback session 1
      expect(releaseSpy).toHaveBeenCalledWith([1], 2, undefined)
    })

    it('should return error when session not found in initial check', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 1, availableSpots: 10 }], // Only 1 of 2 found
      })

      const result = await service.reserveSpots([1, 2], 2)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'One or more sessions not found',
      })
      expect(mockDrizzleExecute).not.toHaveBeenCalled()
    })

    it('should handle database adapter missing drizzle', async () => {
      mockPayload.db = {} // No drizzle
      mockPayload.find.mockResolvedValue({ docs: [{ id: 1 }] })

      const result = await service.reserveSpots([1], 2)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'Failed to reserve spots',
      })
    })

    it('should handle database exception in outer scope', async () => {
      mockPayload.find.mockRejectedValue(new Error('DB Connection Failed'))

      const result = await service.reserveSpots([1], 2)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'Failed to reserve spots',
      })
    })

    it('should handle individual atomic update error as capacity failure', async () => {
      mockPayload.find.mockResolvedValue({ docs: [{ id: 1 }] })
      // Mock execute throwing error
      mockDrizzleExecute.mockRejectedValue(new Error('Constraint violation'))

      const result = await service.reserveSpots([1], 2)

      // Service catches individual errors and treats them as failure
      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'Not enough capacity available',
      })
    })
  })

  describe('releaseSpots', () => {
    it('should do nothing when no sessions provided', async () => {
      await service.releaseSpots([], 2)

      expect(mockPayload.find).not.toHaveBeenCalled()
    })

    it('should successfully release spots for a single session', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 1, availableSpots: 5 }],
      })
      mockPayload.update.mockResolvedValue({})

      await service.releaseSpots([1], 2)

      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'sessions',
        id: 1,
        data: { availableSpots: 7 },
        req: undefined,
      })
    })

    it('should successfully release spots for multiple sessions', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { id: 1, availableSpots: 5 },
          { id: 2, availableSpots: 3 },
        ],
      })
      mockPayload.update.mockResolvedValue({})

      await service.releaseSpots([1, 2], 2)

      expect(mockPayload.update).toHaveBeenCalledTimes(2)
    })

    it('should handle exceptions without throwing', async () => {
      mockPayload.find.mockRejectedValue(new Error('Database error'))

      await expect(service.releaseSpots([1], 2)).resolves.toBeUndefined()
    })
  })

  describe('getAvailability', () => {
    it('should return null when no sessions provided', async () => {
      const result = await service.getAvailability([])

      expect(result).toBeNull()
    })

    it('should return availability info for a single session', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            id: 1,
            availableSpots: 8,
            class: { id: 100, maxCapacity: 15 },
          },
        ],
      })

      const result = await service.getAvailability([1])

      expect(result).toEqual({
        minAvailable: 8,
        sessions: [
          { sessionId: 1, availableSpots: 8, maxCapacity: 15 },
        ],
      })
    })

    it('should return minimum availability across multiple sessions', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { id: 1, availableSpots: 8, class: { id: 100, maxCapacity: 15 } },
          { id: 2, availableSpots: 10, class: { id: 100, maxCapacity: 15 } },
          { id: 3, availableSpots: 6, class: { id: 100, maxCapacity: 15 } },
        ],
      })

      const result = await service.getAvailability([1, 2, 3])

      expect(result?.minAvailable).toBe(6)
      expect(result?.sessions).toHaveLength(3)
    })

    it('should fetch class document when class is an ID', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { id: 1, availableSpots: 5, class: 100 }, // ID instead of object
        ],
      })

      mockPayload.findByID.mockResolvedValue({ id: 100, maxCapacity: 15 })

      const result = await service.getAvailability([1])

      expect(result?.sessions[0].maxCapacity).toBe(15)
      expect(mockPayload.findByID).toHaveBeenCalledWith({
        collection: 'classes',
        id: 100,
      })
    })

    it('should use maxCapacity when availableSpots is null', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            id: 1,
            availableSpots: null,
            class: { id: 100, maxCapacity: 15 },
          },
        ],
      })

      const result = await service.getAvailability([1])

      expect(result?.sessions[0].availableSpots).toBe(15)
    })

    it('should return null when no sessions found', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result = await service.getAvailability([999])

      expect(result).toBeNull()
    })

    it('should return null on exception', async () => {
      mockPayload.find.mockRejectedValue(new Error('DB error'))

      const result = await service.getAvailability([1])

      expect(result).toBeNull()
    })

    it('should handle missing class with zero maxCapacity', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 1, availableSpots: 5, class: null }],
      })

      const result = await service.getAvailability([1])

      expect(result?.sessions[0].maxCapacity).toBe(0)
    })
  })

  describe('getClassSessionIds', () => {
    it('should return session IDs for a class', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 1 }, { id: 2 }, { id: 3 }],
      })

      const result = await service.getClassSessionIds(100)

      expect(result).toEqual([1, 2, 3])
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'sessions',
        where: {
          class: { equals: 100 },
          status: { equals: 'scheduled' },
        },
        limit: 100,
      })
    })

    it('should return empty array when no sessions exist', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result = await service.getClassSessionIds(999)

      expect(result).toEqual([])
    })

    it('should return empty array on exception', async () => {
      mockPayload.find.mockRejectedValue(new Error('DB error'))

      const result = await service.getClassSessionIds(100)

      expect(result).toEqual([])
    })
  })

  describe('createCapacityService', () => {
    it('should create a CapacityService instance', () => {
      const mockPayload = {} as Payload

      const service = createCapacityService(mockPayload)

      expect(service).toBeInstanceOf(CapacityService)
    })
  })
})

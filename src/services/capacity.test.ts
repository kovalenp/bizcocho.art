import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CapacityService, createCapacityService } from './capacity'
import type { Payload } from 'payload'
import type { ReservationResult, CapacityInfo } from './capacity'

/**
 * Unit tests for CapacityService (unified API)
 *
 * Test Coverage:
 * - reserveSpots: Success (single/multiple), not found, insufficient capacity, race conditions, errors
 * - releaseSpots: Success (single/multiple), empty array, errors
 * - getAvailability: Success (single/multiple), not found, errors
 * - getClassSessionIds: Success, empty result, errors
 * - createCapacityService: Factory function
 */

// Mock logger to prevent console output during tests
vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}))

describe('CapacityService', () => {
  let mockPayload: {
    findByID: ReturnType<typeof vi.fn>
    find: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  let service: CapacityService

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
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

    it('should successfully reserve spots for a single session', async () => {
      const sessionId = 123
      const numberOfPeople = 2

      mockPayload.find
        .mockResolvedValueOnce({
          docs: [{ id: sessionId, availableSpots: 10 }],
        } as any) // Initial fetch
        .mockResolvedValueOnce({
          docs: [{ id: sessionId, availableSpots: 8 }],
        } as any) // Verification fetch

      mockPayload.update.mockResolvedValue({} as any)

      const result = await service.reserveSpots([sessionId], numberOfPeople)

      expect(result).toEqual<ReservationResult>({
        success: true,
        reservedSpots: 2,
      })

      expect(mockPayload.find).toHaveBeenCalledTimes(2)
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'sessions',
        id: sessionId,
        data: { availableSpots: 8 },
      })
    })

    it('should successfully reserve spots for multiple sessions', async () => {
      const sessionIds = [1, 2, 3]
      const numberOfPeople = 2

      mockPayload.find
        .mockResolvedValueOnce({
          docs: [
            { id: 1, availableSpots: 10 },
            { id: 2, availableSpots: 12 },
            { id: 3, availableSpots: 8 },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            { id: 1, availableSpots: 8 },
            { id: 2, availableSpots: 10 },
            { id: 3, availableSpots: 6 },
          ],
        } as any)

      mockPayload.update.mockResolvedValue({} as any)

      const result = await service.reserveSpots(sessionIds, numberOfPeople)

      expect(result).toEqual<ReservationResult>({
        success: true,
        reservedSpots: 2,
      })

      expect(mockPayload.update).toHaveBeenCalledTimes(3)
    })

    it('should return error when one or more sessions not found', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 1, availableSpots: 10 }], // Only 1 of 2 found
      } as any)

      const result = await service.reserveSpots([1, 2], 2)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'One or more sessions not found',
      })

      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('should return error when minimum capacity is insufficient', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { id: 1, availableSpots: 10 },
          { id: 2, availableSpots: 3 }, // Minimum is 3
          { id: 3, availableSpots: 8 },
        ],
      } as any)

      const result = await service.reserveSpots([1, 2, 3], 5)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'Not enough capacity available',
      })

      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('should handle null availableSpots as zero', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 1, availableSpots: null }],
      } as any)

      const result = await service.reserveSpots([1], 1)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'Not enough capacity available',
      })
    })

    it('should detect race condition and rollback when spots go negative', async () => {
      mockPayload.find
        .mockResolvedValueOnce({
          docs: [
            { id: 1, availableSpots: 10 },
            { id: 2, availableSpots: 10 },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            { id: 1, availableSpots: 8 },
            { id: 2, availableSpots: -1 }, // Race condition!
          ],
        } as any)

      mockPayload.update.mockResolvedValue({} as any)

      const result = await service.reserveSpots([1, 2], 2)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'Race condition detected - please try again',
      })

      // 2 initial decrements + 2 rollbacks = 4 updates
      expect(mockPayload.update).toHaveBeenCalledTimes(4)
    })

    it('should handle exceptions and return error', async () => {
      mockPayload.find.mockRejectedValue(new Error('Database error'))

      const result = await service.reserveSpots([1], 2)

      expect(result).toEqual<ReservationResult>({
        success: false,
        error: 'Failed to reserve spots',
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
        docs: [{ id: 1, availableSpots: 8 }],
      } as any)

      mockPayload.update.mockResolvedValue({} as any)

      await service.releaseSpots([1], 2)

      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'sessions',
        id: 1,
        data: { availableSpots: 10 },
      })
    })

    it('should successfully release spots for multiple sessions', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { id: 1, availableSpots: 8 },
          { id: 2, availableSpots: 10 },
          { id: 3, availableSpots: 6 },
        ],
      } as any)

      mockPayload.update.mockResolvedValue({} as any)

      await service.releaseSpots([1, 2, 3], 2)

      expect(mockPayload.update).toHaveBeenCalledTimes(3)
      expect(mockPayload.update).toHaveBeenNthCalledWith(1, {
        collection: 'sessions',
        id: 1,
        data: { availableSpots: 10 },
      })
    })

    it('should handle null availableSpots as zero', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 1, availableSpots: null }],
      } as any)

      mockPayload.update.mockResolvedValue({} as any)

      await service.releaseSpots([1], 5)

      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'sessions',
        id: 1,
        data: { availableSpots: 5 },
      })
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
      } as any)

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
      } as any)

      const result = await service.getAvailability([1, 2, 3])

      expect(result?.minAvailable).toBe(6)
      expect(result?.sessions).toHaveLength(3)
    })

    it('should fetch class document when class is an ID', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { id: 1, availableSpots: 5, class: 100 }, // ID instead of object
        ],
      } as any)

      mockPayload.findByID.mockResolvedValue({ id: 100, maxCapacity: 15 } as any)

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
      } as any)

      const result = await service.getAvailability([1])

      expect(result?.sessions[0].availableSpots).toBe(15)
    })

    it('should return null when no sessions found', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] } as any)

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
      } as any)

      const result = await service.getAvailability([1])

      expect(result?.sessions[0].maxCapacity).toBe(0)
    })
  })

  describe('getClassSessionIds', () => {
    it('should return session IDs for a class', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 1 }, { id: 2 }, { id: 3 }],
      } as any)

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
      mockPayload.find.mockResolvedValue({ docs: [] } as any)

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

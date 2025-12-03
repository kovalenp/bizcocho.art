import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SessionManagementService,
  createSessionManagementService,
  ScheduleConfig,
  ClassConfig,
} from './session-manager'
import type { Payload } from 'payload'

// Mock logger to prevent console output during tests
vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}))

describe('SessionManagementService', () => {
  let mockPayload: {
    find: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  let service: SessionManagementService

  beforeEach(() => {
    mockPayload = {
      find: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    }
    service = new SessionManagementService(mockPayload as unknown as Payload)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('hasScheduleChanged', () => {
    const baseSchedule: ScheduleConfig = {
      startDate: '2024-01-01',
      endDate: '2024-03-31',
      recurrence: 'weekly',
      daysOfWeek: ['1', '3'],
      startTime: '18:00',
      timezone: 'Europe/Madrid',
    }

    it('should return true when old schedule is null', () => {
      expect(service.hasScheduleChanged(baseSchedule, null)).toBe(true)
    })

    it('should return true when old schedule is undefined', () => {
      expect(service.hasScheduleChanged(baseSchedule, undefined)).toBe(true)
    })

    it('should return true when new schedule is null but old exists', () => {
      expect(service.hasScheduleChanged(null, baseSchedule)).toBe(true)
    })

    it('should return false when schedules are identical', () => {
      expect(service.hasScheduleChanged(baseSchedule, { ...baseSchedule })).toBe(false)
    })

    it('should detect startDate change', () => {
      const newSchedule = { ...baseSchedule, startDate: '2024-02-01' }
      expect(service.hasScheduleChanged(newSchedule, baseSchedule)).toBe(true)
    })

    it('should detect endDate change', () => {
      const newSchedule = { ...baseSchedule, endDate: '2024-06-30' }
      expect(service.hasScheduleChanged(newSchedule, baseSchedule)).toBe(true)
    })

    it('should detect recurrence change', () => {
      const newSchedule = { ...baseSchedule, recurrence: 'biweekly' as const }
      expect(service.hasScheduleChanged(newSchedule, baseSchedule)).toBe(true)
    })

    it('should detect daysOfWeek change', () => {
      const newSchedule = { ...baseSchedule, daysOfWeek: ['1', '2', '3'] }
      expect(service.hasScheduleChanged(newSchedule, baseSchedule)).toBe(true)
    })

    it('should detect startTime change', () => {
      const newSchedule = { ...baseSchedule, startTime: '19:00' }
      expect(service.hasScheduleChanged(newSchedule, baseSchedule)).toBe(true)
    })

    it('should detect timezone change', () => {
      const newSchedule = { ...baseSchedule, timezone: 'America/New_York' }
      expect(service.hasScheduleChanged(newSchedule, baseSchedule)).toBe(true)
    })

    it('should detect maxCapacity change via classConfig', () => {
      const oldConfig: ClassConfig = { maxCapacity: 8, type: 'class' }
      const newConfig: ClassConfig = { maxCapacity: 10, type: 'class' }
      expect(service.hasScheduleChanged(baseSchedule, baseSchedule, newConfig, oldConfig)).toBe(true)
    })

    it('should detect type change via classConfig', () => {
      const oldConfig: ClassConfig = { maxCapacity: 8, type: 'class' }
      const newConfig: ClassConfig = { maxCapacity: 8, type: 'course' }
      expect(service.hasScheduleChanged(baseSchedule, baseSchedule, newConfig, oldConfig)).toBe(true)
    })
  })

  describe('getSessionDates', () => {
    it('should generate weekly sessions', () => {
      const schedule: ScheduleConfig = {
        startDate: '2024-01-01', // Monday
        endDate: '2024-01-15',
        recurrence: 'weekly',
        daysOfWeek: ['1'], // Monday
        startTime: '18:00',
        timezone: 'Europe/Madrid',
      }

      const dates = service.getSessionDates(schedule)

      expect(dates.length).toBe(3) // Jan 1, 8, 15
    })

    it('should generate biweekly sessions', () => {
      const schedule: ScheduleConfig = {
        startDate: '2024-01-01', // Monday
        endDate: '2024-01-29',
        recurrence: 'biweekly',
        daysOfWeek: ['1'], // Monday
        startTime: '18:00',
        timezone: 'Europe/Madrid',
      }

      const dates = service.getSessionDates(schedule)

      // Jan 1 (week 0), Jan 15 (week 2), Jan 29 (week 4) - all biweekly
      expect(dates.length).toBe(3)
    })

    it('should handle multiple days per week', () => {
      const schedule: ScheduleConfig = {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        recurrence: 'weekly',
        daysOfWeek: ['1', '3', '5'], // Mon, Wed, Fri
        startTime: '18:00',
        timezone: 'Europe/Madrid',
      }

      const dates = service.getSessionDates(schedule)

      expect(dates.length).toBe(3) // Mon 1, Wed 3, Fri 5
    })

    it('should default to 3 months when endDate not specified', () => {
      const schedule: ScheduleConfig = {
        startDate: '2024-01-01',
        endDate: null,
        recurrence: 'weekly',
        daysOfWeek: ['1'], // Monday
        startTime: '18:00',
        timezone: 'Europe/Madrid',
      }

      const dates = service.getSessionDates(schedule)

      // Should have ~13 Mondays in 3 months
      expect(dates.length).toBeGreaterThanOrEqual(12)
      expect(dates.length).toBeLessThanOrEqual(14)
    })

    it('should return empty array when no matching days', () => {
      const schedule: ScheduleConfig = {
        startDate: '2024-01-01', // Monday
        endDate: '2024-01-01',
        recurrence: 'weekly',
        daysOfWeek: ['0'], // Sunday
        startTime: '18:00',
        timezone: 'Europe/Madrid',
      }

      const dates = service.getSessionDates(schedule)

      expect(dates.length).toBe(0)
    })
  })

  describe('hasActiveBookings', () => {
    it('should return false when no sessions exist', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result = await service.hasActiveBookings(1)

      expect(result).toBe(false)
      expect(mockPayload.find).toHaveBeenCalledTimes(1)
    })

    it('should return false when no active bookings', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }] }) // sessions
        .mockResolvedValueOnce({ docs: [], totalDocs: 0 }) // bookings

      const result = await service.hasActiveBookings(1)

      expect(result).toBe(false)
    })

    it('should return true when active bookings exist', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }] }) // sessions
        .mockResolvedValueOnce({ docs: [{ id: 100 }], totalDocs: 1 }) // bookings

      const result = await service.hasActiveBookings(1)

      expect(result).toBe(true)
    })

    it('should check for pending and confirmed bookings', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [{ id: 1 }] })
        .mockResolvedValueOnce({ docs: [], totalDocs: 0 })

      await service.hasActiveBookings(1)

      expect(mockPayload.find).toHaveBeenNthCalledWith(2, {
        collection: 'bookings',
        where: {
          sessions: { in: [1] },
          status: { in: ['pending', 'confirmed'] },
        },
        limit: 1,
      })
    })

    it('should return false on error', async () => {
      mockPayload.find.mockRejectedValue(new Error('DB error'))

      const result = await service.hasActiveBookings(1)

      expect(result).toBe(false)
    })
  })

  describe('deleteSessions', () => {
    it('should delete sessions when no bookings', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [] }) // hasActiveBookings - sessions
        .mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }] }) // find sessions to delete

      mockPayload.delete.mockResolvedValue({ docs: [] })

      const result = await service.deleteSessions(1)

      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(2)
    })

    it('should fail when active bookings exist', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [{ id: 1 }] }) // sessions
        .mockResolvedValueOnce({ docs: [{ id: 100 }], totalDocs: 1 }) // bookings

      const result = await service.deleteSessions(1)

      expect(result.success).toBe(false)
      expect(result.error).toContain('active bookings exist')
      expect(mockPayload.delete).not.toHaveBeenCalled()
    })

    it('should skip booking check when force=true', async () => {
      mockPayload.find.mockResolvedValueOnce({ docs: [{ id: 1 }] })
      mockPayload.delete.mockResolvedValue({ docs: [] })

      const result = await service.deleteSessions(1, { force: true })

      expect(result.success).toBe(true)
      // Only 1 find call for sessions, not 2 for booking check
      expect(mockPayload.find).toHaveBeenCalledTimes(1)
    })

    it('should return success with 0 count when no sessions exist', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [] }) // hasActiveBookings
        .mockResolvedValueOnce({ docs: [] }) // find sessions

      const result = await service.deleteSessions(1)

      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(0)
      expect(mockPayload.delete).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockPayload.find.mockRejectedValue(new Error('DB error'))

      const result = await service.deleteSessions(1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to delete sessions')
    })
  })

  describe('generateSessions', () => {
    const validSchedule: ScheduleConfig = {
      startDate: '2024-01-01',
      endDate: '2024-01-08',
      recurrence: 'weekly',
      daysOfWeek: ['1'], // Monday
      startTime: '18:00',
      timezone: 'Europe/Madrid',
    }

    const validConfig: ClassConfig = {
      maxCapacity: 8,
      type: 'class',
    }

    it('should generate sessions successfully', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [] }) // hasActiveBookings
        .mockResolvedValueOnce({ docs: [] }) // deleteSessions find

      mockPayload.create
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })

      const result = await service.generateSessions(1, validSchedule, validConfig)

      expect(result.success).toBe(true)
      expect(result.sessionCount).toBe(2) // Jan 1 and Jan 8
      expect(result.sessionIds).toEqual([1, 2])
    })

    it('should fail when schedule is incomplete', async () => {
      const incompleteSchedule = { ...validSchedule, startDate: '' }

      const result = await service.generateSessions(1, incompleteSchedule as ScheduleConfig, validConfig)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Incomplete schedule configuration')
    })

    it('should fail when daysOfWeek is empty', async () => {
      const noSchedule = { ...validSchedule, daysOfWeek: [] }

      const result = await service.generateSessions(1, noSchedule, validConfig)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Incomplete schedule configuration')
    })

    it('should fail when no session dates can be generated', async () => {
      const badSchedule = {
        ...validSchedule,
        startDate: '2024-01-01', // Monday
        endDate: '2024-01-01',
        daysOfWeek: ['0'], // Sunday - no match
      }

      const result = await service.generateSessions(1, badSchedule, validConfig)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No session dates generated')
    })

    it('should fail when active bookings prevent deletion', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [{ id: 1 }] }) // sessions
        .mockResolvedValueOnce({ docs: [{ id: 100 }], totalDocs: 1 }) // bookings

      const result = await service.generateSessions(1, validSchedule, validConfig)

      expect(result.success).toBe(false)
      expect(result.error).toContain('active bookings exist')
    })

    it('should create sessions with correct data', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })

      mockPayload.create.mockResolvedValue({ id: 1 })

      await service.generateSessions(1, validSchedule, validConfig)

      expect(mockPayload.create).toHaveBeenCalledWith({
        collection: 'sessions',
        data: expect.objectContaining({
          sessionType: 'class',
          class: 1,
          timezone: 'Europe/Madrid',
          status: 'scheduled',
          availableSpots: 8,
        }),
      })
    })

    it('should handle errors during creation', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })

      mockPayload.create.mockRejectedValue(new Error('DB error'))

      const result = await service.generateSessions(1, validSchedule, validConfig)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to generate sessions')
    })
  })

  describe('createSessionManagementService', () => {
    it('should create a SessionManagementService instance', () => {
      const mockPayload = {} as Payload

      const service = createSessionManagementService(mockPayload)

      expect(service).toBeInstanceOf(SessionManagementService)
    })
  })
})

import { beforeAll, afterEach, afterAll } from 'vitest'

/**
 * Vitest global setup
 * Runs once before all tests and cleanup after all tests
 */

beforeAll(() => {
  // Setup global test environment
  // Could initialize test database, mock services, etc.
})

afterEach(() => {
  // Reset mocks after each test to prevent test pollution
  // vi.clearAllMocks() is typically called in individual test files
})

afterAll(() => {
  // Cleanup after all tests
  // Close database connections, cleanup test data, etc.
})

# Testing Guide

## Overview

This project uses **Vitest** for unit testing. The testing strategy follows production-grade practices with comprehensive coverage, type safety, and fast execution.

## Test Structure

```
bizcocho.art/
├── src/
│   ├── services/
│   │   ├── capacity.ts
│   │   └── capacity.test.ts          # Unit tests
│   └── ...
├── vitest.config.mts                   # Vitest configuration
└── vitest.setup.ts                     # Global test setup
```

## Running Tests

```bash
# Run all tests
pnpm test

# Watch mode (re-runs on file changes)
pnpm test:watch

# With coverage report
pnpm test:coverage

# Run specific test file
pnpm test src/services/capacity.test.ts
```

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { YourService } from './your-service'

// Mock dependencies
vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
}))

describe('YourService', () => {
  let service: YourService
  let mockDependency: MockType

  beforeEach(() => {
    // Fresh mocks for each test
    mockDependency = createMock()
    service = new YourService(mockDependency)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('methodName', () => {
    it('should do something when condition is met', async () => {
      // Arrange
      const input = 'test'
      vi.mocked(mockDependency.method).mockResolvedValue('result')

      // Act
      const result = await service.methodName(input)

      // Assert
      expect(result).toBe('expected')
      expect(mockDependency.method).toHaveBeenCalledWith(input)
    })

    it('should handle errors gracefully', async () => {
      // Arrange
      vi.mocked(mockDependency.method).mockRejectedValue(new Error('Test error'))

      // Act & Assert
      await expect(service.methodName('test')).rejects.toThrow('Test error')
    })
  })
})
```

### Test Best Practices

#### 1. AAA Pattern (Arrange-Act-Assert)
Always structure tests with clear sections:
```typescript
it('should reserve spots successfully', async () => {
  // Arrange - Set up test data and mocks
  const sessionId = 123
  const numberOfPeople = 2
  mockPayload.findByID.mockResolvedValue({ availableSpots: 10 })

  // Act - Execute the function
  const result = await service.reserveClassSpots(sessionId, numberOfPeople)

  // Assert - Verify the outcome
  expect(result.success).toBe(true)
})
```

#### 2. Descriptive Test Names
Use clear, descriptive names that explain the scenario:
```typescript
✅ it('should return error when session is not found', ...)
✅ it('should detect race condition and rollback when spots go negative', ...)
❌ it('test session', ...)
❌ it('works correctly', ...)
```

#### 3. One Concept Per Test
Each test should verify one specific behavior:
```typescript
✅ Good - Tests one thing
it('should reserve spots when capacity is available', ...)
it('should return error when not enough capacity', ...)

❌ Bad - Tests multiple things
it('should handle reservations', ...)
```

#### 4. Mock Isolation
Ensure mocks don't leak between tests:
```typescript
beforeEach(() => {
  // Fresh mocks for each test
  mockPayload = createMockPayload()
})

afterEach(() => {
  vi.clearAllMocks()
})
```

#### 5. Type Safety
Use explicit types for better IDE support and type checking:
```typescript
expect(result).toEqual<ReservationResult>({
  success: true,
  reservedSpots: 2,
})
```

## Viewing Coverage

```bash
# Generate coverage report
pnpm test:coverage

# Open HTML report
open coverage/index.html
```

## Testing Strategy

### Unit Tests
- Test individual functions/classes in isolation
- Mock all external dependencies (Payload, services, etc.)
- Fast execution (< 1s per test suite)
- Located next to source files (`*.test.ts`)
- 100% TypeScript with type-safe mocks

**What to test:**
- Business logic and algorithms
- Edge cases and error handling
- Null/undefined handling
- Type coercion
- Race conditions
- Exception handling

## Common Testing Scenarios

### Testing Async Functions

```typescript
it('should handle async operations', async () => {
  const result = await service.asyncMethod()
  expect(result).toBeDefined()
})
```

### Testing Error Cases

```typescript
it('should handle errors gracefully', async () => {
  mockDependency.method.mockRejectedValue(new Error('Test error'))

  const result = await service.method()

  expect(result.success).toBe(false)
  expect(result.error).toBe('Failed to...')
})
```

### Testing Race Conditions

```typescript
it('should detect race condition and rollback', async () => {
  mockPayload.findByID
    .mockResolvedValueOnce({ availableSpots: 10 })  // Initial
    .mockResolvedValueOnce({ availableSpots: -1 })  // After update

  const result = await service.reserveSpots(1, 2)

  expect(result.error).toBe('Race condition detected')
  expect(mockPayload.update).toHaveBeenCalledTimes(2) // Decrement + rollback
})
```

### Creating Mocks

```typescript
describe('YourService', () => {
  let mockPayload: {
    findByID: ReturnType<typeof vi.fn>
    find: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
    }
  })

  it('should use mock methods', async () => {
    mockPayload.find.mockResolvedValue({ docs: [] })
    // ... test logic
  })
})
```

## Debugging Tests

### VSCode Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Vitest Tests",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test:unit", "--", "--run", "--testNamePattern", "${input:testName}"],
      "console": "integratedTerminal"
    }
  ],
  "inputs": [
    {
      "id": "testName",
      "type": "promptString",
      "description": "Test name pattern"
    }
  ]
}
```

### Console Debugging

```typescript
it('debug test', () => {
  const result = service.method()
  console.log('Result:', result) // Will show in test output
})
```

### Only Run Specific Tests

```typescript
// Run only this test
it.only('should test specific case', ...)

// Skip this test
it.skip('should test later', ...)
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Pre-deployment checks

### GitHub Actions Example

```yaml
name: Tests
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: pnpm install
      - run: pnpm test:coverage
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Test-Driven Development Guide](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

## FAQ

**Q: How do I mock Payload CMS?**
A: Create typed mocks with explicit method signatures. See `capacity.test.ts` for examples.

**Q: Should I test React components?**
A: Yes, when needed. Use React Testing Library and focus on user interactions.

**Q: How do I handle async operations in tests?**
A: Always use `async/await` and ensure promises resolve before assertions run.

**Q: What should I prioritize testing?**
A: Focus on business logic, edge cases, and error handling. Services and utilities are higher priority than UI components.

import { jest } from '@jest/globals'

// Global test setup
beforeAll(() => {
  // Suppress console.log during tests unless explicitly needed
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  
  // Mock ora spinner to prevent spinner output during tests
  jest.mock('ora', () => {
    return jest.fn(() => ({
      start: jest.fn().mockReturnThis(),
      stop: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis()
    }))
  })
})

afterAll(() => {
  jest.restoreAllMocks()
})

// Helper to restore console for specific tests
export function restoreConsole() {
  jest.restoreAllMocks()
}

// Helper to capture console output
export function captureConsoleOutput() {
  const logs: string[] = []
  const warns: string[] = []
  const errors: string[] = []
  
  jest.spyOn(console, 'log').mockImplementation((...args) => {
    logs.push(args.join(' '))
  })
  
  jest.spyOn(console, 'warn').mockImplementation((...args) => {
    warns.push(args.join(' '))
  })
  
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    errors.push(args.join(' '))
  })
  
  return { logs, warns, errors }
}

// Helper to mock process.exit
export function mockProcessExit() {
  const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit() was called')
  })
  
  return mockExit
}
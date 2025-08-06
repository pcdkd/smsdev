import { jest } from '@jest/globals'

export class MockStartModule {
  startSmsDevServer = jest.fn()
  
  constructor() {
    // Default implementations
    this.startSmsDevServer.mockResolvedValue(undefined)
  }
  
  reset() {
    this.startSmsDevServer.mockReset()
    
    // Reset to default implementation
    this.startSmsDevServer.mockResolvedValue(undefined)
  }
  
  // Helper methods for common mock scenarios
  mockStartSuccess() {
    this.startSmsDevServer.mockResolvedValue(undefined)
  }
  
  mockStartError(error: Error) {
    this.startSmsDevServer.mockRejectedValue(error)
  }
}
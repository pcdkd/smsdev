import { jest } from '@jest/globals'

export class MockStopModule {
  stopSmsDevServer = jest.fn()
  
  constructor() {
    // Default implementations
    this.stopSmsDevServer.mockResolvedValue(undefined)
  }
  
  reset() {
    this.stopSmsDevServer.mockReset()
    
    // Reset to default implementation
    this.stopSmsDevServer.mockResolvedValue(undefined)
  }
  
  // Helper methods for common mock scenarios
  mockStopSuccess() {
    this.stopSmsDevServer.mockResolvedValue(undefined)
  }
  
  mockStopError(error: Error) {
    this.stopSmsDevServer.mockRejectedValue(error)
  }
}
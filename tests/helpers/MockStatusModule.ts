import { jest } from '@jest/globals'

export class MockStatusModule {
  showStatus = jest.fn()
  
  constructor() {
    // Default implementations
    this.showStatus.mockResolvedValue(undefined)
  }
  
  reset() {
    this.showStatus.mockReset()
    
    // Reset to default implementation
    this.showStatus.mockResolvedValue(undefined)
  }
  
  // Helper methods for common mock scenarios
  mockShowStatusSuccess() {
    this.showStatus.mockResolvedValue(undefined)
  }
  
  mockShowStatusError(error: Error) {
    this.showStatus.mockRejectedValue(error)
  }
}
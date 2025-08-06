import { jest } from '@jest/globals'
import { DEFAULT_TEST_CONFIG, TEST_CONFIG_WITH_WEBHOOK } from '../fixtures/testConfig.js'

export class MockConfigUtils {
  loadConfig = jest.fn()
  printConfig = jest.fn()
  generateSampleConfig = jest.fn()
  
  constructor() {
    // Default implementations
    this.loadConfig.mockReturnValue(DEFAULT_TEST_CONFIG)
    this.printConfig.mockImplementation(() => {})
    this.generateSampleConfig.mockReturnValue('module.exports = { apiPort: 4001 }')
  }
  
  reset() {
    this.loadConfig.mockReset()
    this.printConfig.mockReset()
    this.generateSampleConfig.mockReset()
    
    // Reset to default implementations
    this.loadConfig.mockReturnValue(DEFAULT_TEST_CONFIG)
    this.printConfig.mockImplementation(() => {})
    this.generateSampleConfig.mockReturnValue('module.exports = { apiPort: 4001 }')
  }
  
  // Helper methods for common mock responses
  mockLoadConfigSuccess(config = DEFAULT_TEST_CONFIG) {
    this.loadConfig.mockReturnValue(config)
  }
  
  mockLoadConfigWithWebhook() {
    this.loadConfig.mockReturnValue(TEST_CONFIG_WITH_WEBHOOK)
  }
  
  mockLoadConfigError(error: Error) {
    this.loadConfig.mockImplementation(() => {
      throw error
    })
  }
  
  mockGenerateConfigSuccess(content: string) {
    this.generateSampleConfig.mockReturnValue(content)
  }
  
  mockGenerateConfigError(error: Error) {
    this.generateSampleConfig.mockImplementation(() => {
      throw error
    })
  }
}
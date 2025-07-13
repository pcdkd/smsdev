import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { loadConfig, generateSampleConfig, ConfigOptions } from '../../src/utils/config'

// Default configuration for testing
const DEFAULT_CONFIG = {
  apiPort: 4001,
  uiPort: 4000,
  webhookUrl: undefined,
  cors: {
    enabled: true,
    origins: ['*']
  },
  logging: {
    level: 'info',
    enabled: true
  },
  startUI: true,
  verbose: false
}

describe('Configuration Utility', () => {
  const testConfigPath = join(process.cwd(), 'test-config.js')
  
  beforeEach(() => {
    // Clean up any existing test files
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath)
    }
    
    // Clear environment variables
    delete process.env.SMS_DEV_API_PORT
    delete process.env.SMS_DEV_UI_PORT
    delete process.env.SMS_DEV_WEBHOOK_URL
    delete process.env.SMS_DEV_VERBOSE
    delete process.env.SMS_DEV_NO_UI
  })
  
  afterEach(() => {
    // Clean up test files
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath)
    }
  })

  describe('loadConfig', () => {
    it('should return default configuration when no config file exists', () => {
      const config = loadConfig()
      expect(config).toMatchObject(DEFAULT_CONFIG)
    })

    it('should load JavaScript configuration file', () => {
      const testConfig = {
        apiPort: 5001,
        uiPort: 5000,
        webhookUrl: 'http://test.com/webhook'
      }
      
      writeFileSync(testConfigPath, `module.exports = ${JSON.stringify(testConfig, null, 2)}`)
      
      const config = loadConfig({ configFile: testConfigPath })
      expect(config.apiPort).toBe(5001)
      expect(config.uiPort).toBe(5000)
      expect(config.webhookUrl).toBe('http://test.com/webhook')
    })

    it('should override config with environment variables', () => {
      process.env.SMS_DEV_API_PORT = '7001'
      process.env.SMS_DEV_UI_PORT = '7000'
      process.env.SMS_DEV_WEBHOOK_URL = 'http://env.com/webhook'
      process.env.SMS_DEV_VERBOSE = 'true'
      
      const config = loadConfig()
      expect(config.apiPort).toBe(7001)
      expect(config.uiPort).toBe(7000)
      expect(config.webhookUrl).toBe('http://env.com/webhook')
      expect(config.verbose).toBe(true)
    })

    it('should override config with CLI options', () => {
      const testConfig = {
        apiPort: 8001,
        uiPort: 8000
      }
      
      writeFileSync(testConfigPath, `module.exports = ${JSON.stringify(testConfig, null, 2)}`)
      
      const cliOptions: ConfigOptions = {
        configFile: testConfigPath,
        apiPort: 9001,
        uiPort: 9000,
        webhookUrl: 'http://cli.com/webhook'
      }
      
      const config = loadConfig(cliOptions)
      
      expect(config.apiPort).toBe(9001)
      expect(config.uiPort).toBe(9000)
      expect(config.webhookUrl).toBe('http://cli.com/webhook')
    })

    it('should handle boolean environment variables', () => {
      process.env.SMS_DEV_VERBOSE = 'false'
      process.env.SMS_DEV_NO_UI = 'true'
      
      const config = loadConfig()
      expect(config.verbose).toBe(false)
      expect(config.startUI).toBe(false)
    })
  })

  describe('generateSampleConfig', () => {
    it('should generate sample configuration string', () => {
      const sampleConfig = generateSampleConfig()
      expect(typeof sampleConfig).toBe('string')
      expect(sampleConfig).toContain('module.exports')
      expect(sampleConfig).toContain('apiPort: 4001')
      expect(sampleConfig).toContain('uiPort: 4000')
    })

    it('should include JSDoc type annotations', () => {
      const sampleConfig = generateSampleConfig()
      expect(sampleConfig).toContain('@type {import')
      expect(sampleConfig).toContain('SmsDevConfig')
    })
  })

  describe('Configuration Validation', () => {
    it('should validate CORS origins from environment', () => {
      process.env.SMS_DEV_CORS_ORIGINS = 'http://localhost:3000,https://app.com'
      
      const config = loadConfig()
      expect(config.cors.origins).toEqual(['http://localhost:3000', 'https://app.com'])
    })

    it('should handle single CORS origin', () => {
      process.env.SMS_DEV_CORS_ORIGINS = 'http://localhost:3000'
      
      const config = loadConfig()
      expect(config.cors.origins).toEqual(['http://localhost:3000'])
    })

    it('should validate log levels', () => {
      process.env.SMS_DEV_LOG_LEVEL = 'debug'
      
      const config = loadConfig()
      expect(config.logging.level).toBe('debug')
    })

    it('should handle invalid port numbers gracefully', () => {
      // Create config with invalid ports
      const testConfig = {
        apiPort: 'invalid',
        uiPort: 99999
      }
      
      writeFileSync(testConfigPath, `module.exports = ${JSON.stringify(testConfig, null, 2)}`)
      
      // Should not throw an error, but may use defaults or skip invalid values
      expect(() => {
        loadConfig({ configFile: testConfigPath })
      }).not.toThrow()
    })
  })
}) 
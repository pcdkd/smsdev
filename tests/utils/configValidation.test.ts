/**
 * Tests for enhanced configuration validation system
 * Tests detailed error messages, validation rules, and configuration loading
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import { ConfigValidator } from '../../src/utils/configValidation.js'
import { ValidationError } from '../../src/types/errors.js'

describe('Enhanced Configuration Validation', () => {
  let configValidator: ConfigValidator
  const tempDir = path.join(__dirname, 'temp-config-tests')
  
  beforeEach(() => {
    configValidator = new ConfigValidator()
    
    // Create temp directory for test files
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('Configuration Validation', () => {
    it('should validate a complete valid configuration', async () => {
      const validConfig = {
        apiPort: 4001,
        uiPort: 4000,
        webhookUrl: 'https://api.example.com/webhook',
        cors: {
          enabled: true,
          origins: ['*']
        },
        logging: {
          enabled: true,
          level: 'info'
        },
        startUI: true,
        verbose: false
      }

      const result = await configValidator.validateConfig(validConfig)
      expect(result).toMatchObject(validConfig)
    })

    it('should reject invalid port numbers with detailed suggestions', async () => {
      const invalidConfig = {
        apiPort: 80, // Invalid: below 1024
        uiPort: 70000 // Invalid: above 65535
      }

      await expect(configValidator.validateConfig(invalidConfig))
        .rejects.toThrow(ValidationError)
    })

    it('should reject port conflicts with helpful error message', async () => {
      const conflictConfig = {
        apiPort: 4001,
        uiPort: 4001 // Same as API port
      }

      try {
        await configValidator.validateConfig(conflictConfig)
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.message).toContain('Port conflict')
        expect(error.message).toContain('4001')
      }
    })

    it('should validate webhook URLs with security checks', async () => {
      const configs = [
        {
          webhookUrl: 'http://localhost:3000/webhook',
          expected: 'valid' // HTTP allowed for localhost
        },
        {
          webhookUrl: 'https://api.example.com/webhook',
          expected: 'valid'
        },
        {
          webhookUrl: 'https://api.example.com/', // No specific path
          expected: 'invalid'
        },
        {
          webhookUrl: 'not-a-url',
          expected: 'invalid'
        }
      ]

      for (const config of configs) {
        if (config.expected === 'valid') {
          const result = await configValidator.validateConfig({ webhookUrl: config.webhookUrl })
          expect(result.webhookUrl).toBe(config.webhookUrl)
        } else {
          await expect(configValidator.validateConfig({ webhookUrl: config.webhookUrl }))
            .rejects.toThrow(ValidationError)
        }
      }
    })

    it('should validate CORS configuration with detailed error messages', async () => {
      const invalidCorsConfigs = [
        {
          cors: 'invalid-string', // Should be object
          expectedError: 'enabled must be a boolean'
        },
        {
          cors: {
            enabled: 'yes', // Should be boolean
            origins: ['*']
          },
          expectedError: 'enabled must be a boolean'
        },
        {
          cors: {
            enabled: true,
            origins: 'not-array' // Should be array
          },
          expectedError: 'origins must be an array'
        },
        {
          cors: {
            enabled: true,
            origins: ['http://localhost:3000', 'invalid-url']
          },
          expectedError: 'is not a valid URL'
        }
      ]

      for (const config of invalidCorsConfigs) {
        try {
          await configValidator.validateConfig(config)
          fail(`Should have thrown ValidationError for: ${JSON.stringify(config)}`)
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError)
          expect(error.message).toContain(config.expectedError)
        }
      }
    })

    it('should validate logging configuration with level validation', async () => {
      const validLevels = ['debug', 'info', 'warn', 'error']
      
      // Test valid levels
      for (const level of validLevels) {
        const config = {
          logging: {
            enabled: true,
            level
          }
        }
        
        const result = await configValidator.validateConfig(config)
        expect(result.logging?.level).toBe(level)
      }

      // Test invalid level
      const invalidConfig = {
        logging: {
          enabled: true,
          level: 'invalid-level'
        }
      }

      try {
        await configValidator.validateConfig(invalidConfig)
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.message).toContain('Invalid log level')
        expect(error.message).toContain('Must be one of: debug, info, warn, error')
      }
    })
  })

  describe('Environment Variable Validation', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should validate environment variables with enhanced error messages', async () => {
      process.env.SMS_DEV_API_PORT = '80' // Invalid port
      
      try {
        await configValidator.validateEnvironmentConfig()
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.message).toContain('SMS_DEV_API_PORT')
        expect(error.message).toContain('Environment variables')
      }
    })

    it('should parse valid environment variables correctly', async () => {
      process.env.SMS_DEV_API_PORT = '4001'
      process.env.SMS_DEV_UI_PORT = '4000'
      process.env.SMS_DEV_WEBHOOK_URL = 'https://api.example.com/webhook'
      process.env.SMS_DEV_LOG_LEVEL = 'debug'
      process.env.SMS_DEV_VERBOSE = 'true'
      process.env.SMS_DEV_NO_UI = 'true'
      process.env.SMS_DEV_CORS_ORIGINS = 'http://localhost:3000,https://app.example.com'

      const config = await configValidator.validateEnvironmentConfig()
      
      expect(config.apiPort).toBe(4001)
      expect(config.uiPort).toBe(4000)
      expect(config.webhookUrl).toBe('https://api.example.com/webhook')
      expect(config.logging?.level).toBe('debug')
      expect(config.verbose).toBe(true)
      expect(config.startUI).toBe(false)
      expect(config.cors?.origins).toEqual(['http://localhost:3000', 'https://app.example.com'])
    })
  })

  describe('Configuration File Validation', () => {
    it('should validate JSON configuration files', async () => {
      const validJsonConfig = {
        apiPort: 4001,
        uiPort: 4000,
        webhookUrl: 'https://api.example.com/webhook'
      }

      const configPath = path.join(tempDir, 'valid-config.json')
      fs.writeFileSync(configPath, JSON.stringify(validJsonConfig, null, 2))

      const result = await configValidator.validateConfigFile(configPath, validJsonConfig)
      expect(result).toMatchObject(validJsonConfig)
    })

    it('should provide detailed error messages for invalid JSON files', async () => {
      const invalidJsonConfig = {
        apiPort: 'not-a-number',
        uiPort: -1,
        webhookUrl: 'not-a-url'
      }

      const configPath = path.join(tempDir, 'invalid-config.json')

      try {
        await configValidator.validateConfigFile(configPath, invalidJsonConfig)
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.message).toContain('Configuration file')
        expect(error.message).toContain(configPath)
        expect(error.message).toContain('💡 Suggestions:')
      }
    })
  })

  describe('CLI Arguments Validation', () => {
    it('should validate CLI arguments with context-aware messages', async () => {
      const validArgs = {
        apiPort: 4001,
        uiPort: 4000,
        webhookUrl: 'https://api.example.com/webhook',
        startUI: true,
        verbose: false
      }

      const result = await configValidator.validateCliArgs(validArgs)
      expect(result).toMatchObject(validArgs)
    })

    it('should reject invalid CLI arguments with helpful suggestions', async () => {
      const invalidArgs = {
        apiPort: 70000, // Invalid port
        configFile: '/non/existent/path/config.json'
      }

      try {
        await configValidator.validateCliArgs(invalidArgs)
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.message).toContain('Command line arguments')
        expect(error.message).toContain('💡 Suggestions:')
      }
    })

    it('should validate config file paths', async () => {
      // Test non-existent file
      const invalidArgs = {
        configFile: '/non/existent/config.json'
      }

      try {
        await configValidator.validateCliArgs(invalidArgs)
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.message).toContain('Configuration file not found')
        expect(error.message).toContain('Check the file path for typos')
      }
    })

    it('should validate config file extensions', async () => {
      // Create a file with unsupported extension
      const invalidConfigPath = path.join(tempDir, 'config.txt')
      fs.writeFileSync(invalidConfigPath, 'some content')

      const invalidArgs = {
        configFile: invalidConfigPath
      }

      try {
        await configValidator.validateCliArgs(invalidArgs)
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.message).toContain('Unsupported config file type')
        expect(error.message).toContain('Use .js files')
        expect(error.message).toContain('Use .json files')
      }
    })
  })

  describe('Error Message Quality', () => {
    it('should provide comprehensive error messages with suggestions', async () => {
      const complexInvalidConfig = {
        apiPort: 80, // Too low
        uiPort: 'not-a-number', // Wrong type  
        webhookUrl: 'not-a-url', // Invalid URL
        cors: {
          enabled: 'maybe', // Wrong type
          origins: 'should-be-array' // Wrong type
        },
        logging: {
          level: 'super-debug' // Invalid level
        }
      }

      try {
        await configValidator.validateConfig(complexInvalidConfig)
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const message = error.message
        
        // Should contain field-specific errors
        expect(message).toContain('apiPort:')
        expect(message).toContain('uiPort:')
        expect(message).toContain('webhookUrl:')
        expect(message).toContain('cors:')
        expect(message).toContain('logging:')
        
        // Should contain suggestions
        expect(message).toContain('💡 Suggestions:')
        expect(message).toContain('Run "sms-dev config"')
        expect(message).toContain('Run "sms-dev init"')
        
        // Should be well-formatted
        expect(message.split('\n').length).toBeGreaterThan(5)
      }
    })

    it('should enhance environment variable errors with ENV var names', async () => {
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        SMS_DEV_API_PORT: 'invalid-port'
      }

      try {
        await configValidator.validateEnvironmentConfig()
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.message).toContain('SMS_DEV_API_PORT')
        expect(error.message).toContain('Environment variables')
      } finally {
        process.env = originalEnv
      }
    })
  })
})
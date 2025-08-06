/**
 * Integration tests for validation framework with BaseCommand
 * Tests the complete validation flow from command execution to error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { BaseCommand, CommandOptions } from '../../src/commands/base/BaseCommand.js'
import { CommandValidationSchemas } from '../../src/validation/index.js'
import { ValidationError } from '../../src/types/errors.js'

// Create a test command class
class TestCommand extends BaseCommand {
  readonly name = 'test-command'
  readonly description = 'Test command for validation'
  
  async execute(options: CommandOptions): Promise<void> {
    // Test validation integration
    await this.validateOptions(options, CommandValidationSchemas.mockPhone)
    
    // Mock command execution
    console.log('Command executed successfully')
  }
}

describe('Validation Integration Tests', () => {
  let command: TestCommand
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    command = new TestCommand()
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('BaseCommand validation integration', () => {
    it('should validate options using validation schema', async () => {
      const options: CommandOptions = {
        action: 'list',
        verbose: false
      }

      await expect(command.execute(options)).resolves.toBeUndefined()
      expect(consoleSpy).toHaveBeenCalledWith('Command executed successfully')
    })

    it('should reject invalid enum values', async () => {
      const options: CommandOptions = {
        action: 'invalid-action',
        verbose: false
      }

      await expect(command.execute(options)).rejects.toThrow(ValidationError)
    })

    it('should validate phone numbers when provided', async () => {
      const options: CommandOptions = {
        action: 'create',
        phone: '+1-234-567-8900', // Should be sanitized to E.164
        verbose: false
      }

      await expect(command.execute(options)).resolves.toBeUndefined()
      // Phone should be sanitized to E.164 format
      expect(options.phone).toBe('+12345678900')
    })

    it('should reject invalid phone numbers', async () => {
      const options: CommandOptions = {
        action: 'create',
        phone: 'not-a-phone',
        verbose: false
      }

      await expect(command.execute(options)).rejects.toThrow(ValidationError)
    })

    it('should validate and sanitize string fields', async () => {
      const options: CommandOptions = {
        action: 'create',
        phone: '+12345678900',
        name: '  Test User  ', // Should be trimmed
        verbose: false
      }

      await expect(command.execute(options)).resolves.toBeUndefined()
      expect(options.name).toBe('Test User')
    })
  })

  describe('Individual field validation helpers', () => {
    it('should validate phone numbers correctly', async () => {
      const validPhone = '+1-234-567-8900'
      const result = await command.validatePhoneNumber(validPhone, false)
      expect(result).toBe('+12345678900')
    })

    it('should validate strict E.164 phone numbers', async () => {
      const strictPhone = '+12345678900'
      const result = await command.validatePhoneNumber(strictPhone, true)
      expect(result).toBe('+12345678900')
    })

    it('should reject invalid phone numbers', async () => {
      await expect(command.validatePhoneNumber('invalid-phone', false))
        .rejects.toThrow(ValidationError)
    })

    it('should validate file paths', async () => {
      // This test requires a file to exist, so we'll use package.json
      const filePath = 'package.json'
      const result = await command.validateFilePath(filePath, true, ['json'])
      expect(result).toBe(filePath)
    })

    it('should reject non-existent files when required', async () => {
      await expect(command.validateFilePath('non-existent.json', true))
        .rejects.toThrow(ValidationError)
    })

    it('should validate URLs', async () => {
      const url = 'https://api.example.com/webhook'
      const result = await command.validateUrl(url, true)
      expect(result).toBe(url)
    })

    it('should reject invalid URLs', async () => {
      await expect(command.validateUrl('not-a-url', false))
        .rejects.toThrow(ValidationError)
    })

    it('should validate port numbers', async () => {
      const port = 4001
      const result = await command.validatePort(port)
      expect(result).toBe(4001)
    })

    it('should reject invalid port numbers', async () => {
      await expect(command.validatePort(70000))
        .rejects.toThrow(ValidationError)
    })

    it('should validate ISO 8601 dates', async () => {
      const date = '2024-01-15T10:00:00Z'
      const result = await command.validateDate(date)
      expect(result).toBeInstanceOf(Date)
      expect(result.toISOString()).toBe('2024-01-15T10:00:00.000Z')
    })

    it('should reject invalid date formats', async () => {
      await expect(command.validateDate('not-a-date'))
        .rejects.toThrow(ValidationError)
    })
  })

  describe('Error handling and messaging', () => {
    it('should provide helpful error messages with suggestions', async () => {
      const options: CommandOptions = {
        action: 'invalid-action',
        verbose: false
      }

      try {
        await command.execute(options)
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.message).toContain('action:')
        expect(error.message).toContain('Suggestions:')
      }
    })

    it('should handle multiple validation errors', async () => {
      const options: CommandOptions = {
        action: 'invalid-action',
        phone: 'invalid-phone',
        verbose: false
      }

      try {
        await command.execute(options)
        fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        // Should contain errors for both fields
        expect(error.message).toContain('action:')
        expect(error.message).toContain('phone:')
      }
    })

    it('should sanitize values and update options', async () => {
      const options: CommandOptions = {
        action: 'create',
        phone: '+1 (234) 567-8900', // Various formats should be normalized
        name: '  Test User  ',
        verbose: false
      }

      await command.execute(options)
      
      // Values should be sanitized
      expect(options.phone).toBe('+12345678900')
      expect(options.name).toBe('Test User')
    })
  })

  describe('Performance and async handling', () => {
    it('should handle async validation rules efficiently', async () => {
      const startTime = Date.now()
      
      const options: CommandOptions = {
        action: 'create',
        phone: '+12345678900',
        verbose: false
      }

      await command.execute(options)
      
      const duration = Date.now() - startTime
      // Validation should complete quickly (under 1 second)
      expect(duration).toBeLessThan(1000)
    })

    it('should handle validation rule priorities correctly', async () => {
      // This test ensures that high-priority rules run first
      // and can stop processing if they fail
      const options: CommandOptions = {
        action: '', // Empty string should fail early
        verbose: false
      }

      const startTime = Date.now()
      
      try {
        await command.execute(options)
        fail('Should have thrown ValidationError')
      } catch (error) {
        const duration = Date.now() - startTime
        expect(error).toBeInstanceOf(ValidationError)
        // Should fail quickly due to high-priority validation
        expect(duration).toBeLessThan(100)
      }
    })
  })
})
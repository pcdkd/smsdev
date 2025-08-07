/**
 * Comprehensive validation tests for all CLI commands
 * Tests the validation framework integration across all command implementations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ValidationError } from '../../../src/types/errors.js'
import { CommandValidationSchemas } from '../../../src/validation/index.js'

// Import test utilities
import { MockApiClient } from '../../mocks/MockApiClient.js'
import { MockConfigUtils } from '../../mocks/MockConfigUtils.js'
import { MockFileSystem } from '../../mocks/MockFileSystem.js'

// Import testable commands
import { TestableMockPhoneCommand } from '../../../src/commands/mock/TestableMockPhoneCommand.js'
import { TestableExportCommand } from '../../../src/commands/export/TestableExportCommand.js'
import { TestableFlowCommand } from '../../../src/commands/flow/TestableFlowCommand.js'
import { TestablePerformanceCommand } from '../../../src/commands/performance/TestablePerformanceCommand.js'
import { TestableStartCommand } from '../../../src/commands/server/TestableStartCommand.js'

describe('Command Validation Integration Tests', () => {
  let mockApiClient: MockApiClient
  let mockConfigUtils: MockConfigUtils
  let mockFileSystem: MockFileSystem
  let consoleSpy: jest.SpiedFunction<typeof console.log>
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>

  beforeEach(() => {
    mockApiClient = new MockApiClient()
    mockConfigUtils = new MockConfigUtils()
    mockFileSystem = new MockFileSystem()
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('MockPhoneCommand Validation', () => {
    let command: TestableMockPhoneCommand

    beforeEach(() => {
      command = new TestableMockPhoneCommand(mockApiClient)
    })

    it('should validate phone number formats', async () => {
      const validPhoneNumbers = [
        '+12345678900',
        '+1-234-567-8900',
        '+1 (234) 567-8900',
        '(234) 567-8900',
        '234-567-8900',
        '2345678900'
      ]

      for (const phone of validPhoneNumbers) {
        const options = {
          action: 'create',
          phone,
          name: 'Test User'
        }

        await expect(command.execute(options)).resolves.toBeUndefined()
      }
    })

    it('should reject invalid phone numbers with helpful suggestions', async () => {
      const invalidPhoneNumbers = [
        { phone: 'not-a-phone', expectedError: 'Invalid phone number format' },
        { phone: '123', expectedError: 'Too few digits' },
        { phone: '+1234567890000000', expectedError: 'Too many digits' },
        { phone: 'abc-def-ghij', expectedError: 'Invalid characters' }
      ]

      for (const { phone, expectedError } of invalidPhoneNumbers) {
        const options = {
          action: 'create',
          phone
        }

        try {
          await command.execute(options)
          fail(`Should have rejected phone number: ${phone}`)
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError)
          expect(error.message).toContain('phone:')
          expect(error.message).toContain('Suggestions:')
        }
      }
    })

    it('should validate action enum values', async () => {
      const validActions = ['create', 'list', 'delete']
      
      for (const action of validActions) {
        const options = { action }
        // 'list' action should succeed without phone
        if (action === 'list') {
          await expect(command.execute(options)).resolves.toBeUndefined()
        }
      }

      // Invalid action
      const options = { action: 'invalid-action' }
      await expect(command.execute(options)).rejects.toThrow(ValidationError)
    })

    it('should validate name field with string rules', async () => {
      // Valid name (trimmed and within length limits)
      const validOptions = {
        action: 'create',
        phone: '+12345678900',
        name: '  Test User  ' // Should be trimmed
      }

      await command.execute(validOptions)
      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: 'Test User' // Trimmed
        })
      )

      // Name too long
      const longNameOptions = {
        action: 'create',
        phone: '+12345678900',
        name: 'A'.repeat(101) // Exceeds 100 char limit
      }

      await expect(command.execute(longNameOptions)).rejects.toThrow(ValidationError)
    })

    it('should validate conditional requirements', async () => {
      // Create action requires phone
      const createWithoutPhone = {
        action: 'create',
        name: 'Test User'
      }
      await expect(command.execute(createWithoutPhone)).rejects.toThrow(ValidationError)

      // Delete action requires phone
      const deleteWithoutPhone = {
        action: 'delete'
      }
      await expect(command.execute(deleteWithoutPhone)).rejects.toThrow(ValidationError)

      // List action doesn't require phone
      const listWithoutPhone = {
        action: 'list'
      }
      await expect(command.execute(listWithoutPhone)).resolves.toBeUndefined()
    })
  })

  describe('ExportCommand Validation', () => {
    let command: TestableExportCommand

    beforeEach(() => {
      command = new TestableExportCommand(mockApiClient, mockFileSystem)
      
      // Set up mock responses
      mockApiClient.get.mockResolvedValue({
        messages: [],
        conversations: []
      })
    })

    it('should validate export type enum', async () => {
      const validTypes = ['messages', 'conversations']
      
      for (const type of validTypes) {
        const options = { type }
        await expect(command.execute(options)).resolves.toBeUndefined()
      }

      // Invalid type
      const options = { type: 'invalid-type' }
      await expect(command.execute(options)).rejects.toThrow(ValidationError)
    })

    it('should validate format enum', async () => {
      const validFormats = ['json', 'csv']
      
      for (const format of validFormats) {
        const options = { format }
        await expect(command.execute(options)).resolves.toBeUndefined()
      }

      // Invalid format
      const options = { format: 'xml' }
      await expect(command.execute(options)).rejects.toThrow(ValidationError)
    })

    it('should validate date ranges', async () => {
      // Valid ISO 8601 dates
      const validOptions = {
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z'
      }
      await expect(command.execute(validOptions)).resolves.toBeUndefined()

      // Invalid date format
      const invalidDateOptions = {
        fromDate: '01/01/2024' // Not ISO 8601
      }
      await expect(command.execute(invalidDateOptions)).rejects.toThrow(ValidationError)

      // From date after to date (should be caught by dateRangeRule)
      const invalidRangeOptions = {
        fromDate: '2024-12-31T00:00:00Z',
        toDate: '2024-01-01T00:00:00Z'
      }
      await expect(command.execute(invalidRangeOptions)).rejects.toThrow(ValidationError)
    })

    it('should validate output file paths', async () => {
      // Valid output path
      const validOptions = {
        output: '/tmp/export.json'
      }
      
      mockFileSystem.setWritable('/tmp/export.json', true)
      await expect(command.execute(validOptions)).resolves.toBeUndefined()

      // Non-writable path
      const nonWritableOptions = {
        output: '/read-only/export.json'
      }
      
      mockFileSystem.setWritable('/read-only/export.json', false)
      await expect(command.execute(nonWritableOptions)).rejects.toThrow(ValidationError)
    })

    it('should validate phone number in export filter', async () => {
      const validOptions = {
        phone: '+1-234-567-8900' // Should be sanitized to E.164
      }

      await command.execute(validOptions)
      
      // Verify API was called with sanitized phone number
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('phone=%2B12345678900') // URL encoded E.164
      )
    })
  })

  describe('FlowCommand Validation', () => {
    let command: TestableFlowCommand

    beforeEach(() => {
      command = new TestableFlowCommand(mockApiClient, mockFileSystem)
    })

    it('should validate flow action enum', async () => {
      const validActions = ['create', 'list', 'execute', 'delete']
      
      for (const action of validActions) {
        const options = { action }
        // List action should succeed without additional params
        if (action === 'list') {
          mockApiClient.get.mockResolvedValue({ flows: [] })
          await expect(command.execute(options)).resolves.toBeUndefined()
        }
      }

      // Invalid action
      const options = { action: 'invalid-action' }
      await expect(command.execute(options)).rejects.toThrow(ValidationError)
    })

    it('should validate flow JSON file', async () => {
      const validFlowJson = {
        name: 'Test Flow',
        triggers: [{ type: 'keyword', value: 'hello' }],
        steps: [{ type: 'message', content: 'Hello!' }]
      }

      const flowFile = '/tmp/flow.json'
      mockFileSystem.setFileContent(flowFile, JSON.stringify(validFlowJson))
      mockFileSystem.exists.mockReturnValue(true)

      const options = {
        action: 'create',
        file: flowFile
      }

      await expect(command.execute(options)).resolves.toBeUndefined()
    })

    it('should reject invalid flow JSON schema', async () => {
      const invalidFlows = [
        {
          desc: 'missing required properties',
          json: { name: 'Test' }, // Missing triggers and steps
          expectedError: 'missing required properties'
        },
        {
          desc: 'invalid triggers type',
          json: { name: 'Test', triggers: 'not-array', steps: [] },
          expectedError: 'triggers must be an array'
        },
        {
          desc: 'invalid step structure',
          json: { 
            name: 'Test', 
            triggers: [], 
            steps: [{ invalid: 'step' }] // Missing type
          },
          expectedError: 'missing type property'
        }
      ]

      for (const { desc, json, expectedError } of invalidFlows) {
        const flowFile = '/tmp/invalid-flow.json'
        mockFileSystem.setFileContent(flowFile, JSON.stringify(json))
        mockFileSystem.exists.mockReturnValue(true)

        const options = {
          action: 'create',
          file: flowFile
        }

        try {
          await command.execute(options)
          fail(`Should have rejected flow: ${desc}`)
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError)
          expect(error.message).toContain(expectedError)
        }
      }
    })

    it('should validate flow ID format', async () => {
      // Valid ID formats
      const validIds = ['flow-123', 'test_flow', 'flow1', 'abc-def-123']
      
      for (const flowId of validIds) {
        mockApiClient.get.mockResolvedValue({ id: flowId })
        
        const options = {
          action: 'execute',
          flowId,
          phone: '+12345678900'
        }
        
        await expect(command.execute(options)).resolves.toBeUndefined()
      }

      // Invalid ID format
      const invalidOptions = {
        action: 'execute',
        flowId: 'flow with spaces!',
        phone: '+12345678900'
      }
      
      await expect(command.execute(invalidOptions)).rejects.toThrow(ValidationError)
    })
  })

  describe('PerformanceCommand Validation', () => {
    let command: TestablePerformanceCommand

    beforeEach(() => {
      command = new TestablePerformanceCommand(mockApiClient)
    })

    it('should validate performance action enum', async () => {
      const validActions = ['test', 'stats', 'reset']
      
      for (const action of validActions) {
        const options = { action }
        await expect(command.execute(options)).resolves.toBeUndefined()
      }

      // Invalid action
      const options = { action: 'benchmark' }
      await expect(command.execute(options)).rejects.toThrow(ValidationError)
    })

    it('should validate numeric parameters with ranges', async () => {
      // Valid ranges
      const validOptions = {
        action: 'test',
        messages: 100,    // 1-10000
        users: 10,        // 1-100
        duration: 60      // 1-300
      }
      
      await expect(command.execute(validOptions)).resolves.toBeUndefined()

      // Test each parameter with invalid values
      const invalidTests = [
        { messages: 0, expectedError: 'minimum: 1' },
        { messages: 10001, expectedError: 'maximum: 10000' },
        { users: 0, expectedError: 'minimum: 1' },
        { users: 101, expectedError: 'maximum: 100' },
        { duration: 0, expectedError: 'minimum: 1' },
        { duration: 301, expectedError: 'maximum: 300' }
      ]

      for (const invalidParam of invalidTests) {
        const options = {
          action: 'test',
          ...validOptions,
          ...invalidParam
        }
        
        try {
          await command.execute(options)
          fail(`Should have rejected: ${JSON.stringify(invalidParam)}`)
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError)
          expect(error.message).toContain(invalidParam.expectedError)
        }
      }
    })

    it('should validate integer types', async () => {
      // Non-integer values
      const nonIntegerOptions = {
        action: 'test',
        messages: 50.5,   // Should be integer
        users: '10',      // Should be number
        duration: null    // Should be number
      }

      await expect(command.execute(nonIntegerOptions)).rejects.toThrow(ValidationError)
    })
  })

  describe('StartCommand Validation', () => {
    let command: TestableStartCommand

    beforeEach(() => {
      command = new TestableStartCommand(mockConfigUtils)
      
      // Mock config loading
      mockConfigUtils.loadConfig.mockResolvedValue({
        apiPort: 4001,
        uiPort: 4000,
        startUI: true,
        verbose: false
      })
    })

    it('should validate port configuration', async () => {
      // Valid ports
      const validOptions = {
        apiPort: '4001',
        uiPort: '4000'
      }
      
      await expect(command.execute(validOptions)).resolves.toBeUndefined()

      // Invalid port strings
      const invalidPortOptions = {
        apiPort: 'not-a-port'
      }
      
      await expect(command.execute(invalidPortOptions)).rejects.toThrow()
    })

    it('should validate config file path', async () => {
      // Valid config file
      const validOptions = {
        config: '/tmp/sms-dev.config.js'
      }
      
      mockFileSystem.exists.mockReturnValue(true)
      await expect(command.execute(validOptions)).resolves.toBeUndefined()

      // Non-existent config file
      const invalidOptions = {
        config: '/non-existent/config.js'
      }
      
      mockFileSystem.exists.mockReturnValue(false)
      await expect(command.execute(invalidOptions)).rejects.toThrow(ValidationError)
    })

    it('should validate webhook URL', async () => {
      // Valid webhook URLs
      const validUrls = [
        'https://api.example.com/webhook',
        'http://localhost:3000/webhook',
        'https://webhook.service.com/sms/inbound'
      ]

      for (const webhookUrl of validUrls) {
        const options = { webhookUrl }
        await expect(command.execute(options)).resolves.toBeUndefined()
      }

      // Invalid webhook URLs
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com/webhook', // Wrong protocol
        'https://example.com/', // No specific path
        'https://user:pass@example.com/webhook' // Credentials in URL
      ]

      for (const webhookUrl of invalidUrls) {
        const options = { webhookUrl }
        await expect(command.execute(options)).rejects.toThrow()
      }
    })
  })

  describe('Cross-Command Validation Consistency', () => {
    it('should use consistent phone number validation across commands', async () => {
      const phoneNumber = '+1 (234) 567-8900'
      const expectedSanitized = '+12345678900'

      // MockPhoneCommand
      const mockPhoneCmd = new TestableMockPhoneCommand(mockApiClient)
      await mockPhoneCmd.execute({ action: 'create', phone: phoneNumber })
      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ phone: expectedSanitized })
      )

      // ExportCommand
      mockApiClient.get.mockResolvedValue({ messages: [] })
      const exportCmd = new TestableExportCommand(mockApiClient, mockFileSystem)
      await exportCmd.execute({ phone: phoneNumber })
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(expectedSanitized))
      )

      // FlowCommand
      const flowCmd = new TestableFlowCommand(mockApiClient, mockFileSystem)
      await flowCmd.execute({ action: 'execute', flowId: 'test', phone: phoneNumber })
      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ phone: expectedSanitized })
      )
    })

    it('should provide consistent error message format', async () => {
      const commands = [
        new TestableMockPhoneCommand(mockApiClient),
        new TestableExportCommand(mockApiClient, mockFileSystem),
        new TestableFlowCommand(mockApiClient, mockFileSystem),
        new TestablePerformanceCommand(mockApiClient)
      ]

      for (const command of commands) {
        try {
          // Trigger validation error with invalid enum
          await command.execute({ action: 'invalid-action' })
          fail('Should have thrown ValidationError')
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError)
          expect(error.message).toContain('action:')
          expect(error.message).toContain('Suggestions:')
        }
      }
    })
  })

  describe('Validation Schema Coverage', () => {
    it('should have validation schemas for all commands', () => {
      const expectedSchemas = [
        'mockPhone',
        'export', 
        'flow',
        'performance',
        'start',
        'config'
      ]

      for (const schemaName of expectedSchemas) {
        expect(CommandValidationSchemas[schemaName]).toBeDefined()
        expect(CommandValidationSchemas[schemaName]).toHaveProperty('action')
      }
    })

    it('should validate all fields defined in schemas', async () => {
      // This test ensures that all fields in validation schemas are actually validated
      const mockPhoneSchema = CommandValidationSchemas.mockPhone
      
      // Check that all schema fields have validation rules
      for (const [field, config] of Object.entries(mockPhoneSchema)) {
        expect(config.rules).toBeDefined()
        expect(config.rules.length).toBeGreaterThan(0)
      }
    })
  })
})
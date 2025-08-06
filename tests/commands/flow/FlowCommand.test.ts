import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import fs from 'fs'
import { FlowCommand } from '../../../src/commands/flow/FlowCommand.js'
import { MockApiClient } from '../../helpers/MockApiClient.js'
import { MOCK_FLOW_RESPONSE } from '../../fixtures/testConfig.js'
import { ValidationError, ApiError } from '../../../src/types/errors.js'
import { ENDPOINTS } from '../../../src/constants.js'

// Mock modules
jest.mock('fs')

describe('FlowCommand', () => {
  let command: FlowCommand
  let mockApiClient: MockApiClient
  let mockFs: jest.Mocked<typeof fs>
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    command = new FlowCommand()
    mockApiClient = new MockApiClient()
    mockFs = fs as jest.Mocked<typeof fs>
    
    // Replace the real API client with our mock
    ;(command as any).apiClient = mockApiClient
    
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    // Reset mocks
    jest.clearAllMocks()
    mockApiClient.reset()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('flow')
      expect(command.description).toBe('Conversation flow management')
    })
  })

  describe('initialize()', () => {
    it('should set API client base URL', () => {
      const options = { apiUrl: 'http://custom:8080' }
      const setBaseUrlSpy = jest.spyOn(mockApiClient, 'setBaseUrl')
      
      command.initialize(options)
      
      expect(setBaseUrlSpy).toHaveBeenCalledWith('http://custom:8080')
    })

    it('should handle default API URL', () => {
      const setBaseUrlSpy = jest.spyOn(mockApiClient, 'setBaseUrl')
      
      command.initialize({})
      
      expect(setBaseUrlSpy).toHaveBeenCalledWith('http://localhost:4001')
    })
  })

  describe('execute() - Create Action', () => {
    it('should successfully create a flow from file', async () => {
      const flowDefinition = {
        name: 'Test Flow',
        description: 'A test flow',
        trigger: { type: 'keyword', value: 'hello' },
        steps: [
          { type: 'send', message: 'Hello!', delay: 1000 },
          { type: 'wait', delay: 2000 }
        ]
      }
      
      const mockReadFileSync = jest.fn().mockReturnValue(JSON.stringify(flowDefinition))
      ;(fs as any).readFileSync = mockReadFileSync
      mockApiClient.post.mockResolvedValue({
        ...MOCK_FLOW_RESPONSE,
        ...flowDefinition,
        trigger: flowDefinition.trigger
      })
      
      const options = {
        action: 'create',
        file: 'test-flow.json'
      }

      await command.execute(options)

      expect(mockReadFileSync).toHaveBeenCalledWith('test-flow.json', 'utf8')
      expect(mockApiClient.post).toHaveBeenCalledWith(ENDPOINTS.CONVERSATION_FLOWS, flowDefinition)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Conversation flow created'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test Flow'))
    })

    it('should create a sample flow when only name is provided', async () => {
      mockApiClient.post.mockResolvedValue(MOCK_FLOW_RESPONSE)
      
      const options = {
        action: 'create',
        name: 'Sample Flow'
      }

      await command.execute(options)

      expect(mockApiClient.post).toHaveBeenCalledWith(ENDPOINTS.CONVERSATION_FLOWS, {
        name: 'Sample Flow',
        description: 'Sample conversation flow',
        trigger: { type: 'keyword', value: 'hello' },
        steps: [
          { type: 'send', message: 'Hello! Thanks for your message.', delay: 1000 },
          { type: 'wait', delay: 2000 },
          { type: 'send', message: 'How can I help you today?' }
        ]
      })
    })

    it('should display flow creation details with trigger', async () => {
      const flowDefinition = {
        name: 'Triggered Flow',
        description: 'A flow with custom trigger',
        trigger: { type: 'keyword', value: 'start' },
        steps: [
          { type: 'send', message: 'Hello!', delay: 1000 }
        ]
      }
      
      // Mock fs.readFileSync to return our custom flow
      const mockReadFileSync = jest.fn().mockReturnValue(JSON.stringify(flowDefinition))
      ;(fs as any).readFileSync = mockReadFileSync
      
      const flowWithTrigger = {
        ...MOCK_FLOW_RESPONSE,
        ...flowDefinition
      }
      mockApiClient.post.mockResolvedValue(flowWithTrigger)
      
      const options = {
        action: 'create',
        file: 'triggered-flow.json'
      }

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🎯 Trigger: keyword = "start"'))
    })

    it('should validate that either file or name is provided', async () => {
      const options = { action: 'create' }
      
      await expect(command.execute(options)).rejects.toThrow('Either --file or --name is required for create action')
    })

    it('should handle file reading errors', async () => {
      const mockReadFileSync = jest.fn().mockImplementation(() => {
        throw new Error('File not found')
      })
      ;(fs as any).readFileSync = mockReadFileSync
      
      const options = {
        action: 'create',
        file: 'nonexistent.json'
      }
      
      await expect(command.execute(options)).rejects.toThrow('Error reading flow file')
    })

    it('should handle JSON parsing errors', async () => {
      const mockReadFileSync = jest.fn().mockReturnValue('invalid json')
      ;(fs as any).readFileSync = mockReadFileSync
      
      const options = {
        action: 'create',
        file: 'invalid.json'
      }
      
      await expect(command.execute(options)).rejects.toThrow('Error reading flow file')
    })

    it('should handle API errors during creation', async () => {
      mockApiClient.post.mockRejectedValue(new ApiError('Invalid flow definition', 400, ENDPOINTS.CONVERSATION_FLOWS))
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })
      
      const options = {
        action: 'create',
        name: 'Test Flow'
      }
      
      await expect(command.execute(options)).rejects.toThrow('process.exit')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid flow definition'))
      expect(mockExit).toHaveBeenCalledWith(1)
      
      mockExit.mockRestore()
    })
  })

  describe('execute() - List Action', () => {
    it('should successfully list flows', async () => {
      const mockFlows = [
        {
          ...MOCK_FLOW_RESPONSE,
          active: true,
          trigger: { type: 'keyword', value: 'hello' },
          description: 'Welcome flow'
        },
        {
          ...MOCK_FLOW_RESPONSE,
          id: 'flow_456',
          name: 'Support Flow',
          active: false,
          trigger: { type: 'keyword', value: 'help' }
        }
      ]
      mockApiClient.get.mockResolvedValue({ flows: mockFlows })
      
      const options = { action: 'list' }

      await command.execute(options)

      expect(mockApiClient.get).toHaveBeenCalledWith(ENDPOINTS.CONVERSATION_FLOWS)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Conversation Flows (2)'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🟢 Welcome Flow'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔴 Support Flow'))
    })

    it('should handle empty flow list', async () => {
      mockApiClient.get.mockResolvedValue({ flows: [] })
      
      const options = { action: 'list' }

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith('🔄 No conversation flows found')
    })

    it('should show additional details in verbose mode', async () => {
      const mockFlows = [{
        ...MOCK_FLOW_RESPONSE,
        active: true,
        trigger: { type: 'keyword', value: 'hello' },
        description: 'Welcome flow'
      }]
      mockApiClient.get.mockResolvedValue({ flows: mockFlows })
      
      command.initialize({ verbose: true })
      
      const options = { action: 'list' }

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Trigger: keyword = "hello"'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Welcome flow'))
    })

    it('should handle API errors during list', async () => {
      mockApiClient.get.mockRejectedValue(new ApiError('Service unavailable', 503, ENDPOINTS.CONVERSATION_FLOWS))
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })
      
      const options = { action: 'list' }
      
      await expect(command.execute(options)).rejects.toThrow('process.exit')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Service unavailable'))
      expect(mockExit).toHaveBeenCalledWith(1)
      
      mockExit.mockRestore()
    })
  })

  describe('execute() - Execute Action', () => {
    it('should successfully execute a flow', async () => {
      const executionResult = {
        execution_id: 'exec_123',
        flow_id: 'flow_123',
        phone: '+1234567890',
        status: 'started' as const,
        startedAt: '2024-01-01T12:00:00Z'
      }
      mockApiClient.post.mockResolvedValue(executionResult)
      
      const options = {
        action: 'execute',
        flowId: 'flow_123',
        phone: '+1234567890'
      }

      await command.execute(options)

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `${ENDPOINTS.CONVERSATION_FLOWS}/flow_123/execute`,
        {
          phone: '+1234567890',
          context: { user: 'CLI User' }
        }
      )
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Flow execution started'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('exec_123'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('+1234567890'))
    })

    it('should execute flow without phone number', async () => {
      const executionResult = {
        execution_id: 'exec_123',
        flow_id: 'flow_123',
        status: 'started' as const,
        startedAt: '2024-01-01T12:00:00Z'
      }
      mockApiClient.post.mockResolvedValue(executionResult)
      
      const options = {
        action: 'execute',
        flowId: 'flow_123'
      }

      await command.execute(options)

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `${ENDPOINTS.CONVERSATION_FLOWS}/flow_123/execute`,
        {
          phone: undefined,
          context: { user: 'CLI User' }
        }
      )
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Target:'))
    })

    it('should show verbose execution details', async () => {
      const executionResult = {
        execution_id: 'exec_123',
        flow_id: 'flow_123',
        status: 'started' as const,
        startedAt: '2024-01-01T12:00:00Z'
      }
      mockApiClient.post.mockResolvedValue(executionResult)
      
      command.initialize({ verbose: true })
      
      const options = {
        action: 'execute',
        flowId: 'flow_123'
      }

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Flow execution details available via WebSocket'))
    })

    it('should validate flow ID is required', async () => {
      const options = { action: 'execute' }
      
      await expect(command.execute(options)).rejects.toThrow('Flow ID is required for execute action')
    })

    it('should handle API errors during execution', async () => {
      mockApiClient.post.mockRejectedValue(new ApiError('Flow not found', 404))
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })
      
      const options = {
        action: 'execute',
        flowId: 'nonexistent'
      }
      
      await expect(command.execute(options)).rejects.toThrow('process.exit')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Flow not found'))
      expect(mockExit).toHaveBeenCalledWith(1)
      
      mockExit.mockRestore()
    })
  })

  describe('execute() - Help Action', () => {
    it('should show help when no action provided', async () => {
      const options = {}

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Conversation flow management commands'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('sms-dev flow create'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('sms-dev flow list'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('sms-dev flow execute'))
    })

    it('should show help with flow definition format', async () => {
      const options = {}

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Flow Definition Format (JSON)'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"name": "Welcome Flow"'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"steps":'))
    })

    it('should show help for invalid action', async () => {
      const options = { action: 'invalid' }

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Conversation flow management commands'))
    })
  })

  describe('Spinner Behavior', () => {
    it('should show spinner during create operation', async () => {
      mockApiClient.post.mockResolvedValue(MOCK_FLOW_RESPONSE)
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')
      
      const options = {
        action: 'create',
        name: 'Test Flow'
      }

      await command.execute(options)

      expect(startSpinnerSpy).toHaveBeenCalledWith('Creating conversation flow')
      expect(stopSpinnerSpy).toHaveBeenCalled()
    })

    it('should show spinner during list operation', async () => {
      mockApiClient.get.mockResolvedValue({ flows: [] })
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')
      
      const options = { action: 'list' }

      await command.execute(options)

      expect(startSpinnerSpy).toHaveBeenCalledWith('Fetching conversation flows')
      expect(stopSpinnerSpy).toHaveBeenCalled()
    })

    it('should show spinner during execute operation', async () => {
      const executionResult = {
        execution_id: 'exec_123',
        flow_id: 'flow_123',
        status: 'started' as const,
        startedAt: '2024-01-01T12:00:00Z'
      }
      mockApiClient.post.mockResolvedValue(executionResult)
      
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')
      
      const options = {
        action: 'execute',
        flowId: 'flow_123'
      }

      await command.execute(options)

      expect(startSpinnerSpy).toHaveBeenCalledWith('Starting flow execution')
      expect(stopSpinnerSpy).toHaveBeenCalled()
    })
  })

  describe('File Operations', () => {
    it('should log verbose message when reading file', async () => {
      const flowDefinition = { name: 'Test', steps: [] }
      
      // Mock fs.readFileSync properly
      const mockReadFileSync = jest.fn().mockReturnValue(JSON.stringify(flowDefinition))
      ;(fs as any).readFileSync = mockReadFileSync
      
      mockApiClient.post.mockResolvedValue(MOCK_FLOW_RESPONSE)
      
      command.initialize({ verbose: true })
      const logVerboseSpy = jest.spyOn(command as any, 'logVerbose')
      
      const options = {
        action: 'create',
        file: 'test.json'
      }

      await command.execute(options)

      expect(mockReadFileSync).toHaveBeenCalledWith('test.json', 'utf8')
      expect(logVerboseSpy).toHaveBeenCalledWith('Reading flow definition from: test.json')
    })
  })

  describe('Error Handling Context', () => {
    it('should provide proper error context for create', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Network error'))
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })
      
      await expect(command.execute({ 
        action: 'create', 
        name: 'Test Flow' 
      })).rejects.toThrow('process.exit')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'))
      expect(mockExit).toHaveBeenCalledWith(1)
      
      mockExit.mockRestore()
    })

    it('should provide proper error context for list', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'))
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })
      
      await expect(command.execute({ action: 'list' })).rejects.toThrow('process.exit')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'))
      expect(mockExit).toHaveBeenCalledWith(1)
      
      mockExit.mockRestore()
    })

    it('should provide proper error context for execute', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Network error'))
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })
      
      await expect(command.execute({ 
        action: 'execute', 
        flowId: 'flow_123' 
      })).rejects.toThrow('process.exit')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'))
      expect(mockExit).toHaveBeenCalledWith(1)
      
      mockExit.mockRestore()
    })
  })

  describe('Integration with BaseCommand', () => {
    it('should inherit from BaseCommand correctly', () => {
      expect(command).toHaveProperty('name')
      expect(command).toHaveProperty('description')
      expect(command).toHaveProperty('execute')
      expect(command).toHaveProperty('initialize')
    })

    it('should have access to BaseCommand methods', () => {
      expect(command['handleError']).toBeDefined()
      expect(command['startSpinner']).toBeDefined()
      expect(command['stopSpinner']).toBeDefined()
      expect(command['logSuccess']).toBeDefined()
      expect(command['logVerbose']).toBeDefined()
    })
  })
})
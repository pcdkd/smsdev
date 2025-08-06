import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { MockPhoneCommand } from '../../../src/commands/mock/MockPhoneCommand.js'
import { MockApiClient } from '../../helpers/MockApiClient.js'
import { MOCK_PHONE_RESPONSE } from '../../fixtures/testConfig.js'
import { ValidationError, ApiError } from '../../../src/types/errors.js'
import { ENDPOINTS, MOCK_PHONE_TYPES } from '../../../src/constants.js'

describe('MockPhoneCommand', () => {
  let command: MockPhoneCommand
  let mockApiClient: MockApiClient
  let consoleSpy: jest.SpiedFunction<typeof console.log>
  let mockExit: jest.SpiedFunction<typeof process.exit>

  beforeEach(() => {
    command = new MockPhoneCommand()
    mockApiClient = new MockApiClient()
    
    // Replace the real API client with our mock
    ;(command as any).apiClient = mockApiClient
    
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never
    })
    
    // Reset mocks
    jest.clearAllMocks()
    mockApiClient.reset()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    mockExit.mockRestore()
  })

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('mock-phone')
      expect(command.description).toBe('Mock phone number management')
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
    it('should successfully create a mock phone', async () => {
      mockApiClient.post.mockResolvedValue(MOCK_PHONE_RESPONSE)
      
      const options = {
        action: 'create',
        phone: '+1234567890',
        name: 'Test User',
        type: 'test'
      }

      await command.execute(options)

      expect(mockApiClient.post).toHaveBeenCalledWith(ENDPOINTS.MOCK_PHONES, {
        phone: '+1234567890',
        name: 'Test User',
        type: 'test',
        capabilities: { sms: true }
      })
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mock phone created'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('+1234567890'))
    })

    it('should create mock phone with default type when not specified', async () => {
      mockApiClient.post.mockResolvedValue(MOCK_PHONE_RESPONSE)
      
      const options = {
        action: 'create',
        phone: '+1234567890',
        name: 'Test User'
      }

      await command.execute(options)

      expect(mockApiClient.post).toHaveBeenCalledWith(ENDPOINTS.MOCK_PHONES, {
        phone: '+1234567890',
        name: 'Test User',
        type: 'test',
        capabilities: { sms: true }
      })
    })

    it('should create mock phone without name', async () => {
      mockApiClient.post.mockResolvedValue({ ...MOCK_PHONE_RESPONSE, name: undefined })
      
      const options = {
        action: 'create',
        phone: '+1234567890'
      }

      await command.execute(options)

      expect(mockApiClient.post).toHaveBeenCalledWith(ENDPOINTS.MOCK_PHONES, {
        phone: '+1234567890',
        name: undefined,
        type: 'test',
        capabilities: { sms: true }
      })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(Unnamed)'))
    })

    it('should validate phone number is required for create', async () => {
      const options = { action: 'create' }
      
      await expect(command.execute(options)).rejects.toThrow('Phone number is required for create action')
    })

    it('should validate phone type', async () => {
      const options = {
        action: 'create',
        phone: '+1234567890',
        type: 'invalid-type'
      }
      
      await expect(command.execute(options)).rejects.toThrow('Invalid phone type')
    })

    it('should handle API errors during creation', async () => {
      mockApiClient.post.mockRejectedValue(new ApiError('Phone number already exists', 409, ENDPOINTS.MOCK_PHONES))
      
      const options = {
        action: 'create',
        phone: '+1234567890'
      }
      
      await command.execute(options)
      
      expect(mockExit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Phone number already exists'))
    })
  })

  describe('execute() - List Action', () => {
    it('should successfully list mock phones', async () => {
      const mockPhones = [
        MOCK_PHONE_RESPONSE,
        { ...MOCK_PHONE_RESPONSE, id: 'phone_456', phone: '+0987654321', name: 'Another User' }
      ]
      mockApiClient.get.mockResolvedValue({ phones: mockPhones })
      
      const options = { action: 'list' }

      await command.execute(options)

      expect(mockApiClient.get).toHaveBeenCalledWith(ENDPOINTS.MOCK_PHONES)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mock Phones (2)'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('+1234567890'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('+0987654321'))
    })

    it('should handle empty phone list', async () => {
      mockApiClient.get.mockResolvedValue({ phones: [] })
      
      const options = { action: 'list' }

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith('📱 No mock phones found')
    })

    it('should handle phones without names', async () => {
      const mockPhones = [
        { ...MOCK_PHONE_RESPONSE, name: undefined }
      ]
      mockApiClient.get.mockResolvedValue({ phones: mockPhones })
      
      const options = { action: 'list' }

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unnamed'))
    })

    it('should handle API errors during list', async () => {
      mockApiClient.get.mockRejectedValue(new ApiError('Service unavailable', 503, ENDPOINTS.MOCK_PHONES))
      
      const options = { action: 'list' }
      
      await command.execute(options)
      
      expect(mockExit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Service unavailable'))
    })
  })

  describe('execute() - Delete Action', () => {
    it('should successfully delete a mock phone', async () => {
      const mockPhones = [MOCK_PHONE_RESPONSE]
      mockApiClient.get.mockResolvedValue({ phones: mockPhones })
      mockApiClient.delete.mockResolvedValue({})
      
      const options = {
        action: 'delete',
        phone: '+1234567890'
      }

      await command.execute(options)

      expect(mockApiClient.get).toHaveBeenCalledWith(ENDPOINTS.MOCK_PHONES)
      expect(mockApiClient.delete).toHaveBeenCalledWith(`${ENDPOINTS.MOCK_PHONES}/${MOCK_PHONE_RESPONSE.id}`)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mock phone +1234567890 deleted'))
    })

    it('should validate phone number is required for delete', async () => {
      const options = { action: 'delete' }
      
      await expect(command.execute(options)).rejects.toThrow('Phone number is required for delete action')
    })

    it('should handle phone not found during delete', async () => {
      mockApiClient.get.mockResolvedValue({ phones: [] })
      
      const options = {
        action: 'delete',
        phone: '+1234567890'
      }
      
      await command.execute(options)
      
      expect(mockExit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mock phone +1234567890 not found'))
    })

    it('should handle API errors during delete', async () => {
      const mockPhones = [MOCK_PHONE_RESPONSE]
      mockApiClient.get.mockResolvedValue({ phones: mockPhones })
      mockApiClient.delete.mockRejectedValue(new ApiError('Internal server error', 500))
      
      const options = {
        action: 'delete',
        phone: '+1234567890'
      }
      
      await command.execute(options)
      
      expect(mockExit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Internal server error'))
    })
  })

  describe('execute() - Help Action', () => {
    it('should show help when no action provided', async () => {
      const options = {}

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mock phone management commands'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('sms-dev mock-phone create'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('sms-dev mock-phone list'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('sms-dev mock-phone delete'))
    })

    it('should show help for invalid action', async () => {
      const options = { action: 'invalid' }

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mock phone management commands'))
    })
  })

  describe('Spinner Behavior', () => {
    it('should show spinner during create operation', async () => {
      mockApiClient.post.mockResolvedValue(MOCK_PHONE_RESPONSE)
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')
      
      const options = {
        action: 'create',
        phone: '+1234567890'
      }

      await command.execute(options)

      expect(startSpinnerSpy).toHaveBeenCalledWith('Creating mock phone')
      expect(stopSpinnerSpy).toHaveBeenCalled()
    })

    it('should show spinner during list operation', async () => {
      mockApiClient.get.mockResolvedValue({ phones: [] })
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')
      
      const options = { action: 'list' }

      await command.execute(options)

      expect(startSpinnerSpy).toHaveBeenCalledWith('Fetching mock phones')
      expect(stopSpinnerSpy).toHaveBeenCalled()
    })

    it('should show spinners during delete operation', async () => {
      const mockPhones = [MOCK_PHONE_RESPONSE]
      mockApiClient.get.mockResolvedValue({ phones: mockPhones })
      mockApiClient.delete.mockResolvedValue({})
      
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')
      
      const options = {
        action: 'delete',
        phone: '+1234567890'
      }

      await command.execute(options)

      expect(startSpinnerSpy).toHaveBeenCalledWith('Finding mock phone')
      expect(startSpinnerSpy).toHaveBeenCalledWith('Deleting mock phone')
    })
  })

  describe('Verbose Mode', () => {
    it('should initialize with verbose mode', () => {
      const options = { verbose: true }
      
      command.initialize(options)
      
      expect(command['verbose']).toBe(true)
    })
  })

  describe('Error Handling Context', () => {
    it('should provide proper error context for create', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Network error'))
      
      await command.execute({ 
        action: 'create', 
        phone: '+1234567890' 
      })
      
      expect(mockExit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'))
    })

    it('should provide proper error context for list', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'))
      
      await command.execute({ action: 'list' })
      
      expect(mockExit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'))
    })

    it('should provide proper error context for delete', async () => {
      const mockPhones = [MOCK_PHONE_RESPONSE]
      mockApiClient.get.mockResolvedValue({ phones: mockPhones })
      mockApiClient.delete.mockRejectedValue(new Error('Network error'))
      
      await command.execute({ 
        action: 'delete', 
        phone: '+1234567890' 
      })
      
      expect(mockExit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'))
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
    })
  })
})
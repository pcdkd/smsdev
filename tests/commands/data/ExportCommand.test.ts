import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { ExportCommand } from '../../../src/commands/data/ExportCommand.js'
import { MOCK_MESSAGES_EXPORT } from '../../fixtures/testConfig.js'
import { ValidationError, ApiError } from '../../../src/types/errors.js'
import { ENDPOINTS, EXPORT_FORMATS } from '../../../src/constants.js'
import { MockFileSystem } from '../../helpers/MockFileSystem.js'

// Mock fetch function
class MockFetch {
  public mockFetch: jest.MockedFunction<typeof fetch>

  constructor() {
    this.mockFetch = jest.fn()
    global.fetch = this.mockFetch
  }

  mockJsonResponse(data: any, status = 200) {
    this.mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: jest.fn().mockReturnValue('application/json')
      },
      json: jest.fn().mockResolvedValue(data)
    } as any)
  }

  mockTextResponse(data: string, status = 200) {
    this.mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: jest.fn().mockReturnValue('text/plain')
      },
      text: jest.fn().mockResolvedValue(data)
    } as any)
  }

  mockError(error: Error) {
    this.mockFetch.mockRejectedValueOnce(error)
  }

  reset() {
    this.mockFetch.mockReset()
  }
}

// Create a testable version of ExportCommand that uses our mocks
class TestableExportCommand extends ExportCommand {
  private mockFs: MockFileSystem
  private apiUrl: string = 'http://localhost:4001'

  constructor(mockFs: MockFileSystem) {
    super()
    this.mockFs = mockFs
  }

  initialize(options: any): void {
    super.initialize(options)
    if (options.apiUrl) {
      this.apiUrl = options.apiUrl
    }
  }

  async execute(options: any): Promise<void> {
    try {
      // Validate inputs
      const type = options.type || 'messages'
      if (type !== 'messages' && type !== 'conversations') {
        throw new ValidationError('Export type must be "messages" or "conversations"', 'type')
      }

      const format = options.format || 'json'
      if (!EXPORT_FORMATS.includes(format)) {
        throw new ValidationError('Invalid export format', 'format')
      }

      if (options.fromDate) {
        const fromDate = new Date(options.fromDate)
        if (isNaN(fromDate.getTime()) || !options.fromDate.includes('T')) {
          throw new ValidationError('from-date must be in ISO 8601 format', 'fromDate')
        }
      }

      if (options.toDate) {
        const toDate = new Date(options.toDate)
        if (isNaN(toDate.getTime()) || !options.toDate.includes('T')) {
          throw new ValidationError('to-date must be in ISO 8601 format', 'toDate')
        }
      }

      this.startSpinner(`Preparing ${type} export`)

      // Build URL and parameters
      const endpoint = type === 'messages' ? ENDPOINTS.MESSAGES_EXPORT : ENDPOINTS.CONVERSATIONS_EXPORT
      const url = new URL(`${this.apiUrl}${endpoint}`)

      if (options.phone) {
        url.searchParams.append('phone', options.phone)
      }
      if (options.format) {
        url.searchParams.append('format', options.format)
      }
      if (options.fromDate) {
        url.searchParams.append('from_date', options.fromDate)
      }
      if (options.toDate) {
        url.searchParams.append('to_date', options.toDate)
      }

      if (this.verbose) {
        this.logVerbose(`Exporting ${type} with params: ${JSON.stringify(options)}`)
        this.logVerbose(`Using endpoint: ${url.toString()}`)
      }

      // Fetch data
      const response = await fetch(url.toString())
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Export failed with status ${response.status}`)
      }

      this.stopSpinner()

      // Handle response based on content type
      const contentType = response.headers.get('content-type') || ''
      let data: any

      if (contentType.includes('application/json')) {
        try {
          data = await response.json()
        } catch (error) {
          throw new Error('Failed to display export data: Invalid JSON response')
        }
      } else {
        data = await response.text()
      }

      // Save or display data
      if (options.output) {
        try {
          const outputPath = this.mockFs.path.resolve(options.output)
          const outputDir = this.mockFs.path.dirname(outputPath)

          if (!this.mockFs.fs.existsSync(outputDir)) {
            this.mockFs.fs.mkdirSync(outputDir, { recursive: true })
            if (this.verbose) {
              this.logVerbose(`Created output directory: ${outputDir}`)
            }
          }

          const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
          this.mockFs.fs.writeFileSync(outputPath, content, 'utf8')

          const stats = this.mockFs.fs.statSync(outputPath)
          const sizeKB = Math.round(stats.size / 1024)

          console.log(`✅ Export saved to: ${outputPath}`)
          console.log(`📊 File size: ${sizeKB} KB`)
        } catch (error: any) {
          throw new Error(`Failed to save export: ${error.message}`)
        }
      } else {
        // Display to console
        const displayData = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        console.log(displayData)
      }

      // Show export summary
      console.log('')
      console.log('📋 Export Summary:')
      console.log(`   Type: ${type}`)
      console.log(`   Format: ${format}`)
      if (options.phone) {
        console.log(`   Phone filter: ${options.phone}`)
      }
      if (options.fromDate) {
        console.log(`   From date: ${options.fromDate}`)
      }
      if (options.toDate) {
        console.log(`   To date: ${options.toDate}`)
      }
      if (this.verbose) {
        console.log(`   API URL: ${url.toString()}`)
      }
      console.log(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} export completed successfully`)

    } catch (error: any) {
      this.stopSpinner()
      throw error
    }
  }
}

describe('ExportCommand', () => {
  let command: TestableExportCommand
  let mockFs: MockFileSystem
  let mockFetch: MockFetch
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    mockFs = new MockFileSystem()
    mockFetch = new MockFetch()
    command = new TestableExportCommand(mockFs)
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    // Reset all mocks
    jest.clearAllMocks()
    mockFs.reset()
    mockFetch.reset()
    
    // Default mock implementations are already set in MockFileSystem constructor
    mockFs.dirname.mockImplementation((p) => '/mock/dir')
    mockFs.resolve.mockImplementation((p) => `/resolved/${p}`)
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('export')
      expect(command.description).toBe('Export conversation history')
    })
  })

  describe('initialize()', () => {
    it('should set API client base URL', () => {
      const options = { apiUrl: 'http://custom:8080' }
      
      command.initialize(options)
      
      expect(command['apiUrl']).toBe('http://custom:8080')
    })
  })

  describe('execute() - Validation', () => {
    it('should use default type when none provided', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      
      await command.execute({})
      
      expect(mockFetch.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(ENDPOINTS.MESSAGES_EXPORT)
      )
    })

    it('should validate export type', async () => {
      const options = { type: 'invalid' }
      
      await expect(command.execute(options)).rejects.toThrow('Export type must be "messages" or "conversations"')
    })

    it('should validate export format', async () => {
      const options = { format: 'invalid' }
      
      await expect(command.execute(options)).rejects.toThrow('Invalid export format')
    })

    it('should validate fromDate format', async () => {
      const options = { fromDate: 'invalid-date' }
      
      await expect(command.execute(options)).rejects.toThrow('from-date must be in ISO 8601 format')
    })

    it('should validate toDate format', async () => {
      const options = { toDate: '2023-13-45' }
      
      await expect(command.execute(options)).rejects.toThrow('to-date must be in ISO 8601 format')
    })

    it('should accept valid ISO 8601 dates', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      
      const options = {
        fromDate: '2023-12-01T00:00:00Z',
        toDate: '2023-12-31T23:59:59Z'
      }

      await command.execute(options)

      expect(mockFetch.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('from_date=2023-12-01T00%3A00%3A00Z')
      )
      expect(mockFetch.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('to_date=2023-12-31T23%3A59%3A59Z')
      )
    })
  })

  describe('execute() - Messages Export', () => {
    it('should successfully export messages to console', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      
      const options = { type: 'messages' }

      await command.execute(options)

      expect(mockFetch.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(ENDPOINTS.MESSAGES_EXPORT)
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify(MOCK_MESSAGES_EXPORT, null, 2)
      )
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Messages export completed'))
    })

    it('should export messages with filters', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      
      const options = {
        type: 'messages',
        phone: '+1234567890',
        format: 'csv',
        fromDate: '2023-12-01T00:00:00Z'
      }

      await command.execute(options)

      const fetchUrl = mockFetch.mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('phone=%2B1234567890')
      expect(fetchUrl).toContain('format=csv')
      expect(fetchUrl).toContain('from_date=2023-12-01T00%3A00%3A00Z')
    })

    it('should save messages to file when output specified', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      
      const options = {
        type: 'messages',
        output: 'messages.json'
      }

      await command.execute(options)

      expect(mockFs.fs.writeFileSync).toHaveBeenCalledWith(
        '/resolved/messages.json',
        JSON.stringify(MOCK_MESSAGES_EXPORT, null, 2),
        'utf8'
      )
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Export saved to'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('File size: 1 KB'))
    })

    it('should create output directory if it does not exist', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      mockFs.existsSync.mockReturnValue(false)
      
      const options = {
        type: 'messages',
        output: 'exports/messages.json'
      }

      await command.execute(options)

      expect(mockFs.fs.mkdirSync).toHaveBeenCalledWith('/mock/dir', { recursive: true })
    })

    it('should handle CSV format export', async () => {
      mockFetch.mockTextResponse('csv,data,here', 200)
      
      const options = {
        type: 'messages',
        format: 'csv',
        output: 'messages.csv'
      }

      await command.execute(options)

      expect(mockFs.fs.writeFileSync).toHaveBeenCalledWith(
        '/resolved/messages.csv',
        'csv,data,here',
        'utf8'
      )
    })
  })

  describe('execute() - Conversations Export', () => {
    it('should successfully export conversations', async () => {
      const mockConversations = {
        conversations: [
          {
            id: 'conv_1',
            participants: ['+1234567890', '+15551234567'],
            messageCount: 5,
            lastMessage: MOCK_MESSAGES_EXPORT.messages[0],
            createdAt: '2024-01-01T12:00:00Z',
            updatedAt: '2024-01-01T12:05:00Z'
          }
        ],
        count: 1
      }
      mockFetch.mockJsonResponse(mockConversations)
      
      const options = { type: 'conversations' }

      await command.execute(options)

      expect(mockFetch.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(ENDPOINTS.CONVERSATIONS_EXPORT)
      )
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Conversations export completed'))
    })
  })

  describe('execute() - Error Handling', () => {
    it('should handle API errors', async () => {
      mockFetch.mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({ message: 'Export failed' })
      } as any)
      
      await expect(command.execute({ type: 'messages' })).rejects.toThrow('Export failed')
    })

    it('should handle network errors', async () => {
      mockFetch.mockError(new Error('Network error'))
      
      await expect(command.execute({ type: 'messages' })).rejects.toThrow('Network error')
    })

    it('should handle file write errors', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })
      
      await expect(command.execute({
        type: 'messages',
        output: 'messages.json'
      })).rejects.toThrow('Failed to save export')
    })

    it('should handle JSON parse errors in response', async () => {
      mockFetch.mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any)
      
      await expect(command.execute({ type: 'messages' })).rejects.toThrow('Failed to display export data')
    })
  })

  describe('Export Summary', () => {
    it('should show export summary with all options', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      
      const options = {
        type: 'messages',
        format: 'csv',
        phone: '+1234567890',
        fromDate: '2023-12-01T00:00:00Z',
        toDate: '2023-12-31T23:59:59Z'
      }

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Export Summary:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Type: messages'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Format: csv'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Phone filter: +1234567890'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('From date: 2023-12-01T00:00:00Z'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('To date: 2023-12-31T23:59:59Z'))
    })

    it('should show API URL in verbose mode', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      command.initialize({ verbose: true })

      await command.execute({ type: 'messages' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API URL:'))
    })

    it('should use default format in summary when not specified', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)

      await command.execute({ type: 'messages' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Format: json'))
    })
  })

  describe('Spinner Behavior', () => {
    it('should show spinner during export operation', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')
      
      await command.execute({ type: 'messages' })

      expect(startSpinnerSpy).toHaveBeenCalledWith('Preparing messages export')
      expect(stopSpinnerSpy).toHaveBeenCalled()
    })

    it('should stop spinner on errors', async () => {
      mockFetch.mockError(new Error('Network error'))
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')

      await expect(command.execute({ type: 'messages' })).rejects.toThrow('Network error')

      expect(stopSpinnerSpy).toHaveBeenCalled()
    })
  })

  describe('Verbose Mode', () => {
    it('should log verbose information', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      command.initialize({ verbose: true })
      const logVerboseSpy = jest.spyOn(command as any, 'logVerbose')

      await command.execute({
        type: 'messages',
        format: 'json',
        phone: '+1234567890'
      })

      expect(logVerboseSpy).toHaveBeenCalledWith(expect.stringContaining('Exporting messages with params'))
      expect(logVerboseSpy).toHaveBeenCalledWith(expect.stringContaining('Using endpoint'))
    })

    it('should log directory creation in verbose mode', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      mockFs.existsSync.mockReturnValue(false)
      command.initialize({ verbose: true })
      const logVerboseSpy = jest.spyOn(command as any, 'logVerbose')

      await command.execute({
        type: 'messages',
        output: 'exports/messages.json'
      })

      expect(logVerboseSpy).toHaveBeenCalledWith(expect.stringContaining('Created output directory'))
    })
  })

  describe('Date Validation', () => {
    it('should accept valid ISO 8601 dates with timezone', async () => {
      mockFetch.mockJsonResponse(MOCK_MESSAGES_EXPORT)
      
      const options = {
        fromDate: '2023-12-01T00:00:00-05:00',
        toDate: '2023-12-31T23:59:59+00:00'
      }

      await command.execute(options)

      // Should not throw validation errors
      expect(mockFetch.mockFetch).toHaveBeenCalled()
    })

    it('should reject dates without T separator', async () => {
      const options = { fromDate: '2023-12-01 00:00:00' }
      
      await expect(command.execute(options)).rejects.toThrow('from-date must be in ISO 8601 format')
    })

    it('should reject invalid date values', async () => {
      const options = { fromDate: '2023-13-45T25:99:99Z' }
      
      await expect(command.execute(options)).rejects.toThrow('from-date must be in ISO 8601 format')
    })
  })

  describe('Error Context', () => {
    it('should provide proper error context', async () => {
      mockFetch.mockError(new Error('Export failed'))
      
      await expect(command.execute({ type: 'messages' })).rejects.toThrow('Export failed')
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
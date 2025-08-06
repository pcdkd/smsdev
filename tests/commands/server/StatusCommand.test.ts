import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { StatusCommand } from '../../../src/commands/server/StatusCommand.js'
import { ApiError, CliError } from '../../../src/types/errors.js'
import { MockStatusModule } from '../../helpers/MockStatusModule.js'

/**
 * Testable version of StatusCommand that uses mock dependencies
 */
class TestableStatusCommand extends StatusCommand {
  private mockStatusModule: MockStatusModule

  constructor(mockStatusModule: MockStatusModule) {
    super()
    this.mockStatusModule = mockStatusModule
  }

  async execute(options: any): Promise<void> {
    try {
      await this.mockStatusModule.showStatus()
    } catch (error: any) {
      this.handleError(error, 'checking server status')
    }
  }
}

describe('StatusCommand', () => {
  let command: TestableStatusCommand
  let mockStatusModule: MockStatusModule
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    mockStatusModule = new MockStatusModule()
    command = new TestableStatusCommand(mockStatusModule)
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    // Reset all mocks
    mockStatusModule.reset()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('status')
      expect(command.description).toBe('Check sms-dev server status')
    })
  })

  describe('execute() - Successful Status Check', () => {
    it('should successfully show server status', async () => {
      const options = {}

      await command.execute(options)

      expect(mockStatusModule.showStatus).toHaveBeenCalledTimes(1)
      expect(mockStatusModule.showStatus).toHaveBeenCalledWith()
    })

    it('should handle options parameter correctly', async () => {
      const options = { verbose: true }

      await command.execute(options)

      expect(mockStatusModule.showStatus).toHaveBeenCalledTimes(1)
      expect(mockStatusModule.showStatus).toHaveBeenCalledWith()
    })

    it('should work with empty options', async () => {
      await command.execute({})

      expect(mockStatusModule.showStatus).toHaveBeenCalledTimes(1)
    })
  })

  describe('execute() - Error Handling', () => {
    it('should handle general errors during status check', async () => {
      const statusError = new Error('Network error')
      mockStatusModule.mockShowStatusError(statusError)

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'))
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it('should handle API errors with proper status codes', async () => {
      const apiError = new ApiError('API not responding', 503, '/health')
      mockStatusModule.mockShowStatusError(apiError)

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API Error'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('503'))
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it('should handle CLI errors with custom exit codes', async () => {
      const cliError = new CliError('STATUS_CHECK_FAILED', 'Unable to check server status', 2)
      mockStatusModule.mockShowStatusError(cliError)

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('STATUS_CHECK_FAILED'))
      expect(mockExit).toHaveBeenCalledWith(2)

      mockExit.mockRestore()
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout') as any
      timeoutError.name = 'AbortError'
      mockStatusModule.mockShowStatusError(timeoutError)

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Request timeout'))
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it('should handle unknown errors gracefully', async () => {
      const unknownError = { message: 'Something went wrong' }
      mockStatusModule.mockShowStatusError(unknownError)

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected error'))
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })
  })

  describe('Verbose Mode', () => {
    it('should initialize with verbose mode', () => {
      const options = { verbose: true }
      
      command.initialize(options)
      
      expect(command['verbose']).toBe(true)
    })

    it('should work correctly in verbose mode', async () => {
      command.initialize({ verbose: true })

      await command.execute({})

      expect(mockStatusModule.showStatus).toHaveBeenCalledTimes(1)
    })

    it('should show additional debug info in verbose mode during errors', async () => {
      const error = new Error('Test error')
      error.stack = 'Error stack trace'
      mockStatusModule.mockShowStatusError(error)
      
      command.initialize({ verbose: true })
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error stack trace'))

      mockExit.mockRestore()
    })
  })

  describe('Error Context', () => {
    it('should provide proper error context', async () => {
      const statusError = new Error('Status check failed')
      mockStatusModule.mockShowStatusError(statusError)
      
      const handleErrorSpy = jest.spyOn(command as any, 'handleError')
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')

      expect(handleErrorSpy).toHaveBeenCalledWith(statusError, 'checking server status')

      mockExit.mockRestore()
    })
  })

  describe('Multiple Status Checks', () => {
    it('should handle multiple status check calls', async () => {
      await command.execute({})
      await command.execute({})
      await command.execute({})

      expect(mockStatusModule.showStatus).toHaveBeenCalledTimes(3)
    })
  })

  describe('API URL Configuration', () => {
    it('should handle custom API URL', () => {
      const options = { apiUrl: 'http://custom-api:5001' }
      
      command.initialize(options)
      
      expect(command['apiUrl']).toBe('http://custom-api:5001')
    })
  })

  describe('Integration with BaseCommand', () => {
    it('should inherit from BaseCommand correctly', () => {
      expect(command).toHaveProperty('name')
      expect(command).toHaveProperty('description')
      expect(command).toHaveProperty('execute')
      expect(command).toHaveProperty('initialize')
    })

    it('should have access to BaseCommand protected methods', () => {
      expect(command['handleError']).toBeDefined()
      expect(command['logVerbose']).toBeDefined()
      expect(command['logError']).toBeDefined()
    })
  })
})
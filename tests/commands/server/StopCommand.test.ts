import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { StopCommand } from '../../../src/commands/server/StopCommand.js'
import { CliError } from '../../../src/types/errors.js'
import { MockStopModule } from '../../helpers/MockStopModule.js'

/**
 * Testable version of StopCommand that uses mock dependencies
 */
class TestableStopCommand extends StopCommand {
  private mockStopModule: MockStopModule

  constructor(mockStopModule: MockStopModule) {
    super()
    this.mockStopModule = mockStopModule
  }

  async execute(options: any): Promise<void> {
    this.startSpinner('Stopping sms-dev server')
    
    try {
      await this.mockStopModule.stopSmsDevServer()
      this.stopSpinner('sms-dev server stopped')
    } catch (error: any) {
      this.failSpinner('Failed to stop sms-dev server')
      this.handleError(error, 'stopping server')
    }
  }
}

describe('StopCommand', () => {
  let command: TestableStopCommand
  let mockStopModule: MockStopModule
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    mockStopModule = new MockStopModule()
    command = new TestableStopCommand(mockStopModule)
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    // Reset all mocks
    mockStopModule.reset()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('stop')
      expect(command.description).toBe('Stop the sms-dev server')
    })
  })

  describe('execute() - Successful Stop', () => {
    it('should successfully stop the server', async () => {
      const options = {}

      await command.execute(options)

      expect(mockStopModule.stopSmsDevServer).toHaveBeenCalledTimes(1)
      expect(mockStopModule.stopSmsDevServer).toHaveBeenCalledWith()
    })

    it('should handle options parameter correctly', async () => {
      const options = { verbose: true }

      await command.execute(options)

      expect(mockStopModule.stopSmsDevServer).toHaveBeenCalledTimes(1)
      expect(mockStopModule.stopSmsDevServer).toHaveBeenCalledWith()
    })
  })

  describe('execute() - Error Handling', () => {
    it('should handle server stop errors', async () => {
      const stopError = new Error('Failed to stop server')
      mockStopModule.mockStopError(stopError)

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to stop server'))
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it('should handle CLI errors with proper exit codes', async () => {
      const cliError = new CliError('STOP_FAILED', 'Unable to stop server', 3)
      mockStopModule.mockStopError(cliError)

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('STOP_FAILED'))
      expect(mockExit).toHaveBeenCalledWith(3)

      mockExit.mockRestore()
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout') as any
      timeoutError.name = 'AbortError'
      mockStopModule.mockStopError(timeoutError)

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Request timeout'))
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })
  })

  describe('Spinner Behavior', () => {
    it('should start spinner with correct message', async () => {
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')

      await command.execute({})

      expect(startSpinnerSpy).toHaveBeenCalledWith('Stopping sms-dev server')
    })

    it('should stop spinner with success message on successful stop', async () => {
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')

      await command.execute({})

      expect(stopSpinnerSpy).toHaveBeenCalledWith('sms-dev server stopped')
    })

    it('should fail spinner on error', async () => {
      const stopError = new Error('Stop failed')
      mockStopModule.mockStopError(stopError)
      
      const failSpinnerSpy = jest.spyOn(command as any, 'failSpinner')
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')

      expect(failSpinnerSpy).toHaveBeenCalledWith('Failed to stop sms-dev server')

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

      expect(mockStopModule.stopSmsDevServer).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Context', () => {
    it('should provide proper error context', async () => {
      const stopError = new Error('Stop failed')
      mockStopModule.mockStopError(stopError)
      
      const handleErrorSpy = jest.spyOn(command as any, 'handleError')
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')

      expect(handleErrorSpy).toHaveBeenCalledWith(stopError, 'stopping server')

      mockExit.mockRestore()
    })
  })

  describe('Multiple Stop Attempts', () => {
    it('should handle multiple stop calls gracefully', async () => {
      await command.execute({})
      await command.execute({})

      expect(mockStopModule.stopSmsDevServer).toHaveBeenCalledTimes(2)
    })
  })
})
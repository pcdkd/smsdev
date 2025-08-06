import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { StopCommand } from '../../../src/commands/server/StopCommand.js'
import * as startModule from '../../../src/commands/start.js'
import { CliError } from '../../../src/types/errors.js'

// Mock modules
jest.mock('../../../src/commands/start')

describe('StopCommand', () => {
  let command: StopCommand
  let mockStopSmsDevServer: jest.MockedFunction<typeof startModule.stopSmsDevServer>
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    command = new StopCommand()
    mockStopSmsDevServer = startModule.stopSmsDevServer as jest.MockedFunction<typeof startModule.stopSmsDevServer>
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    // Reset all mocks
    jest.clearAllMocks()
    
    // Default mock implementation
    mockStopSmsDevServer.mockResolvedValue(undefined)
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

      expect(mockStopSmsDevServer).toHaveBeenCalledTimes(1)
      expect(mockStopSmsDevServer).toHaveBeenCalledWith()
    })

    it('should handle options parameter correctly', async () => {
      const options = { verbose: true }

      await command.execute(options)

      expect(mockStopSmsDevServer).toHaveBeenCalledTimes(1)
      expect(mockStopSmsDevServer).toHaveBeenCalledWith()
    })
  })

  describe('execute() - Error Handling', () => {
    it('should handle server stop errors', async () => {
      const stopError = new Error('Failed to stop server')
      mockStopSmsDevServer.mockRejectedValue(stopError)

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
      mockStopSmsDevServer.mockRejectedValue(cliError)

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
      mockStopSmsDevServer.mockRejectedValue(timeoutError)

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
      mockStopSmsDevServer.mockRejectedValue(stopError)
      
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

      expect(mockStopSmsDevServer).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Context', () => {
    it('should provide proper error context', async () => {
      const stopError = new Error('Stop failed')
      mockStopSmsDevServer.mockRejectedValue(stopError)
      
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

      expect(mockStopSmsDevServer).toHaveBeenCalledTimes(2)
    })
  })
})
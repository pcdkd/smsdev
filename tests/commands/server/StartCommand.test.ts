import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { StartCommand } from '../../../src/commands/server/StartCommand.js'
import * as startModule from '../../../src/commands/start.js'
import * as configUtils from '../../../src/utils/config.js'
import { DEFAULT_TEST_CONFIG } from '../../fixtures/testConfig.js'
import { ValidationError, CliError } from '../../../src/types/errors.js'

// Mock modules
jest.mock('../../../src/commands/start')
jest.mock('../../../src/utils/config')

describe('StartCommand', () => {
  let command: StartCommand
  let mockStartSmsDevServer: jest.MockedFunction<typeof startModule.startSmsDevServer>
  let mockLoadConfig: jest.MockedFunction<typeof configUtils.loadConfig>
  let mockPrintConfig: jest.MockedFunction<typeof configUtils.printConfig>
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    command = new StartCommand()
    mockStartSmsDevServer = startModule.startSmsDevServer as jest.MockedFunction<typeof startModule.startSmsDevServer>
    mockLoadConfig = configUtils.loadConfig as jest.MockedFunction<typeof configUtils.loadConfig>
    mockPrintConfig = configUtils.printConfig as jest.MockedFunction<typeof configUtils.printConfig>
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    // Reset all mocks
    jest.clearAllMocks()
    
    // Default mock implementations
    mockLoadConfig.mockReturnValue(DEFAULT_TEST_CONFIG)
    mockStartSmsDevServer.mockResolvedValue(undefined)
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('start')
      expect(command.description).toBe('Start the sms-dev server (API + UI)')
    })
  })

  describe('execute() - Successful Start', () => {
    it('should successfully start server with default configuration', async () => {
      const options = {}

      await command.execute(options)

      expect(mockLoadConfig).toHaveBeenCalledWith({
        configFile: undefined,
        apiPort: undefined,
        uiPort: undefined,
        webhookUrl: undefined,
        startUI: true,
        verbose: false
      })
      
      expect(mockStartSmsDevServer).toHaveBeenCalledWith({
        apiPort: DEFAULT_TEST_CONFIG.apiPort,
        uiPort: DEFAULT_TEST_CONFIG.uiPort,
        startUI: DEFAULT_TEST_CONFIG.startUI,
        webhookUrl: DEFAULT_TEST_CONFIG.webhookUrl,
        verbose: DEFAULT_TEST_CONFIG.verbose
      })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API Server:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Virtual Phone UI:'))
    })

    it('should start server with custom options', async () => {
      const options = {
        config: '/custom/config.js',
        apiPort: '5001',
        uiPort: '5000',
        webhookUrl: 'http://test.com/webhook',
        verbose: true
      }

      await command.execute(options)

      expect(mockLoadConfig).toHaveBeenCalledWith({
        configFile: '/custom/config.js',
        apiPort: 5001,
        uiPort: 5000,
        webhookUrl: 'http://test.com/webhook',
        startUI: true,
        verbose: true
      })
    })

    it('should handle UI disabled option', async () => {
      const options = { ui: false }

      await command.execute(options)

      expect(mockLoadConfig).toHaveBeenCalledWith({
        configFile: undefined,
        apiPort: undefined,
        uiPort: undefined,
        webhookUrl: undefined,
        startUI: false,
        verbose: false
      })

      // Should not show UI URL when UI is disabled
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Virtual Phone UI:'))
    })

    it('should show config and exit when showConfig is true', async () => {
      const options = { showConfig: true }

      await command.execute(options)

      expect(mockPrintConfig).toHaveBeenCalledWith(DEFAULT_TEST_CONFIG)
      expect(mockStartSmsDevServer).not.toHaveBeenCalled()
    })
  })

  describe('execute() - Error Handling', () => {
    it('should handle server start errors', async () => {
      const startError = new Error('Port already in use')
      mockStartSmsDevServer.mockRejectedValue(startError)

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Port already in use'))
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it('should handle configuration loading errors', async () => {
      const configError = new ValidationError('Invalid port number', 'apiPort')
      mockLoadConfig.mockImplementation(() => {
        throw configError
      })

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Validation Error'))
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })
  })

  describe('Port Parsing', () => {
    it('should correctly parse string ports to numbers', async () => {
      const options = {
        apiPort: '8001',
        uiPort: '8000'
      }

      await command.execute(options)

      expect(mockLoadConfig).toHaveBeenCalledWith({
        configFile: undefined,
        apiPort: 8001,
        uiPort: 8000,
        webhookUrl: undefined,
        startUI: true,
        verbose: false
      })
    })

    it('should handle invalid port strings', async () => {
      const options = {
        apiPort: 'invalid',
        uiPort: 'also-invalid'
      }

      await command.execute(options)

      expect(mockLoadConfig).toHaveBeenCalledWith({
        configFile: undefined,
        apiPort: NaN,
        uiPort: NaN,
        webhookUrl: undefined,
        startUI: true,
        verbose: false
      })
    })
  })

  describe('Verbose Mode', () => {
    it('should initialize command with verbose mode', () => {
      const options = { verbose: true }
      
      command.initialize(options)
      
      expect(command['verbose']).toBe(true)
    })

    it('should pass verbose option to server start', async () => {
      const testConfig = { ...DEFAULT_TEST_CONFIG, verbose: true }
      mockLoadConfig.mockReturnValue(testConfig)
      
      const options = { verbose: true }
      await command.execute(options)

      expect(mockStartSmsDevServer).toHaveBeenCalledWith(expect.objectContaining({
        verbose: true
      }))
    })
  })

  describe('Server Information Display', () => {
    it('should display server information with both API and UI', async () => {
      await command.execute({})

      expect(consoleSpy).toHaveBeenCalledWith('')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/📡 API Server.*4001/))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/📱 Virtual Phone UI.*4000/))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Quick Start:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Press Ctrl+C to stop'))
    })

    it('should display server information without UI when disabled', async () => {
      const testConfig = { ...DEFAULT_TEST_CONFIG, startUI: false }
      mockLoadConfig.mockReturnValue(testConfig)

      await command.execute({ ui: false })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/📡 API Server.*4001/))
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Virtual Phone UI'))
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Open Virtual Phone'))
    })
  })

  describe('Spinner Behavior', () => {
    it('should start and stop spinner during execution', async () => {
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')

      await command.execute({})

      expect(startSpinnerSpy).toHaveBeenCalledWith('Starting sms-dev server')
      expect(stopSpinnerSpy).toHaveBeenCalledWith('sms-dev server started successfully!')
    })

    it('should handle spinner during errors', async () => {
      const startError = new Error('Startup failed')
      mockStartSmsDevServer.mockRejectedValue(startError)
      
      const handleErrorSpy = jest.spyOn(command as any, 'handleError')
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')

      expect(handleErrorSpy).toHaveBeenCalledWith(startError, 'starting server')

      mockExit.mockRestore()
    })
  })
})
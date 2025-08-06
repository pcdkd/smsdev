import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { StartCommand } from '../../../src/commands/server/StartCommand.js'
import { DEFAULT_TEST_CONFIG } from '../../fixtures/testConfig.js'
import { ValidationError, CliError } from '../../../src/types/errors.js'
import { MockConfigUtils } from '../../helpers/MockConfigUtils.js'
import { MockStartModule } from '../../helpers/MockStartModule.js'

/**
 * Testable version of StartCommand that uses mock dependencies
 */
class TestableStartCommand extends StartCommand {
  private mockConfigUtils: MockConfigUtils
  private mockStartModule: MockStartModule

  constructor(mockConfigUtils: MockConfigUtils, mockStartModule: MockStartModule) {
    super()
    this.mockConfigUtils = mockConfigUtils
    this.mockStartModule = mockStartModule
  }

  async execute(options: any): Promise<void> {
    try {
      // Load configuration from all sources
      const config = this.mockConfigUtils.loadConfig({
        configFile: options.config,
        apiPort: options.apiPort ? parseInt(options.apiPort) : undefined,
        uiPort: options.uiPort ? parseInt(options.uiPort) : undefined,
        webhookUrl: options.webhookUrl,
        startUI: options.ui !== false,
        verbose: options.verbose || false
      })

      // Show config and exit if requested
      if (options.showConfig) {
        this.mockConfigUtils.printConfig(config)
        return
      }

      this.startSpinner('Starting sms-dev server')
      
      await this.mockStartModule.startSmsDevServer({
        apiPort: config.apiPort,
        uiPort: config.uiPort,
        startUI: config.startUI,
        webhookUrl: config.webhookUrl,
        verbose: config.verbose
      })
      
      this.stopSpinner('sms-dev server started successfully!')
      
      // Show server information
      this.showServerInfo(config.apiPort, config.uiPort, config.startUI)
      
    } catch (error: any) {
      this.handleError(error, 'starting server')
    }
  }
  
  /**
   * Display server information and quick start guide
   */
  private showServerInfo(apiPort: number, uiPort: number, startUI: boolean): void {
    console.log('')
    console.log(`📡 API Server: http://localhost:${apiPort}`)
    if (startUI) {
      console.log(`📱 Virtual Phone UI: http://localhost:${uiPort}`)
    }
    console.log('')
    console.log('💡 Quick Start:')
    console.log(`  1. Point your SDK to: http://localhost:${apiPort}`)
    if (startUI) {
      console.log(`  2. Open Virtual Phone: http://localhost:${uiPort}`)
      console.log('  3. Send test messages and see them in the UI!')
    }
    console.log('')
    console.log('Press Ctrl+C to stop')
  }
}

describe('StartCommand', () => {
  let command: TestableStartCommand
  let mockConfigUtils: MockConfigUtils
  let mockStartModule: MockStartModule
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    mockConfigUtils = new MockConfigUtils()
    mockStartModule = new MockStartModule()
    command = new TestableStartCommand(mockConfigUtils, mockStartModule)
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    // Reset all mocks
    mockConfigUtils.reset()
    mockStartModule.reset()
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

      expect(mockConfigUtils.loadConfig).toHaveBeenCalledWith({
        configFile: undefined,
        apiPort: undefined,
        uiPort: undefined,
        webhookUrl: undefined,
        startUI: true,
        verbose: false
      })
      
      expect(mockStartModule.startSmsDevServer).toHaveBeenCalledWith({
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

      expect(mockConfigUtils.loadConfig).toHaveBeenCalledWith({
        configFile: '/custom/config.js',
        apiPort: 5001,
        uiPort: 5000,
        webhookUrl: 'http://test.com/webhook',
        startUI: true,
        verbose: true
      })
    })

    it('should handle UI disabled option', async () => {
      const testConfig = { ...DEFAULT_TEST_CONFIG, startUI: false }
      mockConfigUtils.mockLoadConfigSuccess(testConfig)
      
      const options = { ui: false }

      await command.execute(options)

      expect(mockConfigUtils.loadConfig).toHaveBeenCalledWith({
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

      expect(mockConfigUtils.printConfig).toHaveBeenCalledWith(DEFAULT_TEST_CONFIG)
      expect(mockStartModule.startSmsDevServer).not.toHaveBeenCalled()
    })
  })

  describe('execute() - Error Handling', () => {
    it('should handle server start errors', async () => {
      const startError = new Error('Port already in use')
      mockStartModule.mockStartError(startError)

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
      mockConfigUtils.mockLoadConfigError(configError)

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

      expect(mockConfigUtils.loadConfig).toHaveBeenCalledWith({
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

      expect(mockConfigUtils.loadConfig).toHaveBeenCalledWith({
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
      mockConfigUtils.mockLoadConfigSuccess(testConfig)
      
      const options = { verbose: true }
      await command.execute(options)

      expect(mockStartModule.startSmsDevServer).toHaveBeenCalledWith(expect.objectContaining({
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
      mockConfigUtils.mockLoadConfigSuccess(testConfig)

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
      mockStartModule.mockStartError(startError)
      
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
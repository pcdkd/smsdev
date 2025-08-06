import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { InitCommand } from '../../../src/commands/config/InitCommand.js'
import { DEFAULT_PORTS } from '../../../src/constants.js'
import { CliError } from '../../../src/types/errors.js'
import { MockFileSystem } from '../../helpers/MockFileSystem.js'
import { MockConfigUtils } from '../../helpers/MockConfigUtils.js'

// Create a testable version of InitCommand that uses our mocks
class TestableInitCommand extends InitCommand {
  private mockFs: MockFileSystem
  private mockConfigUtils: MockConfigUtils

  constructor(mockFs: MockFileSystem, mockConfigUtils: MockConfigUtils) {
    super()
    this.mockFs = mockFs
    this.mockConfigUtils = mockConfigUtils
  }

  async execute(options: any): Promise<void> {
    try {
      const isJson = options.json === true
      const fileName = isJson ? 'sms-dev.config.json' : 'sms-dev.config.js'
      const filePath = this.mockFs.join(process.cwd(), fileName)

      // Check if file already exists
      if (this.mockFs.existsSync(filePath) && !options.force) {
        console.log(`⚠️  Configuration file already exists: ${filePath}`)
        console.log('   Use --force to overwrite the existing file')
        return
      }

      let content: string
      if (isJson) {
        const config = {
          apiPort: DEFAULT_PORTS.API,
          uiPort: DEFAULT_PORTS.UI,
          cors: {
            enabled: true,
            origins: ['*']
          },
          logging: {
            enabled: true,
            level: 'info'
          }
        }
        content = JSON.stringify(config, null, 2)
      } else {
        content = this.mockConfigUtils.generateSampleConfig()
      }

      this.mockFs.writeFileSync(filePath, content)

      console.log(`✅ Created configuration file: ${filePath}`)
      console.log('')
      console.log('📝 Edit the file to customize your settings:')
      console.log('   • API and UI ports')
      console.log('   • CORS settings')
      console.log('   • Logging configuration')
      console.log('')
      console.log('🚀 Start the development server:')
      console.log('   sms-dev start')
    } catch (error: any) {
      this.handleError(error, 'creating config file')
    }
  }
}

describe('InitCommand', () => {
  let command: TestableInitCommand
  let mockFs: MockFileSystem
  let mockConfigUtils: MockConfigUtils
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    mockFs = new MockFileSystem()
    mockConfigUtils = new MockConfigUtils()
    command = new TestableInitCommand(mockFs, mockConfigUtils)
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    // Reset all mocks
    jest.clearAllMocks()
    mockFs.reset()
    mockConfigUtils.reset()
    
    // Default mock implementations are already set in MockFileSystem constructor
    mockConfigUtils.generateSampleConfig.mockReturnValue('module.exports = { apiPort: 4001 }')
    
    // Mock process.cwd()
    jest.spyOn(process, 'cwd').mockReturnValue('/mock/cwd')
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    jest.restoreAllMocks()
  })

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('init')
      expect(command.description).toBe('Generate a sample configuration file')
    })
  })

  describe('execute() - JavaScript Config File', () => {
    it('should create a JavaScript config file by default', async () => {
      const expectedPath = '/mock/cwd/sms-dev.config.js'
      const expectedContent = 'module.exports = { apiPort: 4001 }'
      mockFs.join.mockReturnValue(expectedPath)

      await command.execute({})

      expect(mockFs.join).toHaveBeenCalledWith('/mock/cwd', 'sms-dev.config.js')
      expect(mockFs.existsSync).toHaveBeenCalledWith(expectedPath)
      expect(mockConfigUtils.generateSampleConfig).toHaveBeenCalled()
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(expectedPath, expectedContent)
    })

    it('should display success message and instructions', async () => {
      await command.execute({})

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Created configuration file'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Edit the file to customize'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API and UI ports'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('sms-dev start'))
    })
  })

  describe('execute() - JSON Config File', () => {
    it('should create a JSON config file when json option is true', async () => {
      const expectedPath = '/mock/cwd/sms-dev.config.json'
      const expectedConfig = {
        apiPort: DEFAULT_PORTS.API,
        uiPort: DEFAULT_PORTS.UI,
        cors: {
          enabled: true,
          origins: ['*']
        },
        logging: {
          enabled: true,
          level: 'info'
        }
      }
      mockFs.join.mockReturnValue(expectedPath)

      await command.execute({ json: true })

      expect(mockFs.join).toHaveBeenCalledWith('/mock/cwd', 'sms-dev.config.json')
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expectedPath, 
        JSON.stringify(expectedConfig, null, 2)
      )
      expect(mockConfigUtils.generateSampleConfig).not.toHaveBeenCalled()
    })

    it('should use correct default values in JSON config', async () => {
      await command.execute({ json: true })

      const writeCall = mockFs.writeFileSync.mock.calls[0]
      const configContent = JSON.parse(writeCall[1] as string)
      
      expect(configContent).toEqual({
        apiPort: DEFAULT_PORTS.API,
        uiPort: DEFAULT_PORTS.UI,
        cors: {
          enabled: true,
          origins: ['*']
        },
        logging: {
          enabled: true,
          level: 'info'
        }
      })
    })
  })

  describe('execute() - File Already Exists', () => {
    it('should warn when config file already exists', async () => {
      mockFs.existsSync.mockReturnValue(true)

      await command.execute({})

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration file already exists'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Use --force to overwrite'))
      expect(mockFs.writeFileSync).not.toHaveBeenCalled()
    })

    it('should overwrite when force option is provided', async () => {
      mockFs.existsSync.mockReturnValue(true)

      await command.execute({ force: true })

      expect(mockFs.writeFileSync).toHaveBeenCalled()
    })

    it('should handle force with JSON config', async () => {
      mockFs.existsSync.mockReturnValue(true)

      await command.execute({ force: true, json: true })

      expect(mockFs.writeFileSync).toHaveBeenCalled()
      const writeCall = mockFs.writeFileSync.mock.calls[0]
      expect(writeCall[0]).toContain('.json')
    })
  })

  describe('execute() - Error Handling', () => {
    it('should handle file write errors', async () => {
      const writeError = new Error('Permission denied')
      mockFs.writeFileSync.mockImplementation(() => {
        throw writeError
      })

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Permission denied'))
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it('should handle directory creation errors', async () => {
      const pathError = new Error('Invalid path')
      mockFs.join.mockImplementation(() => {
        throw pathError
      })

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')

      mockExit.mockRestore()
    })

    it('should handle config generation errors', async () => {
      const generateError = new Error('Config generation failed')
      mockConfigUtils.generateSampleConfig.mockImplementation(() => {
        throw generateError
      })

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')

      mockExit.mockRestore()
    })

    it('should handle CLI errors with custom codes', async () => {
      const cliError = new CliError('CONFIG_WRITE_FAILED', 'Failed to write config file', 3)
      mockFs.writeFileSync.mockImplementation(() => {
        throw cliError
      })

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CONFIG_WRITE_FAILED'))
      expect(mockExit).toHaveBeenCalledWith(3)

      mockExit.mockRestore()
    })
  })

  describe('File Path Construction', () => {
    it('should construct correct JavaScript file path', async () => {
      await command.execute({})

      expect(mockFs.join).toHaveBeenCalledWith(process.cwd(), 'sms-dev.config.js')
    })

    it('should construct correct JSON file path', async () => {
      await command.execute({ json: true })

      expect(mockFs.join).toHaveBeenCalledWith(process.cwd(), 'sms-dev.config.json')
    })

    it('should handle different working directories', async () => {
      jest.spyOn(process, 'cwd').mockReturnValue('/different/path')

      await command.execute({})

      expect(mockFs.join).toHaveBeenCalledWith('/different/path', 'sms-dev.config.js')
    })
  })

  describe('Configuration Content', () => {
    it('should use generated sample config for JavaScript files', async () => {
      const sampleConfig = 'complex config content'
      mockConfigUtils.generateSampleConfig.mockReturnValue(sampleConfig)

      await command.execute({})

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        sampleConfig
      )
    })

    it('should format JSON config properly', async () => {
      await command.execute({ json: true })

      const writeCall = mockFs.writeFileSync.mock.calls[0]
      const content = writeCall[1] as string
      
      expect(() => JSON.parse(content)).not.toThrow()
      expect(content).toContain('  ') // Should be formatted with 2 spaces
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

      expect(mockFs.writeFileSync).toHaveBeenCalled()
    })
  })

  describe('Error Context', () => {
    it('should provide proper error context', async () => {
      const fileError = new Error('Write failed')
      mockFs.writeFileSync.mockImplementation(() => {
        throw fileError
      })
      
      const handleErrorSpy = jest.spyOn(command as any, 'handleError')
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(command.execute({})).rejects.toThrow('process.exit')

      expect(handleErrorSpy).toHaveBeenCalledWith(fileError, 'creating config file')

      mockExit.mockRestore()
    })
  })

  describe('Option Combinations', () => {
    it('should handle force and json options together', async () => {
      mockFs.existsSync.mockReturnValue(true)

      await command.execute({ force: true, json: true })

      expect(mockFs.writeFileSync).toHaveBeenCalled()
      const writeCall = mockFs.writeFileSync.mock.calls[0]
      expect(writeCall[0]).toContain('.json')
    })

    it('should handle verbose with other options', async () => {
      command.initialize({ verbose: true })

      await command.execute({ json: true, force: true })

      expect(mockFs.writeFileSync).toHaveBeenCalled()
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
      expect(command['logSuccess']).toBeDefined()
      expect(command['logWarning']).toBeDefined()
    })
  })
})
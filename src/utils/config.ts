import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { SmsDevConfig, CliConfig, ConfigOptions } from '../types/config.js'
import { ConfigValidator } from './configValidation.js'
import { ValidationError } from '../types/errors.js'

// Create require for loading CommonJS modules in ES module context
const require = createRequire(import.meta.url)

// Default configuration values
const defaultConfig: SmsDevConfig = {
  apiPort: 4001,
  uiPort: 4000,
  webhookUrl: undefined,
  cors: {
    enabled: true,
    origins: ['*']
  },
  logging: {
    level: 'info',
    enabled: true
  }
}

/**
 * Simple configuration loading for local development:
 * 1. CLI arguments (highest priority)
 * 2. Environment variables
 * 3. Configuration file
 * 4. Default values (lowest priority)
 */
export async function loadConfig(options: ConfigOptions = {}): Promise<CliConfig> {
  try {
    // Start with defaults
    let config: CliConfig = {
      ...defaultConfig,
      startUI: true,
      verbose: false
    }

    // 1. Load from configuration file
    const fileConfig = loadConfigFile(options.configFile)
    if (fileConfig) {
      config = { ...config, ...fileConfig }
    }

    // 2. Load from environment variables
    const envConfig = loadEnvironmentConfig()
    config = { ...config, ...envConfig }

    // 3. Apply CLI arguments (highest priority)
    if (options.apiPort) config.apiPort = options.apiPort
    if (options.uiPort) config.uiPort = options.uiPort
    if (options.webhookUrl) config.webhookUrl = options.webhookUrl
    if (typeof options.startUI !== 'undefined') config.startUI = options.startUI
    if (typeof options.verbose !== 'undefined') config.verbose = options.verbose
    if (options.configFile) config.configFile = options.configFile

    // Simple validation
    const validation = ConfigValidator.validateCliConfig(config)
    if (!validation.isValid) {
      throw new ValidationError(ConfigValidator.getValidationMessage(validation.errors))
    }

    return config

  } catch (error) {
    if (error instanceof ValidationError) {
      const helpMessage = error.message + 
        `\n\n🔧 Configuration Help:` +
        `\n  • Run "sms-dev init" to create a sample config file` +
        `\n  • Run "sms-dev config" to view current settings` +
        `\n  • Use --help for command-line options`
      
      throw new ValidationError(helpMessage)
    }
    throw error
  }
}

/**
 * Load configuration from a file (simplified)
 */
function loadConfigFile(configFile?: string): Partial<SmsDevConfig> | null {
  const configPaths = configFile ? [configFile] : findConfigFiles()
  
  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) {
        if (configFile) {
          throw new ValidationError(`Configuration file not found: ${configPath}`)
        }
        continue
      }

      const ext = path.extname(configPath).toLowerCase()
      const absolutePath = path.resolve(configPath)
      let config: any

      if (ext === '.json' || path.basename(configPath).startsWith('.smsdevrc')) {
        const content = fs.readFileSync(configPath, 'utf8')
        config = JSON.parse(content)
      } else if (ext === '.js') {
        // Clear require cache to ensure fresh load
        delete require.cache[absolutePath]
        config = require(absolutePath)
        
        // Handle both default exports and direct exports
        if (config.default) {
          config = config.default
        }
      } else {
        continue
      }

      return config

    } catch (error: any) {
      if (configFile) {
        // If specific file was requested, propagate the error
        throw new ValidationError(`Error loading config file ${configPath}: ${error.message}`)
      }
      // Otherwise, try next config file
      continue
    }
  }

  return null
}

/**
 * Load configuration from environment variables (simplified)
 */
function loadEnvironmentConfig(): Partial<CliConfig> {
  const config: Partial<CliConfig> = {}

  // Load environment variables with SMS_DEV_ prefix
  if (process.env.SMS_DEV_API_PORT) {
    const port = parseInt(process.env.SMS_DEV_API_PORT)
    if (!isNaN(port)) config.apiPort = port
  }

  if (process.env.SMS_DEV_UI_PORT) {
    const port = parseInt(process.env.SMS_DEV_UI_PORT)
    if (!isNaN(port)) config.uiPort = port
  }

  if (process.env.SMS_DEV_WEBHOOK_URL) {
    config.webhookUrl = process.env.SMS_DEV_WEBHOOK_URL
  }

  if (process.env.SMS_DEV_NO_UI === 'true') {
    config.startUI = false
  }

  if (process.env.SMS_DEV_VERBOSE === 'true') {
    config.verbose = true
  }

  // CORS origins
  if (process.env.SMS_DEV_CORS_ORIGINS) {
    const origins = process.env.SMS_DEV_CORS_ORIGINS.split(',').map(o => o.trim())
    config.cors = { enabled: true, origins }
  }

  return config
}

/**
 * Find configuration files in standard locations
 */
function findConfigFiles(): string[] {
  const cwd = process.cwd()
  const configFiles = [
    path.join(cwd, 'sms-dev.config.js'),
    path.join(cwd, 'sms-dev.config.json'),
    path.join(cwd, '.smsdevrc'),
    path.join(cwd, '.smsdevrc.json')
  ]

  return configFiles
}

/**
 * Resolve configuration file path
 */
export function resolveConfigPath(configFile?: string): string | null {
  if (!configFile) {
    // Find the first existing config file
    const configFiles = findConfigFiles()
    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        return file
      }
    }
    return null
  }

  // Resolve provided config file path
  const resolved = path.resolve(configFile)
  return fs.existsSync(resolved) ? resolved : null
}

/**
 * Show current configuration
 */
export async function showConfig(options: ConfigOptions = {}): Promise<void> {
  try {
    const config = await loadConfig(options)
    console.log('Current SMS-Dev Configuration:')
    console.log(JSON.stringify(config, null, 2))
  } catch (error: any) {
    console.error('Error loading configuration:', error.message)
    throw error
  }
}

/**
 * Generate sample configuration file
 */
export function generateSampleConfig(format: 'js' | 'json' = 'js'): string {
  const config = {
    apiPort: 4001,
    uiPort: 4000,
    webhookUrl: 'https://example.com/webhook',
    cors: {
      enabled: true,
      origins: ['http://localhost:3000']
    },
    logging: {
      level: 'info',
      enabled: true
    }
  }

  if (format === 'json') {
    return JSON.stringify(config, null, 2)
  }

  return `module.exports = ${JSON.stringify(config, null, 2)}`
}

/**
 * Pretty print configuration (alias for showConfig for backward compatibility)
 */
export const printConfig = showConfig
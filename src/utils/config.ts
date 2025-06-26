import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { SmsDevConfig } from '@relay-works/sms-dev-types'

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

// Extended config interface for CLI-specific options
export interface CliConfig extends SmsDevConfig {
  startUI: boolean
  verbose: boolean
  configFile?: string
}

export interface ConfigOptions {
  configFile?: string
  apiPort?: number
  uiPort?: number
  webhookUrl?: string
  startUI?: boolean
  verbose?: boolean
}

/**
 * Load configuration from various sources in order of precedence:
 * 1. CLI arguments (highest priority)
 * 2. Environment variables
 * 3. Configuration file
 * 4. Default values (lowest priority)
 */
export function loadConfig(options: ConfigOptions = {}): CliConfig {
  // Start with defaults
  let config: CliConfig = {
    ...defaultConfig,
    startUI: true,
    verbose: false
  }

  // 1. Load from configuration file
  const fileConfig = loadConfigFile(options.configFile)
  if (fileConfig) {
    config = mergeConfig(config, fileConfig as Partial<CliConfig>)
  }

  // 2. Load from environment variables
  const envConfig = loadEnvironmentConfig()
  config = mergeConfig(config, envConfig)

  // 3. Apply CLI arguments (highest priority)
  const cliConfig: Partial<CliConfig> = {}
  if (options.apiPort) cliConfig.apiPort = options.apiPort
  if (options.uiPort) cliConfig.uiPort = options.uiPort
  if (options.webhookUrl) cliConfig.webhookUrl = options.webhookUrl
  if (typeof options.startUI !== 'undefined') cliConfig.startUI = options.startUI
  if (typeof options.verbose !== 'undefined') cliConfig.verbose = options.verbose
  
  config = mergeConfig(config, cliConfig)

  return config
}

/**
 * Load configuration from a file (JS, JSON, or auto-detect)
 */
function loadConfigFile(configFile?: string): Partial<SmsDevConfig> | null {
  const configPaths = configFile ? [configFile] : findConfigFiles()
  
  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) {
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
      } else if (ext === '.mjs') {
        // For ES modules, we need to use dynamic import
        // Note: This is more complex in practice, for now we'll recommend .js with CommonJS
        console.warn(`⚠️  ES modules (.mjs) not supported yet. Use .js with module.exports instead.`)
        continue
      } else {
        continue
      }

      console.log(`📋 Loaded configuration from: ${configPath}`)
      return validateConfig(config)
    } catch (error: any) {
      console.warn(`⚠️  Failed to load config file ${configPath}:`, error?.message || error)
    }
  }

  return null
}

/**
 * Find configuration files in common locations
 */
function findConfigFiles(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, 'sms-dev.config.js'),
    path.join(cwd, 'sms-dev.config.json'),
    path.join(cwd, '.smsdevrc'),
    path.join(cwd, '.smsdevrc.json'),
    path.join(cwd, '.smsdevrc.js')
  ]
}

/**
 * Load configuration from environment variables
 */
function loadEnvironmentConfig(): Partial<CliConfig> {
  const config: Partial<CliConfig> = {}

  // Port configuration
  if (process.env.SMS_DEV_API_PORT) {
    config.apiPort = parseInt(process.env.SMS_DEV_API_PORT)
  }
  if (process.env.SMS_DEV_UI_PORT) {
    config.uiPort = parseInt(process.env.SMS_DEV_UI_PORT)
  }

  // Webhook configuration
  if (process.env.SMS_DEV_WEBHOOK_URL) {
    config.webhookUrl = process.env.SMS_DEV_WEBHOOK_URL
  }

  // CORS configuration
  if (process.env.SMS_DEV_CORS_ORIGINS) {
    config.cors = {
      enabled: true,
      origins: process.env.SMS_DEV_CORS_ORIGINS.split(',').map(o => o.trim())
    }
  }

  // Logging configuration
  if (process.env.SMS_DEV_LOG_LEVEL) {
    const level = process.env.SMS_DEV_LOG_LEVEL.toLowerCase()
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      config.logging = {
        ...defaultConfig.logging,
        level: level as 'debug' | 'info' | 'warn' | 'error'
      }
    }
  }

  if (process.env.SMS_DEV_VERBOSE === 'true') {
    config.verbose = true
    config.logging = {
      ...config.logging || defaultConfig.logging,
      enabled: true
    }
  }

  // UI configuration
  if (process.env.SMS_DEV_NO_UI === 'true') {
    config.startUI = false
  }

  return config
}

/**
 * Validate configuration object
 */
function validateConfig(config: any): Partial<SmsDevConfig> {
  const validatedConfig: Partial<SmsDevConfig> = {}

  // Validate ports
  if (config.apiPort !== undefined) {
    const port = parseInt(config.apiPort)
    if (isNaN(port) || port < 1024 || port > 65535) {
      throw new Error(`Invalid apiPort: ${config.apiPort}. Must be between 1024-65535`)
    }
    validatedConfig.apiPort = port
  }

  if (config.uiPort !== undefined) {
    const port = parseInt(config.uiPort)
    if (isNaN(port) || port < 1024 || port > 65535) {
      throw new Error(`Invalid uiPort: ${config.uiPort}. Must be between 1024-65535`)
    }
    validatedConfig.uiPort = port
  }

  // Validate webhook URL
  if (config.webhookUrl !== undefined) {
    if (typeof config.webhookUrl !== 'string') {
      throw new Error('webhookUrl must be a string')
    }
    try {
      new URL(config.webhookUrl)
      validatedConfig.webhookUrl = config.webhookUrl
    } catch {
      throw new Error(`Invalid webhookUrl: ${config.webhookUrl}`)
    }
  }

  // Validate CORS
  if (config.cors !== undefined) {
    if (typeof config.cors !== 'object') {
      throw new Error('cors must be an object')
    }
    validatedConfig.cors = {
      enabled: Boolean(config.cors.enabled !== false),
      origins: Array.isArray(config.cors.origins) ? config.cors.origins : ['*']
    }
  }

  // Validate logging
  if (config.logging !== undefined) {
    if (typeof config.logging !== 'object') {
      throw new Error('logging must be an object')
    }
    validatedConfig.logging = {
      enabled: Boolean(config.logging.enabled !== false),
      level: ['debug', 'info', 'warn', 'error'].includes(config.logging.level) 
        ? config.logging.level 
        : 'info'
    }
  }

  return validatedConfig
}

/**
 * Merge two configuration objects (simple merge for our use case)
 */
function mergeConfig<T extends Record<string, any>>(base: T, override: Partial<T>): T {
  const result = { ...base }

  for (const key in override) {
    const overrideValue = override[key]
    
    if (overrideValue === undefined) {
      continue
    }

    if (typeof overrideValue === 'object' && overrideValue !== null && !Array.isArray(overrideValue) && typeof base[key] === 'object') {
      result[key] = { ...base[key], ...overrideValue }
    } else {
      result[key] = overrideValue as T[Extract<keyof T, string>]
    }
  }

  return result
}

/**
 * Generate a sample configuration file
 */
export function generateSampleConfig(): string {
  return `// sms-dev.config.js
// Configuration file for sms-dev local SMS development tool

/** @type {import('@relay-works/sms-dev-types').SmsDevConfig} */
module.exports = {
  // Server ports
  apiPort: 4001,
  uiPort: 4000,

  // Webhook URL for testing inbound messages
  // webhookUrl: 'http://localhost:3000/webhook/sms',

  // CORS configuration
  cors: {
    enabled: true,
    origins: ['*'] // Allow all origins in development
  },

  // Logging configuration
  logging: {
    enabled: true,
    level: 'info' // 'debug' | 'info' | 'warn' | 'error'
  }
}
`
}

/**
 * Print current configuration for debugging
 */
export function printConfig(config: CliConfig): void {
  console.log('📋 Current Configuration:')
  console.log('  API Port:', config.apiPort)
  console.log('  UI Port:', config.uiPort)
  console.log('  Start UI:', config.startUI)
  console.log('  Webhook URL:', config.webhookUrl || 'Not set')
  console.log('  Verbose:', config.verbose)
  console.log('  CORS Enabled:', config.cors.enabled)
  console.log('  Log Level:', config.logging.level)
} 
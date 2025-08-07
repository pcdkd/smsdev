import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { SmsDevConfig, CliConfig, ConfigOptions } from '../types/config.js'
import { configValidator } from './configValidation.js'
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

// Types are now imported from ../types/config.js

/**
 * Load configuration from various sources with enhanced validation:
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

    // 1. Validate and load from configuration file
    const fileConfig = await loadConfigFileWithValidation(options.configFile)
    if (fileConfig) {
      config = mergeConfig(config, fileConfig as Partial<CliConfig>)
    }

    // 2. Validate and load from environment variables
    const envConfig = await configValidator.validateEnvironmentConfig()
    config = mergeConfig(config, envConfig)

    // 3. Validate and apply CLI arguments (highest priority)
    const validatedCliOptions = await configValidator.validateCliArgs(options)
    const cliConfig: Partial<CliConfig> = {}
    if (validatedCliOptions.apiPort) cliConfig.apiPort = validatedCliOptions.apiPort
    if (validatedCliOptions.uiPort) cliConfig.uiPort = validatedCliOptions.uiPort
    if (validatedCliOptions.webhookUrl) cliConfig.webhookUrl = validatedCliOptions.webhookUrl
    if (typeof validatedCliOptions.startUI !== 'undefined') cliConfig.startUI = validatedCliOptions.startUI
    if (typeof validatedCliOptions.verbose !== 'undefined') cliConfig.verbose = validatedCliOptions.verbose
    if (validatedCliOptions.configFile) cliConfig.configFile = validatedCliOptions.configFile
    
    config = mergeConfig(config, cliConfig)

    // Final comprehensive validation of merged configuration
    const finalValidatedConfig = await configValidator.validateConfig(config, 'Final configuration')
    return mergeConfig(config, finalValidatedConfig)

  } catch (error) {
    if (error instanceof ValidationError) {
      // Enhanced error message with configuration help
      const enhancedMessage = error.getFormattedMessage() + 
        `\n\n🔧 Configuration Help:` +
        `\n  • Run "sms-dev init" to create a sample config file` +
        `\n  • Run "sms-dev config" to view current settings` +
        `\n  • Check environment variables (SMS_DEV_* prefix)` +
        `\n  • Use --help for command-line options`
      
      throw new ValidationError(enhancedMessage, error.field)
    }
    throw error
  }
}

/**
 * Load configuration from a file with enhanced validation
 */
async function loadConfigFileWithValidation(configFile?: string): Promise<Partial<SmsDevConfig> | null> {
  const configPaths = configFile ? [configFile] : findConfigFiles()
  
  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) {
        if (configFile) {
          // If a specific file was requested but doesn't exist, throw error
          throw new ValidationError(
            `Configuration file not found: ${configPath}`,
            'configFile'
          ).addSuggestions([
            'Check the file path for typos',
            'Use an absolute path if needed',
            'Run "sms-dev init" to create a sample config file'
          ])
        }
        continue
      }

      const ext = path.extname(configPath).toLowerCase()
      const absolutePath = path.resolve(configPath)
      let config: any

      try {
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
          throw new ValidationError(
            `ES modules (.mjs) not supported yet. Use .js with module.exports instead.`,
            'configFile'
          ).addSuggestions([
            'Rename the file from .mjs to .js',
            'Use module.exports = { ... } instead of export default',
            'Use .json format for simple configurations'
          ])
        } else {
          continue
        }
      } catch (error: any) {
        if (error instanceof ValidationError) {
          throw error
        }
        
        const fileError = new ValidationError(
          `Failed to parse config file "${configPath}": ${error.message}`,
          'configFile'
        )
        
        if (error instanceof SyntaxError) {
          if (ext === '.json') {
            fileError.addSuggestions([
              'Check for missing commas between properties',
              'Ensure all strings are in double quotes',
              'Verify brackets and braces are properly matched',
              'Remove trailing commas (not allowed in JSON)',
              'Use a JSON validator to check syntax'
            ])
          } else if (ext === '.js') {
            fileError.addSuggestions([
              'Check JavaScript syntax in the config file',
              'Ensure module.exports is properly defined',
              'Try using JSON format instead (.json extension)',
              'Check for syntax errors in the configuration object'
            ])
          }
        }
        
        throw fileError
      }

      console.log(`📋 Loaded configuration from: ${configPath}`)
      
      // Validate the loaded configuration
      return await configValidator.validateConfigFile(configPath, config)
      
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error
      }
      
      throw new ValidationError(
        `Failed to load config file ${configPath}: ${error?.message || error}`,
        'configFile'
      ).addSuggestions([
        'Check file permissions',
        'Ensure the file is readable',
        'Try using a different configuration format',
        'Run "sms-dev init" to create a sample config file'
      ])
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

// Environment and validation functions have been moved to configValidation.ts

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
 * Generate a comprehensive sample configuration file with validation-aware comments
 */
export function generateSampleConfig(): string {
  return `// sms-dev.config.js
// Configuration file for sms-dev local SMS development tool
// This configuration is validated automatically with detailed error messages

/** @type {import('@relay-works/sms-dev-types').SmsDevConfig} */
module.exports = {
  // Server Configuration
  // Both ports must be between 1024-65535 and cannot conflict
  apiPort: 4001,        // API server port (default: 4001)
  uiPort: 4000,         // UI server port (default: 4000)

  // Webhook Configuration
  // URL must be a valid HTTP/HTTPS endpoint with a specific path
  // HTTPS is recommended for external URLs (HTTP allowed for localhost)
  // webhookUrl: 'https://api.yourapp.com/webhooks/sms',
  // webhookUrl: 'http://localhost:3000/webhook', // Development example

  // CORS Configuration  
  // Controls which origins can access the API from browsers
  cors: {
    enabled: true,        // Enable/disable CORS (boolean)
    origins: ['*']        // Array of allowed origins or ['*'] for all
    // origins: ['http://localhost:3000', 'https://yourapp.com'] // Production example
  },

  // Logging Configuration
  // Controls console output and debugging information
  logging: {
    enabled: true,        // Enable/disable logging (boolean)
    level: 'info'         // Log level: 'debug' | 'info' | 'warn' | 'error'
  }

  // Additional Notes:
  // - Run "sms-dev config" to see current configuration
  // - Environment variables override these settings (SMS_DEV_* prefix)
  // - CLI arguments have highest priority
  // - Invalid configurations show detailed error messages with suggestions
}
`
}

/**
 * Generate environment variable documentation
 */
export function generateEnvironmentDocs(): string {
  return `# SMS-Dev Environment Variables
# All environment variables are optional and override configuration file settings

# Server Configuration
SMS_DEV_API_PORT=4001          # API server port (1024-65535)
SMS_DEV_UI_PORT=4000           # UI server port (1024-65535, different from API port)

# Webhook Configuration  
SMS_DEV_WEBHOOK_URL=https://api.example.com/webhook  # Must be valid URL with path

# CORS Configuration
SMS_DEV_CORS_ORIGINS="http://localhost:3000,https://yourapp.com"  # Comma-separated URLs

# Logging Configuration
SMS_DEV_LOG_LEVEL=info         # debug | info | warn | error
SMS_DEV_VERBOSE=true           # Enable verbose output (true/false)

# UI Configuration
SMS_DEV_NO_UI=false            # Disable UI server (true to disable)

# Configuration Help:
# - Invalid values show detailed error messages with suggestions
# - Run "sms-dev config" to see current configuration
# - Run "sms-dev init" to create sample config file
# - Use "sms-dev start --help" for CLI options
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
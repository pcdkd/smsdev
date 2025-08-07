/**
 * Enhanced configuration validation using the validation framework
 * Provides detailed error messages and comprehensive validation for all config sources
 */

import { 
  Validator,
  ValidationResults,
  ValidationSchema,
  createUrlRule,
  createIntegerRule,
  createEnumRule,
  createJsonSchemaRule,
  portRule
} from '../validation/index.js'
import { ValidationError } from '../types/errors.js'
import { SmsDevConfig, CliConfig, ConfigOptions } from '../types/config.js'

/**
 * Comprehensive configuration validation schema
 */
const configValidationSchema: ValidationSchema = {
  apiPort: {
    rules: [portRule],
    options: {
      required: false,
      context: 'API server port (default: 4001)'
    }
  },
  uiPort: {
    rules: [portRule],
    options: {
      required: false,
      context: 'UI server port (default: 4000)'
    }
  },
  webhookUrl: {
    rules: [createUrlRule({
      requireHttps: false, // Allow HTTP for localhost development
      requirePath: true,
      allowAccessibilityCheck: false // Skip reachability check during config validation
    })],
    options: {
      required: false,
      skipIfEmpty: true,
      context: 'URL to receive webhook notifications'
    }
  },
  cors: {
    rules: [createJsonSchemaRule({
      requiredProperties: ['enabled'],
      optionalProperties: ['origins'],
      propertyValidators: {
        enabled: (value) => {
          if (typeof value !== 'boolean') {
            return {
              isValid: false,
              error: 'enabled must be a boolean',
              suggestions: ['Use true or false']
            }
          }
          return { isValid: true, sanitizedValue: value }
        },
        origins: (value) => {
          if (!Array.isArray(value)) {
            return {
              isValid: false,
              error: 'origins must be an array',
              suggestions: [
                'Use ["*"] to allow all origins',
                'Use ["http://localhost:3000"] for specific origins',
                'Use ["http://localhost:3000", "https://app.example.com"] for multiple origins'
              ]
            }
          }
          
          for (let i = 0; i < value.length; i++) {
            const origin = value[i]
            if (typeof origin !== 'string') {
              return {
                isValid: false,
                error: `origins[${i}] must be a string`,
                suggestions: ['All origin entries must be strings']
              }
            }
            
            if (origin !== '*' && origin !== 'null') {
              try {
                new URL(origin)
              } catch {
                return {
                  isValid: false,
                  error: `origins[${i}] is not a valid URL: "${origin}"`,
                  suggestions: [
                    'Use "*" to allow all origins',
                    'Use complete URLs like "http://localhost:3000"',
                    'Use "null" to disable CORS for that origin'
                  ]
                }
              }
            }
          }
          
          return { isValid: true, sanitizedValue: value }
        }
      }
    })],
    options: {
      required: false,
      skipIfEmpty: true,
      context: 'CORS configuration for API server'
    }
  },
  logging: {
    rules: [createJsonSchemaRule({
      requiredProperties: [],
      optionalProperties: ['enabled', 'level'],
      propertyValidators: {
        enabled: (value) => {
          if (typeof value !== 'boolean') {
            return {
              isValid: false,
              error: 'enabled must be a boolean',
              suggestions: ['Use true or false']
            }
          }
          return { isValid: true, sanitizedValue: value }
        },
        level: (value) => {
          const validLevels = ['debug', 'info', 'warn', 'error']
          if (!validLevels.includes(value)) {
            return {
              isValid: false,
              error: `Invalid log level: "${value}"`,
              suggestions: [
                `Must be one of: ${validLevels.join(', ')}`,
                'Use "info" for normal operation',
                'Use "debug" for detailed troubleshooting',
                'Use "error" to only show errors'
              ]
            }
          }
          return { isValid: true, sanitizedValue: value }
        }
      }
    })],
    options: {
      required: false,
      skipIfEmpty: true,
      context: 'Logging configuration'
    }
  }
}

/**
 * CLI-specific validation schema (extends config schema)
 */
const cliConfigValidationSchema: ValidationSchema = {
  ...configValidationSchema,
  startUI: {
    rules: [{
      name: 'boolean_validation',
      priority: 95,
      validate: (value) => {
        if (typeof value !== 'boolean') {
          return {
            isValid: false,
            error: 'startUI must be a boolean',
            suggestions: ['Use true to start the UI server', 'Use false to run API only']
          }
        }
        return { isValid: true, sanitizedValue: value }
      }
    }],
    options: {
      required: false,
      context: 'Whether to start the UI server'
    }
  },
  verbose: {
    rules: [{
      name: 'boolean_validation',
      priority: 95,
      validate: (value) => {
        if (typeof value !== 'boolean') {
          return {
            isValid: false,
            error: 'verbose must be a boolean',
            suggestions: ['Use true for detailed output', 'Use false for normal output']
          }
        }
        return { isValid: true, sanitizedValue: value }
      }
    }],
    options: {
      required: false,
      context: 'Whether to show verbose output'
    }
  },
  configFile: {
    rules: [
      {
        name: 'config_file_validation',
        async: true,
        priority: 90,
        validate: async (value) => {
          if (typeof value !== 'string') {
            return {
              isValid: false,
              error: 'configFile must be a string',
              suggestions: ['Provide path to a .js or .json config file']
            }
          }
          
          const fs = await import('fs')
          
          if (!fs.existsSync(value)) {
            return {
              isValid: false,
              error: `Configuration file not found: ${value}`,
              suggestions: [
                'Check the file path for typos',
                'Use an absolute path if needed',
                'Run "sms-dev init" to create a sample config file'
              ]
            }
          }
          
          const allowedExtensions = ['.js', '.json', '']
          const ext = value.substring(value.lastIndexOf('.'))
          if (!allowedExtensions.includes(ext) && !value.endsWith('.smsdevrc')) {
            return {
              isValid: false,
              error: `Unsupported config file type: ${ext}`,
              suggestions: [
                'Use .js files (sms-dev.config.js)',
                'Use .json files (sms-dev.config.json)',
                'Use .smsdevrc files'
              ]
            }
          }
          
          return { isValid: true, sanitizedValue: value }
        }
      }
    ],
    options: {
      required: false,
      skipIfEmpty: true,
      context: 'Path to configuration file'
    }
  }
}

/**
 * Enhanced configuration validator with detailed error reporting
 */
export class ConfigValidator {
  private validator = new Validator()
  
  constructor() {
    // Pre-register validation rules for better performance
    this.setupValidationRules()
  }
  
  private setupValidationRules(): void {
    // Add rules from both schemas
    for (const [field, schema] of Object.entries(cliConfigValidationSchema)) {
      for (const rule of schema.rules) {
        this.validator.addRule(field, rule)
      }
    }
  }
  
  /**
   * Validate a complete configuration object
   */
  async validateConfig(config: any, context: string = 'Configuration'): Promise<Partial<CliConfig>> {
    try {
      const results = await this.validator.validateSchema(config, cliConfigValidationSchema)
      
      if (!results.isValid) {
        throw this.createConfigValidationError(results, context)
      }
      
      // Return sanitized configuration
      const sanitizedConfig: Partial<CliConfig> = {}
      for (const [field, result] of Object.entries(results.fieldResults)) {
        if (result.sanitizedValue !== undefined) {
          sanitizedConfig[field as keyof CliConfig] = result.sanitizedValue
        }
      }
      
      // Additional cross-field validation
      this.validatePortConflicts(sanitizedConfig)
      
      return sanitizedConfig
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      
      throw new ValidationError(
        `${context} validation failed: ${error.message}`,
        'config'
      )
    }
  }
  
  /**
   * Validate environment variables with detailed error context
   */
  async validateEnvironmentConfig(): Promise<Partial<CliConfig>> {
    const envVars = this.extractEnvironmentVariables()
    
    try {
      return await this.validateConfig(envVars, 'Environment variables')
    } catch (error) {
      if (error instanceof ValidationError) {
        // Enhance error message with environment variable context
        const enhancedMessage = this.enhanceEnvironmentError(error.message)
        throw new ValidationError(enhancedMessage, error.field)
      }
      throw error
    }
  }
  
  /**
   * Validate configuration file with enhanced error reporting
   */
  async validateConfigFile(filePath: string, configData: any): Promise<Partial<SmsDevConfig>> {
    const context = `Configuration file "${filePath}"`
    
    try {
      const results = await this.validator.validateSchema(configData, configValidationSchema)
      
      if (!results.isValid) {
        throw this.createConfigValidationError(results, context)
      }
      
      // Return sanitized configuration
      const sanitizedConfig: Partial<SmsDevConfig> = {}
      for (const [field, result] of Object.entries(results.fieldResults)) {
        if (result.sanitizedValue !== undefined) {
          sanitizedConfig[field as keyof SmsDevConfig] = result.sanitizedValue
        }
      }
      
      return sanitizedConfig
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      
      throw new ValidationError(
        `${context} validation failed: ${error.message}`,
        'configFile'
      )
    }
  }
  
  /**
   * Validate CLI arguments with context-aware error messages
   */
  async validateCliArgs(options: ConfigOptions): Promise<ConfigOptions> {
    const context = 'Command line arguments'
    
    try {
      const results = await this.validator.validateSchema(options, cliConfigValidationSchema)
      
      if (!results.isValid) {
        throw this.createConfigValidationError(results, context)
      }
      
      // Return sanitized options
      const sanitizedOptions: ConfigOptions = {}
      for (const [field, result] of Object.entries(results.fieldResults)) {
        if (result.sanitizedValue !== undefined) {
          sanitizedOptions[field as keyof ConfigOptions] = result.sanitizedValue
        }
      }
      
      return sanitizedOptions
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      
      throw new ValidationError(
        `${context} validation failed: ${error.message}`,
        'cliArgs'
      )
    }
  }
  
  /**
   * Extract and normalize environment variables
   */
  private extractEnvironmentVariables(): Partial<CliConfig> {
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
      config.logging = {
        enabled: true,
        level: process.env.SMS_DEV_LOG_LEVEL.toLowerCase() as any
      }
    }
    
    // Boolean flags
    if (process.env.SMS_DEV_VERBOSE === 'true') {
      config.verbose = true
    }
    if (process.env.SMS_DEV_NO_UI === 'true') {
      config.startUI = false
    }
    
    return config
  }
  
  /**
   * Validate port conflicts between API and UI servers
   */
  private validatePortConflicts(config: Partial<CliConfig>): void {
    if (config.apiPort && config.uiPort && config.apiPort === config.uiPort) {
      throw new ValidationError(
        `Port conflict: API port (${config.apiPort}) and UI port (${config.uiPort}) cannot be the same`,
        'port'
      ).addSuggestions([
        'Use different ports for API and UI servers',
        'Common setup: API on 4001, UI on 4000',
        'Ensure ports are not in use by other services'
      ])
    }
  }
  
  /**
   * Create detailed validation error from results
   */
  private createConfigValidationError(results: ValidationResults, context: string): ValidationError {
    const errors: string[] = []
    const suggestions: string[] = []
    
    for (const [field, result] of Object.entries(results.fieldResults)) {
      if (!result.isValid) {
        errors.push(`  ${field}: ${result.error}`)
        
        if (result.errorContext) {
          errors.push(`    Context: ${result.errorContext}`)
        }
        
        if (result.suggestions && result.suggestions.length > 0) {
          result.suggestions.forEach(suggestion => {
            suggestions.push(`    • ${field}: ${suggestion}`)
          })
        }
      }
    }
    
    let message = `${context} validation failed:\n${errors.join('\n')}`
    
    if (suggestions.length > 0) {
      message += `\n\n💡 Suggestions:\n${suggestions.join('\n')}`
    }
    
    message += `\n\n📋 Run "sms-dev config" to see current configuration`
    message += `\n📋 Run "sms-dev init" to create a sample config file`
    
    return new ValidationError(message, 'config')
  }
  
  /**
   * Enhance environment variable error messages with specific ENV var names
   */
  private enhanceEnvironmentError(message: string): string {
    const envVarMap: Record<string, string> = {
      'apiPort': 'SMS_DEV_API_PORT',
      'uiPort': 'SMS_DEV_UI_PORT',
      'webhookUrl': 'SMS_DEV_WEBHOOK_URL',
      'cors': 'SMS_DEV_CORS_ORIGINS',
      'logging': 'SMS_DEV_LOG_LEVEL',
      'verbose': 'SMS_DEV_VERBOSE',
      'startUI': 'SMS_DEV_NO_UI'
    }
    
    for (const [field, envVar] of Object.entries(envVarMap)) {
      message = message.replace(
        new RegExp(`\\b${field}:\\s`, 'g'),
        `${envVar} (${field}): `
      )
    }
    
    return message
  }
}

/**
 * Singleton instance for configuration validation
 */
export const configValidator = new ConfigValidator()
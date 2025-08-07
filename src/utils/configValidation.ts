/**
 * Simple configuration validation for SMS-Dev local development tool
 */

import { CLIValidator } from '../validation/index.js'
import { ValidationError } from '../types/errors.js'
import { SmsDevConfig, CliConfig } from '../types/config.js'

/**
 * Simple configuration validator for local dev tool
 */
export class ConfigValidator {
  
  /**
   * Validate configuration with simple checks appropriate for local dev
   */
  static validateConfig(config: Partial<SmsDevConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    try {
      // Validate ports if provided
      if (config.apiPort) {
        CLIValidator.validatePort('apiPort', config.apiPort, false)
      }
      
      if (config.uiPort) {
        CLIValidator.validatePort('uiPort', config.uiPort, false)
      }

      // Validate webhook URL if provided
      if (config.webhookUrl) {
        CLIValidator.validateUrl('webhookUrl', config.webhookUrl, false)
      }

      // Basic CORS validation
      if (config.cors && config.cors.origins) {
        if (!Array.isArray(config.cors.origins)) {
          errors.push('cors.origins must be an array')
        }
      }

    } catch (error: any) {
      if (error instanceof ValidationError) {
        errors.push(error.message)
      } else {
        errors.push(`Configuration error: ${error.message}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate CLI configuration (simplified)
   */
  static validateCliConfig(config: Partial<CliConfig>): { isValid: boolean; errors: string[] } {
    // For a local dev tool, most CLI config is optional
    // Just do basic checks on the values that are provided
    return this.validateConfig(config)
  }

  /**
   * Get user-friendly validation message
   */
  static getValidationMessage(errors: string[]): string {
    if (errors.length === 0) {
      return 'Configuration is valid'
    }

    return `Configuration errors:\n${errors.map(e => `  • ${e}`).join('\n')}`
  }
}
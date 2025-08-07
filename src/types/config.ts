/**
 * Configuration type definitions for SMS-Dev CLI
 * Provides comprehensive typing for all configuration sources
 */

import { SmsDevConfig as BaseSmsDevConfig } from '@relay-works/sms-dev-types'

// Re-export the base configuration type
export type SmsDevConfig = BaseSmsDevConfig

// Extended config interface for CLI-specific options
export interface CliConfig extends SmsDevConfig {
  /** Whether to start the UI server alongside the API */
  startUI: boolean
  /** Enable verbose logging and output */
  verbose: boolean
  /** Path to configuration file (if specified) */
  configFile?: string
}

// Options that can be passed via CLI arguments
export interface ConfigOptions {
  /** Path to configuration file */
  configFile?: string
  /** API server port */
  apiPort?: number
  /** UI server port */
  uiPort?: number
  /** Webhook URL for receiving SMS notifications */
  webhookUrl?: string
  /** Whether to start the UI server */
  startUI?: boolean
  /** Enable verbose output */
  verbose?: boolean
}

// Configuration source information for debugging
export interface ConfigSource {
  /** The source of this configuration value */
  source: 'default' | 'file' | 'environment' | 'cli'
  /** The file path (if source is 'file') */
  filePath?: string
  /** The environment variable name (if source is 'environment') */
  envVar?: string
  /** Whether this value was validated */
  validated: boolean
}

// Enhanced configuration with source tracking
export interface TrackedConfig extends CliConfig {
  /** Source information for each configuration field */
  _sources: Partial<Record<keyof CliConfig, ConfigSource>>
}

// Configuration validation result
export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  isValid: boolean
  /** The validated and sanitized configuration */
  config?: CliConfig
  /** Validation errors (if any) */
  errors: string[]
  /** Warnings about configuration values */
  warnings: string[]
  /** Suggestions for improving the configuration */
  suggestions: string[]
}
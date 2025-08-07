/**
 * Security configuration management for SMS-Dev CLI
 * Handles security settings based on environment and configuration profiles
 */

import { SecurityConfig, DEFAULT_DEV_SECURITY, DEFAULT_PROD_SECURITY } from './SecurityHeaders.js'
import { CliConfig } from '../types/config.js'

export type SecurityProfile = 'development' | 'production' | 'testing' | 'custom'

export interface EnhancedSecurityConfig extends SecurityConfig {
  /** Security profile being used */
  profile: SecurityProfile
  /** Environment-specific overrides */
  environment: {
    /** Allow insecure connections in development */
    allowInsecure: boolean
    /** Trust proxy headers */
    trustProxy: boolean
    /** Enable debug security headers */
    debugHeaders: boolean
  }
  /** API-specific security settings */
  api: {
    /** Maximum request body size */
    maxRequestSize: string
    /** Request timeout in milliseconds */
    requestTimeout: number
    /** Enable API key authentication */
    requireApiKey: boolean
    /** Webhook signature validation */
    validateWebhookSignatures: boolean
  }
  /** Logging and monitoring */
  monitoring: {
    /** Log security events */
    logSecurityEvents: boolean
    /** Log rate limit violations */
    logRateLimits: boolean
    /** Log suspicious requests */
    logSuspiciousRequests: boolean
  }
}

/**
 * Default security configurations for different profiles
 */
export const SECURITY_PROFILES: Record<SecurityProfile, Partial<EnhancedSecurityConfig>> = {
  development: {
    ...DEFAULT_DEV_SECURITY,
    profile: 'development',
    environment: {
      allowInsecure: true,
      trustProxy: false,
      debugHeaders: true
    },
    api: {
      maxRequestSize: '10mb',
      requestTimeout: 30000,
      requireApiKey: false,
      validateWebhookSignatures: false
    },
    monitoring: {
      logSecurityEvents: true,
      logRateLimits: false,
      logSuspiciousRequests: true
    }
  },

  production: {
    ...DEFAULT_PROD_SECURITY,
    profile: 'production',
    environment: {
      allowInsecure: false,
      trustProxy: true, // Usually behind reverse proxy in production
      debugHeaders: false
    },
    api: {
      maxRequestSize: '1mb',
      requestTimeout: 10000,
      requireApiKey: true,
      validateWebhookSignatures: true
    },
    monitoring: {
      logSecurityEvents: true,
      logRateLimits: true,
      logSuspiciousRequests: true
    }
  },

  testing: {
    ...DEFAULT_DEV_SECURITY,
    profile: 'testing',
    strictMode: false,
    enforceHttps: false,
    rateLimit: {
      enabled: false, // Disable for tests
      windowMs: 60000,
      max: 1000
    },
    environment: {
      allowInsecure: true,
      trustProxy: false,
      debugHeaders: false
    },
    api: {
      maxRequestSize: '5mb',
      requestTimeout: 5000,
      requireApiKey: false,
      validateWebhookSignatures: false
    },
    monitoring: {
      logSecurityEvents: false,
      logRateLimits: false,
      logSuspiciousRequests: false
    }
  },

  custom: {
    profile: 'custom',
    // Will be filled from configuration
  }
}

/**
 * Security configuration manager
 */
export class SecurityConfigManager {
  private config: EnhancedSecurityConfig

  constructor(profile: SecurityProfile = 'development', customConfig?: Partial<EnhancedSecurityConfig>) {
    const baseConfig = SECURITY_PROFILES[profile]
    
    if (profile === 'custom' && customConfig) {
      this.config = this.mergeConfigs(SECURITY_PROFILES.development, customConfig)
    } else {
      this.config = this.mergeConfigs(baseConfig, customConfig || {})
    }

    this.applyEnvironmentOverrides()
    this.validateConfiguration()
  }

  /**
   * Get the current security configuration
   */
  getConfig(): EnhancedSecurityConfig {
    return { ...this.config }
  }

  /**
   * Update security configuration
   */
  updateConfig(updates: Partial<EnhancedSecurityConfig>): void {
    this.config = this.mergeConfigs(this.config, updates)
    this.validateConfiguration()
  }

  /**
   * Get security profile from CLI configuration
   */
  static getProfileFromCliConfig(cliConfig: CliConfig): SecurityProfile {
    // Check environment variables
    const envProfile = process.env.SMS_DEV_SECURITY_PROFILE as SecurityProfile
    if (envProfile && Object.keys(SECURITY_PROFILES).includes(envProfile)) {
      return envProfile
    }

    // Check if we're in a production-like environment
    const nodeEnv = process.env.NODE_ENV
    if (nodeEnv === 'production') {
      return 'production'
    }

    if (nodeEnv === 'test') {
      return 'testing'
    }

    // Default to development for local usage
    return 'development'
  }

  /**
   * Create security config from CLI config
   */
  static fromCliConfig(cliConfig: CliConfig): SecurityConfigManager {
    const profile = this.getProfileFromCliConfig(cliConfig)
    
    // Extract security-related overrides from CLI config
    const customConfig: Partial<EnhancedSecurityConfig> = {}

    // Override CORS settings
    if (cliConfig.cors) {
      customConfig.cors = {
        enabled: cliConfig.cors.enabled,
        origins: cliConfig.cors.origins,
        credentials: false
      }
    }

    // Override based on webhook URL
    if (cliConfig.webhookUrl) {
      const url = new URL(cliConfig.webhookUrl)
      if (url.protocol === 'https:') {
        customConfig.api = {
          ...customConfig.api,
          validateWebhookSignatures: true
        }
      }
    }

    // Override based on verbose setting
    if (cliConfig.verbose) {
      customConfig.monitoring = {
        logSecurityEvents: true,
        logRateLimits: true,
        logSuspiciousRequests: true
      }
    }

    return new SecurityConfigManager(profile, customConfig)
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(): void {
    // HTTPS enforcement
    if (process.env.SMS_DEV_FORCE_HTTPS === 'true') {
      this.config.enforceHttps = true
    }

    // Rate limiting
    if (process.env.SMS_DEV_RATE_LIMIT_MAX) {
      const max = parseInt(process.env.SMS_DEV_RATE_LIMIT_MAX)
      if (!isNaN(max)) {
        this.config.rateLimit.max = max
      }
    }

    // CORS origins
    if (process.env.SMS_DEV_CORS_ORIGINS) {
      this.config.cors.origins = process.env.SMS_DEV_CORS_ORIGINS.split(',').map(o => o.trim())
    }

    // Strict mode
    if (process.env.SMS_DEV_STRICT_SECURITY === 'true') {
      this.config.strictMode = true
    }

    // Request timeout
    if (process.env.SMS_DEV_REQUEST_TIMEOUT) {
      const timeout = parseInt(process.env.SMS_DEV_REQUEST_TIMEOUT)
      if (!isNaN(timeout)) {
        this.config.api.requestTimeout = timeout
      }
    }
  }

  /**
   * Merge two configuration objects
   */
  private mergeConfigs(
    base: Partial<EnhancedSecurityConfig>, 
    override: Partial<EnhancedSecurityConfig>
  ): EnhancedSecurityConfig {
    const merged = { ...base } as EnhancedSecurityConfig

    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          merged[key as keyof EnhancedSecurityConfig] = {
            ...(merged[key as keyof EnhancedSecurityConfig] as any),
            ...value
          }
        } else {
          merged[key as keyof EnhancedSecurityConfig] = value as any
        }
      }
    }

    return merged
  }

  /**
   * Validate the current configuration
   */
  private validateConfiguration(): void {
    const config = this.config

    // Validate rate limit settings
    if (config.rateLimit.enabled) {
      if (config.rateLimit.max <= 0) {
        throw new Error('Rate limit max must be greater than 0')
      }
      if (config.rateLimit.windowMs <= 0) {
        throw new Error('Rate limit window must be greater than 0')
      }
    }

    // Validate HSTS settings
    if (config.hsts.enabled && !config.enforceHttps) {
      console.warn('HSTS is enabled but HTTPS enforcement is disabled. HSTS will have no effect.')
    }

    // Validate CORS settings
    if (config.cors.enabled && config.cors.origins.length === 0 && config.profile === 'production') {
      console.warn('CORS is enabled in production but no origins are specified. This may cause security issues.')
    }

    // Validate CSP settings
    if (config.csp.enabled && config.strictMode) {
      const scriptSrc = config.csp.directives['script-src']
      if (scriptSrc?.includes("'unsafe-inline'")) {
        console.warn('Unsafe inline scripts are allowed in strict mode. Consider using nonces instead.')
      }
    }

    // Validate API settings
    if (config.api.requestTimeout < 1000) {
      console.warn('Request timeout is very low. This may cause legitimate requests to fail.')
    }

    // Production-specific validations
    if (config.profile === 'production') {
      if (!config.enforceHttps) {
        console.error('HTTPS enforcement is disabled in production. This is not recommended.')
      }
      if (config.cors.origins.includes('*')) {
        console.error('Wildcard CORS origin (*) is not recommended in production.')
      }
      if (!config.api.requireApiKey) {
        console.warn('API key authentication is disabled in production.')
      }
    }
  }

  /**
   * Generate security configuration summary for logging
   */
  getSummary(): Record<string, any> {
    return {
      profile: this.config.profile,
      strictMode: this.config.strictMode,
      httpsEnforced: this.config.enforceHttps,
      cspEnabled: this.config.csp.enabled,
      hstsEnabled: this.config.hsts.enabled,
      corsEnabled: this.config.cors.enabled,
      corsOrigins: this.config.cors.origins.length,
      rateLimitEnabled: this.config.rateLimit.enabled,
      rateLimitMax: this.config.rateLimit.max,
      apiKeyRequired: this.config.api.requireApiKey,
      webhookValidation: this.config.api.validateWebhookSignatures
    }
  }

  /**
   * Check if current configuration is secure for production
   */
  isProductionReady(): { ready: boolean; issues: string[] } {
    const issues: string[] = []

    if (!this.config.enforceHttps) {
      issues.push('HTTPS enforcement is disabled')
    }

    if (!this.config.hsts.enabled) {
      issues.push('HTTP Strict Transport Security (HSTS) is disabled')
    }

    if (this.config.cors.origins.includes('*')) {
      issues.push('CORS allows all origins (*)')
    }

    if (!this.config.strictMode) {
      issues.push('Strict security mode is disabled')
    }

    if (!this.config.rateLimit.enabled) {
      issues.push('Rate limiting is disabled')
    } else if (this.config.rateLimit.max > 1000) {
      issues.push('Rate limit is very high (>1000 requests)')
    }

    if (!this.config.api.requireApiKey) {
      issues.push('API key authentication is not required')
    }

    const cspDirectives = this.config.csp.directives
    if (cspDirectives['script-src']?.includes("'unsafe-inline'") ||
        cspDirectives['script-src']?.includes("'unsafe-eval'")) {
      issues.push('Content Security Policy allows unsafe script execution')
    }

    return {
      ready: issues.length === 0,
      issues
    }
  }
}
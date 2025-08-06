/**
 * URL validation rules for SMS-Dev CLI
 * Validates URLs with security considerations for webhook endpoints
 */

import { ValidationRule, ValidationResult } from '../types.js'

/**
 * Basic URL format validation
 */
export const urlFormatRule: ValidationRule<string> = {
  name: 'url_format',
  priority: 95,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'URL must be a string',
        suggestions: ['Provide URL as a string value']
      }
    }

    const cleanValue = value.trim()
    
    if (cleanValue === '') {
      return {
        isValid: false,
        error: 'URL cannot be empty',
        suggestions: ['Provide a valid URL']
      }
    }

    try {
      const url = new URL(cleanValue)
      
      return {
        isValid: true,
        sanitizedValue: url.toString()
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid URL format: "${value}"`,
        suggestions: [
          'Use a complete URL with protocol (http:// or https://)',
          'Example: https://example.com/webhook',
          'Ensure the URL is properly formatted'
        ]
      }
    }
  }
}

/**
 * HTTP/HTTPS protocol validation
 */
export const httpProtocolRule: ValidationRule<string> = {
  name: 'http_protocol',
  priority: 90,
  validate: (value: string): ValidationResult => {
    try {
      const url = new URL(value)
      
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          isValid: false,
          error: `Unsupported protocol: ${url.protocol}`,
          suggestions: [
            'Use HTTP (http://) or HTTPS (https://) protocol',
            'HTTPS is recommended for security',
            'Example: https://example.com/webhook'
          ]
        }
      }

      return {
        isValid: true,
        sanitizedValue: value
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL for protocol validation',
        suggestions: ['Ensure the URL is properly formatted']
      }
    }
  }
}

/**
 * HTTPS enforcement rule (security)
 */
export const httpsOnlyRule: ValidationRule<string> = {
  name: 'https_only',
  priority: 85,
  validate: (value: string): ValidationResult => {
    try {
      const url = new URL(value)
      
      if (url.protocol !== 'https:') {
        // Allow localhost and development environments to use HTTP
        const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname) ||
                          url.hostname.endsWith('.local') ||
                          url.hostname.startsWith('192.168.') ||
                          url.hostname.startsWith('10.') ||
                          url.hostname.startsWith('172.')

        if (!isLocalhost) {
          return {
            isValid: false,
            error: 'HTTPS is required for external URLs',
            suggestions: [
              'Use HTTPS (https://) instead of HTTP',
              'HTTPS is required for security when sending webhook data',
              'HTTP is only allowed for localhost/development'
            ]
          }
        }
      }

      return {
        isValid: true,
        sanitizedValue: value
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL for HTTPS validation',
        suggestions: ['Ensure the URL is properly formatted']
      }
    }
  }
}

/**
 * Webhook URL validation (specific requirements for webhooks)
 */
export const webhookUrlRule: ValidationRule<string> = {
  name: 'webhook_url',
  priority: 80,
  validate: (value: string): ValidationResult => {
    try {
      const url = new URL(value)
      
      // Check for obvious security issues
      if (url.username || url.password) {
        return {
          isValid: false,
          error: 'Webhook URLs should not contain credentials in the URL',
          suggestions: [
            'Remove username/password from URL',
            'Use proper authentication headers instead',
            'Example: https://api.example.com/webhook (not https://user:pass@api.example.com/webhook)'
          ]
        }
      }

      // Check for reasonable path (webhooks usually have paths)
      if (url.pathname === '/') {
        return {
          isValid: false,
          error: 'Webhook URL should include a specific path',
          errorContext: 'Root path (/) is typically not a webhook endpoint',
          suggestions: [
            'Include a specific webhook path',
            'Example: https://api.example.com/webhook or https://api.example.com/hooks/sms'
          ]
        }
      }

      // Warn about non-standard ports
      let errorContext: string | undefined
      if (url.port && !['80', '443', '8080', '3000'].includes(url.port)) {
        errorContext = `Using non-standard port ${url.port} - ensure it's accessible`
      }

      return {
        isValid: true,
        sanitizedValue: value,
        errorContext
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid webhook URL format',
        suggestions: [
          'Use a complete URL with protocol and path',
          'Example: https://api.example.com/webhook'
        ]
      }
    }
  }
}

/**
 * URL accessibility validation (optional async check)
 */
export const urlAccessibleRule: ValidationRule<string> = {
  name: 'url_accessible',
  async: true,
  priority: 60,
  validate: async (value: string): Promise<ValidationResult> => {
    try {
      const url = new URL(value)
      
      // Skip accessibility check for localhost in development
      const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)
      
      if (isLocalhost) {
        return {
          isValid: true,
          sanitizedValue: value,
          errorContext: 'Skipped accessibility check for localhost'
        }
      }

      // Simple HEAD request to check if URL is reachable
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      try {
        const response = await fetch(value, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'SMS-Dev-CLI/1.0'
          }
        })

        clearTimeout(timeoutId)

        // Don't require 200 status - just that the server responds
        if (response.status >= 500) {
          return {
            isValid: false,
            error: `Webhook URL returned server error: ${response.status}`,
            errorContext: 'Server may be temporarily unavailable',
            suggestions: [
              'Check if the webhook server is running',
              'Verify the URL is correct',
              'Try again later if server is temporarily down'
            ]
          }
        }

        return {
          isValid: true,
          sanitizedValue: value,
          errorContext: `Server responded with status ${response.status}`
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        if (fetchError.name === 'AbortError') {
          return {
            isValid: false,
            error: 'Webhook URL is not accessible (timeout)',
            suggestions: [
              'Check if the server is running and reachable',
              'Verify firewall settings',
              'Ensure the URL is correct'
            ]
          }
        }

        return {
          isValid: false,
          error: `Cannot reach webhook URL: ${fetchError.message}`,
          suggestions: [
            'Check internet connection',
            'Verify the URL is correct and accessible',
            'Ensure the server is running'
          ]
        }
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL for accessibility check',
        suggestions: ['Ensure the URL is properly formatted']
      }
    }
  }
}

/**
 * Blocked domains/IPs validation (security)
 */
export const blockedDomainsRule = (blockedDomains: string[] = []): ValidationRule<string> => ({
  name: 'blocked_domains',
  priority: 95,
  validate: (value: string): ValidationResult => {
    try {
      const url = new URL(value)
      
      // Default blocked domains (internal/private IPs)
      const defaultBlocked = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '10.',
        '172.16.',
        '172.17.',
        '172.18.',
        '172.19.',
        '172.20.',
        '172.21.',
        '172.22.',
        '172.23.',
        '172.24.',
        '172.25.',
        '172.26.',
        '172.27.',
        '172.28.',
        '172.29.',
        '172.30.',
        '172.31.',
        '192.168.'
      ]

      const allBlocked = [...defaultBlocked, ...blockedDomains]
      const hostname = url.hostname.toLowerCase()

      const isBlocked = allBlocked.some(blocked => {
        if (blocked.endsWith('.')) {
          return hostname.startsWith(blocked)
        }
        return hostname === blocked || hostname.endsWith(`.${blocked}`)
      })

      if (isBlocked) {
        return {
          isValid: false,
          error: `Domain is blocked for security reasons: ${hostname}`,
          suggestions: [
            'Use a public domain for webhook endpoints',
            'Private/internal IPs are not allowed for webhooks',
            'Configure webhook to use a publicly accessible endpoint'
          ]
        }
      }

      return {
        isValid: true,
        sanitizedValue: value
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL for domain validation',
        suggestions: ['Ensure the URL is properly formatted']
      }
    }
  }
})

/**
 * Factory function to create comprehensive URL validation
 */
export function createUrlRule(options: {
  requireHttps?: boolean
  allowAccessibilityCheck?: boolean
  blockedDomains?: string[]
  requirePath?: boolean
}): ValidationRule<string> {
  return {
    name: 'comprehensive_url',
    async: options.allowAccessibilityCheck,
    priority: 90,
    validate: async (value: string): Promise<ValidationResult> => {
      // Basic format validation
      const formatResult = urlFormatRule.validate(value)
      if (!formatResult.isValid) {
        return formatResult
      }

      const sanitizedValue = formatResult.sanitizedValue!

      // Protocol validation
      const protocolResult = httpProtocolRule.validate(sanitizedValue)
      if (!protocolResult.isValid) {
        return protocolResult
      }

      // HTTPS requirement
      if (options.requireHttps) {
        const httpsResult = httpsOnlyRule.validate(sanitizedValue)
        if (!httpsResult.isValid) {
          return httpsResult
        }
      }

      // Domain blocking
      if (options.blockedDomains && options.blockedDomains.length > 0) {
        const domainResult = blockedDomainsRule(options.blockedDomains).validate(sanitizedValue)
        if (!domainResult.isValid) {
          return domainResult
        }
      }

      // Path requirement
      if (options.requirePath) {
        const url = new URL(sanitizedValue)
        if (url.pathname === '/') {
          return {
            isValid: false,
            error: 'URL must include a specific path',
            suggestions: [
              'Add a path to the URL',
              'Example: https://api.example.com/webhook'
            ]
          }
        }
      }

      // Accessibility check (if requested)
      if (options.allowAccessibilityCheck) {
        const accessResult = await urlAccessibleRule.validate(sanitizedValue)
        if (!accessResult.isValid) {
          return accessResult
        }
      }

      return {
        isValid: true,
        sanitizedValue
      }
    }
  }
}
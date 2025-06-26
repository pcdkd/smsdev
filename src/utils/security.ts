import { URL } from 'url'
import { resolve, normalize, join } from 'path'
import { existsSync, lstatSync } from 'fs'

export interface SecurityValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class SecurityValidator {
  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phone: string): SecurityValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (!phone || typeof phone !== 'string') {
      errors.push('Phone number must be a non-empty string')
      return { valid: false, errors, warnings }
    }
    
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '')
    
    if (cleaned.length < 10) {
      errors.push('Phone number must be at least 10 digits')
    }
    
    if (cleaned.length > 15) {
      errors.push('Phone number cannot exceed 15 digits')
    }
    
    // Check for common test numbers
    const testPatterns = [
      /^555/, // Common test prefix
      /^1234567890$/, // Sequential test number
      /^(\d)\1{9,}$/ // Repeated digits
    ]
    
    for (const pattern of testPatterns) {
      if (pattern.test(cleaned)) {
        warnings.push('Phone number appears to be a test number')
        break
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate SMS message content
   */
  static validateSMSContent(body: string): SecurityValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (typeof body !== 'string') {
      errors.push('Message body must be a string')
      return { valid: false, errors, warnings }
    }
    
    if (body.length === 0) {
      errors.push('Message body cannot be empty')
    }
    
    if (body.length > 1600) {
      errors.push('Message body cannot exceed 1600 characters')
    }
    
    // Check for potentially harmful content
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers
      /data:text\/html/i,
      /vbscript:/i
    ]
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(body)) {
        warnings.push('Message contains potentially suspicious content')
        break
      }
    }
    
    // Check for excessive special characters (potential injection)
    const specialCharCount = (body.match(/[<>'";&|$`]/g) || []).length
    if (specialCharCount > body.length * 0.1) {
      warnings.push('Message contains high percentage of special characters')
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate webhook URL
   */
  static validateWebhookURL(url: string): SecurityValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (!url || typeof url !== 'string') {
      errors.push('Webhook URL must be a non-empty string')
      return { valid: false, errors, warnings }
    }
    
    try {
      const parsedUrl = new URL(url)
      
      // Check protocol
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        errors.push('Webhook URL must use HTTP or HTTPS protocol')
      }
      
      // Warn about HTTP in production
      if (parsedUrl.protocol === 'http:' && !this.isLocalhost(parsedUrl.hostname)) {
        warnings.push('HTTP URLs are not secure for production use')
      }
      
      // Check for private/internal network ranges
      if (this.isPrivateNetwork(parsedUrl.hostname)) {
        warnings.push('Webhook URL points to private network')
      }
      
      // Check port ranges
      if (parsedUrl.port) {
        const port = parseInt(parsedUrl.port)
        if (port < 1 || port > 65535) {
          errors.push('Invalid port number')
        }
        if (port < 1024 && !this.isLocalhost(parsedUrl.hostname)) {
          warnings.push('Using privileged port on remote host')
        }
      }
      
    } catch (error) {
      errors.push('Invalid URL format')
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate file path for config files
   */
  static validateConfigPath(filePath: string): SecurityValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (!filePath || typeof filePath !== 'string') {
      errors.push('File path must be a non-empty string')
      return { valid: false, errors, warnings }
    }
    
    try {
      // Normalize and resolve the path
      const normalizedPath = normalize(filePath)
      const resolvedPath = resolve(normalizedPath)
      
      // Check for path traversal attempts
      if (normalizedPath.includes('..')) {
        errors.push('Path traversal detected in file path')
      }
      
      // Check if path is within reasonable bounds (not system directories)
      const systemPaths = ['/etc', '/bin', '/sbin', '/usr/bin', '/usr/sbin', '/root']
      for (const sysPath of systemPaths) {
        if (resolvedPath.startsWith(sysPath)) {
          errors.push('Cannot access system directories')
        }
      }
      
      // Check file extension
      const allowedExtensions = ['.js', '.json', '.ts', '.mjs']
      const hasValidExtension = allowedExtensions.some(ext => 
        resolvedPath.toLowerCase().endsWith(ext)
      )
      
      if (!hasValidExtension && !resolvedPath.includes('.smsdevrc')) {
        warnings.push('Unusual file extension for configuration file')
      }
      
      // Check if file exists and is readable
      if (existsSync(resolvedPath)) {
        const stats = lstatSync(resolvedPath)
        
        if (stats.isSymbolicLink()) {
          warnings.push('Configuration file is a symbolic link')
        }
        
        if (!stats.isFile()) {
          errors.push('Path does not point to a regular file')
        }
      }
      
    } catch (error) {
      errors.push('Invalid file path')
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate API key format (for future use)
   */
  static validateAPIKey(apiKey: string): SecurityValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (!apiKey || typeof apiKey !== 'string') {
      errors.push('API key must be a non-empty string')
      return { valid: false, errors, warnings }
    }
    
    if (apiKey.length < 16) {
      errors.push('API key must be at least 16 characters long')
    }
    
    if (apiKey.length > 128) {
      errors.push('API key cannot exceed 128 characters')
    }
    
    // Check for weak patterns
    const weakPatterns = [
      /^(test|demo|example|sample)/i,
      /^(1234|abcd|0000)/,
      /^(.)\1{7,}$/ // Repeated characters
    ]
    
    for (const pattern of weakPatterns) {
      if (pattern.test(apiKey)) {
        warnings.push('API key appears to be a test or weak key')
        break
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Sanitize input string for logging
   */
  static sanitizeForLog(input: string, maxLength: number = 100): string {
    if (typeof input !== 'string') {
      return '[non-string]'
    }
    
    // Remove potentially sensitive patterns
    let sanitized = input
      .replace(/[<>'"&]/g, '') // Remove HTML/XML special chars
      .replace(/\n\r?/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim()
    
    // Truncate if too long
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...'
    }
    
    return sanitized
  }

  /**
   * Check if hostname is localhost
   */
  private static isLocalhost(hostname: string): boolean {
    const localhostPatterns = [
      'localhost',
      '127.0.0.1',
      '::1',
      '0.0.0.0'
    ]
    return localhostPatterns.includes(hostname.toLowerCase())
  }

  /**
   * Check if hostname is in private network range
   */
  private static isPrivateNetwork(hostname: string): boolean {
    // Basic check for private IP ranges
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./ // Link-local
    ]
    
    return privatePatterns.some(pattern => pattern.test(hostname))
  }
}

/**
 * Express middleware for basic input validation
 */
export function createSecurityMiddleware() {
  return (req: any, res: any, next: any) => {
    // Basic request size limit
    const contentLength = parseInt(req.headers['content-length'] || '0')
    if (contentLength > 10 * 1024 * 1024) { // 10MB limit
      return res.status(413).json({
        error: 'Request entity too large',
        maxSize: '10MB'
      })
    }
    
    // Log security events
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      const sanitizedUrl = SecurityValidator.sanitizeForLog(req.url)
      const sanitizedUserAgent = SecurityValidator.sanitizeForLog(
        req.headers['user-agent'] || 'unknown'
      )
      
      console.log(`🔒 ${req.method} ${sanitizedUrl} from ${req.ip} (${sanitizedUserAgent})`)
    }
    
    next()
  }
}

/**
 * Rate limiting utility
 */
export class RateLimiter {
  private requests = new Map<string, number[]>()
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    
    // Clean up old entries every minute
    setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  /**
   * Check if request is allowed
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs)
    
    if (validRequests.length >= this.maxRequests) {
      return false
    }
    
    // Add current request
    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    
    return true
  }

  /**
   * Get remaining requests for identifier
   */
  getRemainingRequests(identifier: string): number {
    const requests = this.requests.get(identifier) || []
    const now = Date.now()
    const validRequests = requests.filter(time => now - time < this.windowMs)
    
    return Math.max(0, this.maxRequests - validRequests.length)
  }

  private cleanup(): void {
    const now = Date.now()
    
    for (const [identifier, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => now - time < this.windowMs)
      
      if (validRequests.length === 0) {
        this.requests.delete(identifier)
      } else {
        this.requests.set(identifier, validRequests)
      }
    }
  }
}

/**
 * Global rate limiter instance
 */
export const globalRateLimiter = new RateLimiter() 
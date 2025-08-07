/**
 * Security headers and HTTPS enforcement for SMS-Dev API server
 * Implements enterprise-grade security best practices
 */

import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

export interface SecurityConfig {
  /** Enable strict security headers */
  strictMode: boolean
  /** Enable HTTPS enforcement */
  enforceHttps: boolean
  /** Content Security Policy configuration */
  csp: {
    enabled: boolean
    directives: Record<string, string[]>
  }
  /** HTTP Strict Transport Security configuration */
  hsts: {
    enabled: boolean
    maxAge: number
    includeSubDomains: boolean
    preload: boolean
  }
  /** Cross-Origin Resource Sharing configuration */
  cors: {
    enabled: boolean
    origins: string[]
    credentials: boolean
  }
  /** Rate limiting configuration */
  rateLimit: {
    enabled: boolean
    windowMs: number
    max: number
  }
  /** Request body limits */
  bodyLimits: {
    json: string
    urlencoded: string
  }
}

/**
 * Default security configuration for development
 */
export const DEFAULT_DEV_SECURITY: SecurityConfig = {
  strictMode: false,
  enforceHttps: false, // Allow HTTP in development
  csp: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"], // Allow inline scripts for dev
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'ws:', 'wss:'], // Allow WebSocket connections
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"]
    }
  },
  hsts: {
    enabled: false, // Disabled in development (HTTP)
    maxAge: 31536000, // 1 year
    includeSubDomains: false,
    preload: false
  },
  cors: {
    enabled: true,
    origins: ['*'], // Permissive for development
    credentials: false
  },
  rateLimit: {
    enabled: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // 1000 requests per window
  },
  bodyLimits: {
    json: '10mb',
    urlencoded: '10mb'
  }
}

/**
 * Default security configuration for production
 */
export const DEFAULT_PROD_SECURITY: SecurityConfig = {
  strictMode: true,
  enforceHttps: true,
  csp: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    }
  },
  hsts: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  cors: {
    enabled: true,
    origins: [], // Must be explicitly configured
    credentials: false
  },
  rateLimit: {
    enabled: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per window (more restrictive)
  },
  bodyLimits: {
    json: '1mb',
    urlencoded: '1mb'
  }
}

/**
 * Security headers middleware
 */
export class SecurityHeaders {
  private config: SecurityConfig
  private nonce: string = ''

  constructor(config: SecurityConfig) {
    this.config = config
  }

  /**
   * Generate a new nonce for CSP
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString('base64')
  }

  /**
   * HTTPS enforcement middleware
   */
  httpsEnforcement = (req: Request, res: Response, next: NextFunction): void => {
    if (!this.config.enforceHttps) {
      return next()
    }

    // Skip enforcement for localhost/development
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(req.hostname)
    const isPrivateIP = req.hostname.match(/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/)
    
    if (isLocalhost || isPrivateIP) {
      return next()
    }

    // Check for HTTPS
    const isHttps = req.secure || 
                   req.get('X-Forwarded-Proto') === 'https' ||
                   req.get('X-Forwarded-Ssl') === 'on'

    if (!isHttps) {
      const httpsUrl = `https://${req.get('Host')}${req.originalUrl}`
      
      if (req.method === 'GET') {
        // Redirect GET requests
        res.redirect(301, httpsUrl)
      } else {
        // Return error for other methods to avoid data loss
        res.status(403).json({
          error: 'HTTPS Required',
          message: 'This API requires HTTPS for security',
          httpsUrl
        })
      }
      return
    }

    next()
  }

  /**
   * Security headers middleware
   */
  securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Generate nonce for this request
    this.nonce = this.generateNonce()
    res.locals.nonce = this.nonce

    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff')

    // X-Frame-Options
    res.setHeader('X-Frame-Options', 'DENY')

    // X-XSS-Protection
    res.setHeader('X-XSS-Protection', '1; mode=block')

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

    // X-Permitted-Cross-Domain-Policies
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')

    // X-DNS-Prefetch-Control
    res.setHeader('X-DNS-Prefetch-Control', 'off')

    // Remove server header
    res.removeHeader('X-Powered-By')

    // Content Security Policy
    if (this.config.csp.enabled) {
      const cspDirectives = Object.entries(this.config.csp.directives)
        .map(([directive, values]) => {
          if (directive === 'script-src' && this.config.strictMode) {
            // Add nonce for strict mode
            return `${directive} 'nonce-${this.nonce}' ${values.join(' ')}`
          }
          return `${directive} ${values.join(' ')}`
        })
        .join('; ')

      res.setHeader('Content-Security-Policy', cspDirectives)
    }

    // HTTP Strict Transport Security (HSTS)
    if (this.config.hsts.enabled && req.secure) {
      let hstsValue = `max-age=${this.config.hsts.maxAge}`
      if (this.config.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains'
      }
      if (this.config.hsts.preload) {
        hstsValue += '; preload'
      }
      res.setHeader('Strict-Transport-Security', hstsValue)
    }

    // Cross-Origin-Embedder-Policy (for isolation)
    if (this.config.strictMode) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    }

    // Cache Control for API responses
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    }

    next()
  }

  /**
   * Request sanitization middleware
   */
  requestSanitization = (req: Request, res: Response, next: NextFunction): void => {
    // Sanitize headers
    const dangerousHeaders = [
      'x-forwarded-host',
      'x-forwarded-server',
      'x-real-ip'
    ]

    dangerousHeaders.forEach(header => {
      if (req.headers[header] && !this.isFromTrustedProxy(req)) {
        delete req.headers[header]
      }
    })

    // Validate request path
    if (this.containsSuspiciousPatterns(req.path)) {
      res.status(400).json({
        error: 'Invalid Request',
        message: 'Request path contains invalid characters'
      })
      return
    }

    // Validate query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string' && this.containsSuspiciousPatterns(value)) {
          res.status(400).json({
            error: 'Invalid Request',
            message: `Query parameter "${key}" contains invalid characters`
          })
          return
        }
      }
    }

    next()
  }

  /**
   * Check if request is from trusted proxy
   */
  private isFromTrustedProxy(req: Request): boolean {
    // Add logic to check trusted proxy IPs
    const trustedProxies = [
      '127.0.0.1',
      '::1'
    ]
    
    const clientIp = req.ip || req.connection.remoteAddress
    return trustedProxies.includes(clientIp || '')
  }

  /**
   * Check for suspicious patterns in strings
   */
  private containsSuspiciousPatterns(str: string): boolean {
    const suspiciousPatterns = [
      /../, // Directory traversal
      /<script/i, // Script injection
      /javascript:/i, // JavaScript protocol
      /data:text\/html/i, // Data URLs
      /vbscript:/i, // VBScript protocol
      /%00/, // Null bytes
      /\x00/, // Null characters
    ]

    return suspiciousPatterns.some(pattern => pattern.test(str))
  }

  /**
   * Get current nonce for inline scripts
   */
  getNonce(): string {
    return this.nonce
  }
}

/**
 * Rate limiting store interface
 */
export interface RateLimitStore {
  get(key: string): Promise<number | undefined>
  set(key: string, value: number, ttl: number): Promise<void>
  increment(key: string, ttl: number): Promise<number>
}

/**
 * Simple in-memory rate limit store
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; expiry: number }>()

  async get(key: string): Promise<number | undefined> {
    const entry = this.store.get(key)
    if (!entry || entry.expiry < Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return entry.count
  }

  async set(key: string, value: number, ttl: number): Promise<void> {
    this.store.set(key, {
      count: value,
      expiry: Date.now() + ttl
    })
  }

  async increment(key: string, ttl: number): Promise<number> {
    const current = await this.get(key) || 0
    const newValue = current + 1
    await this.set(key, newValue, ttl)
    return newValue
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiry < now) {
        this.store.delete(key)
      }
    }
  }
}

/**
 * Rate limiting middleware
 */
export class RateLimit {
  private store: RateLimitStore
  private config: SecurityConfig['rateLimit']

  constructor(config: SecurityConfig['rateLimit'], store?: RateLimitStore) {
    this.config = config
    this.store = store || new MemoryRateLimitStore()

    // Start cleanup interval for memory store
    if (store instanceof MemoryRateLimitStore) {
      setInterval(() => store.cleanup(), 60000) // Cleanup every minute
    }
  }

  middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!this.config.enabled) {
      return next()
    }

    // Create rate limit key (IP + user agent hash for better accuracy)
    const identifier = req.ip || 'unknown'
    const userAgent = req.get('User-Agent') || ''
    const key = `rate_limit:${identifier}:${crypto.createHash('md5').update(userAgent).digest('hex')}`

    try {
      const current = await this.store.increment(key, this.config.windowMs)
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.config.max.toString())
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.max - current).toString())
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + this.config.windowMs / 1000).toString())

      if (current > this.config.max) {
        res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: `Too many requests. Limit: ${this.config.max} requests per ${this.config.windowMs / 1000} seconds`,
          retryAfter: Math.ceil(this.config.windowMs / 1000)
        })
        return
      }

      next()
    } catch (error) {
      // If rate limiting fails, allow the request but log the error
      console.error('Rate limiting error:', error)
      next()
    }
  }
}

/**
 * Create security middleware stack
 */
export function createSecurityMiddleware(config: SecurityConfig): {
  httpsEnforcement: (req: Request, res: Response, next: NextFunction) => void
  securityHeaders: (req: Request, res: Response, next: NextFunction) => void
  requestSanitization: (req: Request, res: Response, next: NextFunction) => void
  rateLimit: (req: Request, res: Response, next: NextFunction) => Promise<void>
} {
  const securityHeaders = new SecurityHeaders(config)
  const rateLimit = new RateLimit(config.rateLimit)

  return {
    httpsEnforcement: securityHeaders.httpsEnforcement,
    securityHeaders: securityHeaders.securityHeaders,
    requestSanitization: securityHeaders.requestSanitization,
    rateLimit: rateLimit.middleware
  }
}
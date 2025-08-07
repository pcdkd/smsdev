/**
 * Tests for SecurityHeaders middleware and security configuration
 * Tests security headers, HTTPS enforcement, rate limiting, and request sanitization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { Request, Response, NextFunction } from 'express'
import {
  SecurityHeaders,
  RateLimit,
  MemoryRateLimitStore,
  DEFAULT_DEV_SECURITY,
  DEFAULT_PROD_SECURITY,
  createSecurityMiddleware
} from '../../src/security/SecurityHeaders.js'

// Mock Express Request/Response objects
const createMockReq = (options: Partial<Request> = {}): Request => ({
  method: 'GET',
  path: '/api/test',
  hostname: 'localhost',
  secure: false,
  ip: '127.0.0.1',
  headers: {},
  connection: { remoteAddress: '127.0.0.1' } as any,
  get: jest.fn((header: string) => options.headers?.[header.toLowerCase()]),
  originalUrl: '/api/test',
  query: {},
  ...options
} as any)

const createMockRes = (): Response => {
  const headers: Record<string, string> = {}
  const res = {
    setHeader: jest.fn((name: string, value: string) => {
      headers[name] = value
    }),
    removeHeader: jest.fn((name: string) => {
      delete headers[name]
    }),
    getHeaders: () => headers,
    redirect: jest.fn(),
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    locals: {}
  }
  return res as any
}

const createMockNext = (): NextFunction => jest.fn()

describe('Security Headers Tests', () => {
  let securityHeaders: SecurityHeaders
  let mockReq: Request
  let mockRes: Response
  let mockNext: NextFunction

  beforeEach(() => {
    securityHeaders = new SecurityHeaders(DEFAULT_DEV_SECURITY)
    mockReq = createMockReq()
    mockRes = createMockRes()
    mockNext = createMockNext()
  })

  describe('HTTPS Enforcement', () => {
    it('should allow HTTP in development by default', () => {
      securityHeaders.httpsEnforcement(mockReq, mockRes, mockNext)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRes.redirect).not.toHaveBeenCalled()
    })

    it('should enforce HTTPS when enabled', () => {
      const strictHeaders = new SecurityHeaders({
        ...DEFAULT_PROD_SECURITY,
        enforceHttps: true
      })
      
      const req = createMockReq({
        hostname: 'api.example.com',
        method: 'GET',
        secure: false,
        get: jest.fn(() => 'api.example.com')
      })

      strictHeaders.httpsEnforcement(req, mockRes, mockNext)
      
      expect(mockRes.redirect).toHaveBeenCalledWith(301, 'https://api.example.com/api/test')
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should allow localhost even with HTTPS enforcement', () => {
      const strictHeaders = new SecurityHeaders({
        ...DEFAULT_PROD_SECURITY,
        enforceHttps: true
      })

      const localhostReq = createMockReq({
        hostname: 'localhost',
        secure: false
      })

      strictHeaders.httpsEnforcement(localhostReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
      expect(mockRes.redirect).not.toHaveBeenCalled()
    })

    it('should return error for non-GET HTTPS-required requests', () => {
      const strictHeaders = new SecurityHeaders({
        ...DEFAULT_PROD_SECURITY,
        enforceHttps: true
      })
      
      const postReq = createMockReq({
        hostname: 'api.example.com',
        method: 'POST',
        secure: false
      })

      strictHeaders.httpsEnforcement(postReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'HTTPS Required',
          message: 'This API requires HTTPS for security'
        })
      )
    })

    it('should detect HTTPS from X-Forwarded-Proto header', () => {
      const strictHeaders = new SecurityHeaders({
        ...DEFAULT_PROD_SECURITY,
        enforceHttps: true
      })
      
      const req = createMockReq({
        hostname: 'api.example.com',
        secure: false,
        get: jest.fn((header: string) => {
          if (header === 'X-Forwarded-Proto') return 'https'
          if (header === 'Host') return 'api.example.com'
          return undefined
        })
      })

      strictHeaders.httpsEnforcement(req, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
      expect(mockRes.redirect).not.toHaveBeenCalled()
    })
  })

  describe('Security Headers Middleware', () => {
    it('should set basic security headers', () => {
      securityHeaders.securityHeaders(mockReq, mockRes, mockNext)

      const headers = mockRes.getHeaders()
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['X-Frame-Options']).toBe('DENY')
      expect(headers['X-XSS-Protection']).toBe('1; mode=block')
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
      expect(headers['X-DNS-Prefetch-Control']).toBe('off')
      
      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By')
      expect(mockNext).toHaveBeenCalled()
    })

    it('should set Content Security Policy when enabled', () => {
      securityHeaders.securityHeaders(mockReq, mockRes, mockNext)

      const headers = mockRes.getHeaders()
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'")
      expect(headers['Content-Security-Policy']).toContain("object-src 'none'")
    })

    it('should set HSTS header when enabled and secure', () => {
      const strictHeaders = new SecurityHeaders({
        ...DEFAULT_PROD_SECURITY,
        hsts: {
          enabled: true,
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      })

      const secureReq = createMockReq({ secure: true })
      strictHeaders.securityHeaders(secureReq, mockRes, mockNext)

      const headers = mockRes.getHeaders()
      expect(headers['Strict-Transport-Security']).toBe(
        'max-age=31536000; includeSubDomains; preload'
      )
    })

    it('should not set HSTS header for HTTP requests', () => {
      const strictHeaders = new SecurityHeaders({
        ...DEFAULT_PROD_SECURITY,
        hsts: { enabled: true, maxAge: 31536000, includeSubDomains: false, preload: false }
      })

      strictHeaders.securityHeaders(mockReq, mockRes, mockNext)

      const headers = mockRes.getHeaders()
      expect(headers['Strict-Transport-Security']).toBeUndefined()
    })

    it('should set strict headers in strict mode', () => {
      const strictHeaders = new SecurityHeaders({
        ...DEFAULT_PROD_SECURITY,
        strictMode: true
      })

      strictHeaders.securityHeaders(mockReq, mockRes, mockNext)

      const headers = mockRes.getHeaders()
      expect(headers['Cross-Origin-Embedder-Policy']).toBe('require-corp')
      expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin')
      expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin')
    })

    it('should set cache control for API routes', () => {
      const apiReq = createMockReq({ path: '/api/messages' })
      securityHeaders.securityHeaders(apiReq, mockRes, mockNext)

      const headers = mockRes.getHeaders()
      expect(headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate, private')
      expect(headers['Pragma']).toBe('no-cache')
      expect(headers['Expires']).toBe('0')
    })

    it('should generate and set nonce for CSP', () => {
      const strictHeaders = new SecurityHeaders({
        ...DEFAULT_PROD_SECURITY,
        strictMode: true,
        csp: {
          enabled: true,
          directives: {
            'script-src': ["'self'"]
          }
        }
      })

      strictHeaders.securityHeaders(mockReq, mockRes, mockNext)

      expect(mockRes.locals.nonce).toBeDefined()
      expect(typeof mockRes.locals.nonce).toBe('string')
      expect(mockRes.locals.nonce.length).toBeGreaterThan(0)

      const headers = mockRes.getHeaders()
      expect(headers['Content-Security-Policy']).toContain(`'nonce-${mockRes.locals.nonce}'`)
    })
  })

  describe('Request Sanitization', () => {
    it('should allow clean requests', () => {
      const cleanReq = createMockReq({
        path: '/api/messages',
        query: { limit: '10', offset: '0' }
      })

      securityHeaders.requestSanitization(cleanReq, mockRes, mockNext)
      expect(mockNext).toHaveBeenCalled()
    })

    it('should block directory traversal in path', () => {
      const maliciousReq = createMockReq({
        path: '/api/../../../etc/passwd'
      })

      securityHeaders.requestSanitization(maliciousReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid Request',
          message: 'Request path contains invalid characters'
        })
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should block script injection in query parameters', () => {
      const maliciousReq = createMockReq({
        path: '/api/messages',
        query: { search: '<script>alert("xss")</script>' }
      })

      securityHeaders.requestSanitization(maliciousReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid Request',
          message: 'Query parameter "search" contains invalid characters'
        })
      )
    })

    it('should remove dangerous headers from untrusted sources', () => {
      const reqWithHeaders = createMockReq({
        ip: '192.168.1.100', // Not trusted
        headers: {
          'x-forwarded-host': 'malicious.com',
          'x-real-ip': '10.0.0.1'
        }
      })

      securityHeaders.requestSanitization(reqWithHeaders, mockRes, mockNext)

      expect(reqWithHeaders.headers['x-forwarded-host']).toBeUndefined()
      expect(reqWithHeaders.headers['x-real-ip']).toBeUndefined()
      expect(mockNext).toHaveBeenCalled()
    })

    it('should preserve headers from trusted proxies', () => {
      const trustedReq = createMockReq({
        ip: '127.0.0.1', // Trusted
        headers: {
          'x-forwarded-host': 'api.example.com',
          'x-real-ip': '192.168.1.100'
        }
      })

      securityHeaders.requestSanitization(trustedReq, mockRes, mockNext)

      expect(trustedReq.headers['x-forwarded-host']).toBe('api.example.com')
      expect(trustedReq.headers['x-real-ip']).toBe('192.168.1.100')
    })
  })

  describe('Rate Limiting', () => {
    let rateLimit: RateLimit
    let store: MemoryRateLimitStore

    beforeEach(() => {
      store = new MemoryRateLimitStore()
      rateLimit = new RateLimit({
        enabled: true,
        windowMs: 60000,
        max: 5
      }, store)
    })

    it('should allow requests under the limit', async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimit.middleware(mockReq, mockRes, mockNext)
      }

      expect(mockNext).toHaveBeenCalledTimes(5)
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it('should block requests over the limit', async () => {
      // Make 5 allowed requests
      for (let i = 0; i < 5; i++) {
        await rateLimit.middleware(mockReq, mockRes, mockNext)
      }

      // 6th request should be blocked
      await rateLimit.middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(429)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate Limit Exceeded',
          message: expect.stringContaining('Too many requests')
        })
      )
    })

    it('should set rate limit headers', async () => {
      await rateLimit.middleware(mockReq, mockRes, mockNext)

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5')
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '4')
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String))
    })

    it('should differentiate between different IPs', async () => {
      const req1 = createMockReq({ ip: '192.168.1.1' })
      const req2 = createMockReq({ ip: '192.168.1.2' })

      // Use up limit for first IP
      for (let i = 0; i < 5; i++) {
        await rateLimit.middleware(req1, mockRes, mockNext)
      }

      // Second IP should still be allowed
      await rateLimit.middleware(req2, mockRes, mockNext)
      expect(mockNext).toHaveBeenCalledTimes(6)
    })

    it('should not rate limit when disabled', async () => {
      const disabledRateLimit = new RateLimit({
        enabled: false,
        windowMs: 60000,
        max: 1
      })

      // Make multiple requests (more than limit)
      for (let i = 0; i < 10; i++) {
        await disabledRateLimit.middleware(mockReq, mockRes, mockNext)
      }

      expect(mockNext).toHaveBeenCalledTimes(10)
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it('should handle store errors gracefully', async () => {
      const failingStore = {
        get: jest.fn().mockRejectedValue(new Error('Store error')),
        set: jest.fn().mockRejectedValue(new Error('Store error')),
        increment: jest.fn().mockRejectedValue(new Error('Store error'))
      }

      const faultyRateLimit = new RateLimit({
        enabled: true,
        windowMs: 60000,
        max: 5
      }, failingStore)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await faultyRateLimit.middleware(mockReq, mockRes, mockNext)

      expect(consoleSpy).toHaveBeenCalledWith('Rate limiting error:', expect.any(Error))
      expect(mockNext).toHaveBeenCalled() // Should still allow request
      
      consoleSpy.mockRestore()
    })
  })

  describe('Memory Rate Limit Store', () => {
    let store: MemoryRateLimitStore

    beforeEach(() => {
      store = new MemoryRateLimitStore()
    })

    it('should store and retrieve values', async () => {
      await store.set('test-key', 5, 1000)
      const value = await store.get('test-key')
      expect(value).toBe(5)
    })

    it('should increment values', async () => {
      const count1 = await store.increment('test-key', 1000)
      const count2 = await store.increment('test-key', 1000)
      
      expect(count1).toBe(1)
      expect(count2).toBe(2)
    })

    it('should expire values', async () => {
      await store.set('test-key', 10, 10) // 10ms TTL
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 20))
      
      const value = await store.get('test-key')
      expect(value).toBeUndefined()
    })

    it('should clean up expired entries', async () => {
      // Add some entries with short TTL
      await store.set('key1', 1, 10)
      await store.set('key2', 2, 10)
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 20))
      
      // Cleanup should remove expired entries
      store.cleanup()
      
      expect(await store.get('key1')).toBeUndefined()
      expect(await store.get('key2')).toBeUndefined()
    })
  })

  describe('Security Middleware Factory', () => {
    it('should create complete middleware stack', () => {
      const middleware = createSecurityMiddleware(DEFAULT_DEV_SECURITY)

      expect(middleware.httpsEnforcement).toBeDefined()
      expect(middleware.securityHeaders).toBeDefined()
      expect(middleware.requestSanitization).toBeDefined()
      expect(middleware.rateLimit).toBeDefined()

      expect(typeof middleware.httpsEnforcement).toBe('function')
      expect(typeof middleware.securityHeaders).toBe('function')
      expect(typeof middleware.requestSanitization).toBe('function')
      expect(typeof middleware.rateLimit).toBe('function')
    })

    it('should work with production configuration', () => {
      const middleware = createSecurityMiddleware(DEFAULT_PROD_SECURITY)

      // Test that strict production settings work
      const strictHeaders = new SecurityHeaders(DEFAULT_PROD_SECURITY)
      strictHeaders.securityHeaders(mockReq, mockRes, mockNext)

      const headers = mockRes.getHeaders()
      expect(headers['Content-Security-Policy']).not.toContain("'unsafe-inline'")
    })
  })

  describe('Configuration Validation', () => {
    it('should work with development configuration', () => {
      expect(() => new SecurityHeaders(DEFAULT_DEV_SECURITY)).not.toThrow()
    })

    it('should work with production configuration', () => {
      expect(() => new SecurityHeaders(DEFAULT_PROD_SECURITY)).not.toThrow()
    })

    it('should handle custom configuration', () => {
      const customConfig = {
        ...DEFAULT_DEV_SECURITY,
        strictMode: true,
        enforceHttps: true
      }

      expect(() => new SecurityHeaders(customConfig)).not.toThrow()
    })
  })
})
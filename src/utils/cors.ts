/**
 * Simple CORS utility for SMS-Dev local development
 * Provides basic cross-origin request support for local testing
 */

import { Request, Response, NextFunction } from 'express'

export interface CorsOptions {
  origins: string[]
  methods?: string[]
  allowedHeaders?: string[]
}

/**
 * Default CORS configuration for local development
 */
export const DEFAULT_CORS_OPTIONS: CorsOptions = {
  origins: ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-SMS-Dev-Key']
}

/**
 * Simple CORS middleware for local development
 */
export function createCorsMiddleware(options: Partial<CorsOptions> = {}): (req: Request, res: Response, next: NextFunction) => void {
  const config = {
    ...DEFAULT_CORS_OPTIONS,
    ...options
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin

    // Allow requests without origin (like from Postman)
    if (!origin) {
      res.setHeader('Access-Control-Allow-Origin', '*')
    } else if (config.origins.includes(origin) || config.origins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }

    res.setHeader('Access-Control-Allow-Methods', config.methods!.join(', '))
    res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders!.join(', '))
    res.setHeader('Access-Control-Max-Age', '86400') // 24 hours

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end()
      return
    }

    next()
  }
}

/**
 * Get CORS options from CLI config
 */
export function getCorsOptionsFromConfig(cliConfig: any): CorsOptions {
  if (cliConfig.cors && cliConfig.cors.origins) {
    return {
      origins: cliConfig.cors.origins,
      methods: DEFAULT_CORS_OPTIONS.methods,
      allowedHeaders: DEFAULT_CORS_OPTIONS.allowedHeaders
    }
  }

  return DEFAULT_CORS_OPTIONS
}
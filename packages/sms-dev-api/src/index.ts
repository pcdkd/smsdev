import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import { ApiServerOptions } from '@relay-works/sms-dev-types'

import { messagesRouter } from './routes/messages.js'
import { webhooksRouter } from './routes/webhooks.js'
import { devRouter } from './routes/dev.js'
import { setupSocketHandlers } from './services/socketService.js'
import { WebhookService } from './services/webhookService.js'
import { logger } from './middleware/logging.js'

export class SmsDevApiServer {
  private app: express.Application
  private server: ReturnType<typeof createServer>
  private io: SocketIOServer
  private options: ApiServerOptions
  private webhookService: WebhookService

  constructor(options: ApiServerOptions) {
    this.options = options
    this.app = express()
    this.server = createServer(this.app)
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    })

    // Initialize webhook service
    this.webhookService = new WebhookService(this.io, {
      url: this.options.webhookUrl,
      enabled: !!this.options.webhookUrl
    })

    this.setupMiddleware()
    this.setupRoutes()
    this.setupSocketHandlers()
  }

  private setupMiddleware() {
    // CORS - Allow all origins for local development
    if (this.options.cors) {
      this.app.use(cors({
        origin: true,
        credentials: true
      }))
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))

    // Logging
    if (this.options.logging) {
      this.app.use(logger)
    }

    // Add socket.io instance and webhook service to request for route handlers
    this.app.use((req, res, next) => {
      (req as any).io = this.io;
      (req as any).webhookService = this.webhookService
      next()
    })
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'sms-dev-api',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        webhook: {
          configured: !!this.options.webhookUrl,
          url: this.options.webhookUrl ? '[CONFIGURED]' : null
        }
      })
    })

    // API routes that match production Relay API
    this.app.use('/v1/messages', messagesRouter)
    this.app.use('/v1/webhooks', webhooksRouter)
    
    // Development-specific routes
    this.app.use('/v1/dev', devRouter)

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      })
    })

    // Error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('API Error:', err)
      res.status(err.statusCode || 500).json({
        error: err.message || 'Internal Server Error',
        timestamp: new Date().toISOString(),
        path: req.path
      })
    })
  }

  private setupSocketHandlers() {
    setupSocketHandlers(this.io, this.webhookService)
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.options.port, () => {
        console.log(`🚀 sms-dev API server running on port ${this.options.port}`)
        console.log(`📡 WebSocket server ready for real-time communication`)
        
        if (this.options.webhookUrl) {
          console.log(`🪝 Webhook endpoint configured: ${this.options.webhookUrl}`)
        } else {
          console.log(`⚠️ No webhook URL configured - use --webhook-url to enable webhook simulation`)
        }
        
        resolve()
      })
    })
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('📴 sms-dev API server stopped')
        resolve()
      })
    })
  }

  public getApp() {
    return this.app
  }

  public getIO() {
    return this.io
  }

  public getWebhookService() {
    return this.webhookService
  }
}

// Export for CLI usage
export function createApiServer(options: ApiServerOptions): SmsDevApiServer {
  return new SmsDevApiServer(options)
} 
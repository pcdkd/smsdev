import { WebhookEvent, InboundMessageWebhook, Message } from '@relay-works/sms-dev-types'
import { Server as SocketIOServer } from 'socket.io'

interface WebhookConfig {
  url?: string
  retries: number
  timeout: number
  enabled: boolean
}

export class WebhookService {
  private config: WebhookConfig
  private io: SocketIOServer
  private webhookHistory: WebhookEvent[] = []

  constructor(io: SocketIOServer, config: Partial<WebhookConfig> = {}) {
    this.io = io
    this.config = {
      retries: 3,
      timeout: 5000,
      enabled: true,
      ...config
    }
  }

  /**
   * Update webhook configuration
   */
  public updateConfig(config: Partial<WebhookConfig>) {
    this.config = { ...this.config, ...config }
    console.log('🔧 Webhook config updated:', this.config)
  }

  /**
   * Send inbound message webhook to developer's endpoint
   */
  public async sendInboundMessageWebhook(message: Message): Promise<WebhookEvent> {
    if (!this.config.enabled || !this.config.url) {
      console.log('⚠️ Webhook not configured - skipping webhook delivery')
      return this.createSkippedWebhookEvent(message)
    }

    const webhookPayload: InboundMessageWebhook = {
      id: message.id,
      to: message.to,
      from: message.from,
      body: message.body,
      received_at: message.created_at,
      type: 'sms'
    }

    const webhookEvent: WebhookEvent = {
      id: this.generateWebhookId(),
      url: this.config.url,
      payload: webhookPayload,
      status: 0,
      timestamp: new Date().toISOString(),
      duration: 0
    }

    const startTime = Date.now()

    try {
      console.log(`📡 Sending webhook to ${this.config.url}`)
      
      const response = await this.sendWebhookWithRetry(this.config.url, webhookPayload)
      
      webhookEvent.status = response.status
      webhookEvent.duration = Date.now() - startTime

      if (response.ok) {
        console.log(`✅ Webhook delivered successfully (${response.status})`)
        webhookEvent.error = undefined
      } else {
        const errorText = await response.text()
        webhookEvent.error = `HTTP ${response.status}: ${errorText}`
        console.log(`❌ Webhook failed: ${webhookEvent.error}`)
      }

    } catch (error: any) {
      webhookEvent.status = 0
      webhookEvent.duration = Date.now() - startTime
      webhookEvent.error = error.message || 'Network error'
      console.log(`❌ Webhook error: ${webhookEvent.error}`)
    }

    // Store in history
    this.webhookHistory.unshift(webhookEvent)
    if (this.webhookHistory.length > 100) {
      this.webhookHistory = this.webhookHistory.slice(0, 100)
    }

    // Broadcast webhook event to connected clients
    this.io.emit('webhook:sent', webhookEvent)

    return webhookEvent
  }

  /**
   * Send webhook with retry logic
   */
  private async sendWebhookWithRetry(url: string, payload: InboundMessageWebhook): Promise<any> {
    let lastError: Error

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

        const fetch = await import('node-fetch').then(m => m.default)
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'sms-dev-webhook/1.0.0',
            'X-SMS-Dev-Webhook': 'true',
            'X-SMS-Dev-Attempt': attempt.toString()
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        return response

      } catch (error: any) {
        lastError = error
        console.log(`🔄 Webhook attempt ${attempt}/${this.config.retries} failed: ${error.message}`)
        
        if (attempt < this.config.retries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000
          await this.sleep(delay)
        }
      }
    }

    throw lastError!
  }

  /**
   * Create a skipped webhook event when webhooks are disabled
   */
  private createSkippedWebhookEvent(message: Message): WebhookEvent {
    return {
      id: this.generateWebhookId(),
      url: 'N/A',
      payload: {
        id: message.id,
        to: message.to,
        from: message.from,
        body: message.body,
        received_at: message.created_at,
        type: 'sms'
      },
      status: -1,
      timestamp: new Date().toISOString(),
      error: 'Webhook URL not configured',
      duration: 0
    }
  }

  /**
   * Get webhook delivery history
   */
  public getWebhookHistory(): WebhookEvent[] {
    return [...this.webhookHistory]
  }

  /**
   * Clear webhook history
   */
  public clearWebhookHistory(): void {
    this.webhookHistory = []
    console.log('🗑️ Webhook history cleared')
  }

  /**
   * Get current webhook configuration
   */
  public getConfig(): WebhookConfig {
    return { ...this.config }
  }

  private generateWebhookId(): string {
    return `whk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
} 
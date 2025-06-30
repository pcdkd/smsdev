import { Router, Request, Response } from 'express'
import { WebhookService } from '../services/webhookService.js'

const router = Router()

// POST /v1/webhooks/test - Test webhook endpoint
router.post('/test', (req: Request, res: Response) => {
  console.log('📡 Webhook test received:', req.body)
  res.json({
    status: 'received',
    timestamp: new Date().toISOString(),
    body: req.body
  })
})

// POST /v1/webhooks/configure - Configure webhook URL
router.post('/configure', (req: Request, res: Response) => {
  const { url, enabled } = req.body
  const webhookService = (req as any).webhookService as WebhookService

  if (!url && enabled !== false) {
    return res.status(400).json({
      error: 'Missing webhook URL',
      message: 'Please provide a webhook URL to configure'
    })
  }

  webhookService.updateConfig({
    url: url || undefined,
    enabled: enabled !== false
  })

  res.json({
    message: 'Webhook configuration updated',
    config: {
      url: url ? '[CONFIGURED]' : null,
      enabled: enabled !== false
    },
    timestamp: new Date().toISOString()
  })
})

// GET /v1/webhooks/config - Get current webhook configuration
router.get('/config', (req: Request, res: Response) => {
  const webhookService = (req as any).webhookService as WebhookService
  const config = webhookService.getConfig()

  res.json({
    url: config.url ? '[CONFIGURED]' : null,
    enabled: config.enabled,
    retries: config.retries,
    timeout: config.timeout
  })
})

// GET /v1/webhooks/history - Get webhook delivery history
router.get('/history', (req: Request, res: Response) => {
  const webhookService = (req as any).webhookService as WebhookService
  const history = webhookService.getWebhookHistory()

  res.json({
    history,
    total: history.length,
    timestamp: new Date().toISOString()
  })
})

// DELETE /v1/webhooks/history - Clear webhook history
router.delete('/history', (req: Request, res: Response) => {
  const webhookService = (req as any).webhookService as WebhookService
  webhookService.clearWebhookHistory()

  res.json({
    message: 'Webhook history cleared',
    timestamp: new Date().toISOString()
  })
})

// POST /v1/webhooks/simulate - Manually trigger a webhook (for testing)
router.post('/simulate', async (req: Request, res: Response) => {
  const { to, from, body } = req.body
  const webhookService = (req as any).webhookService as WebhookService

  if (!to || !from || !body) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Please provide to, from, and body fields'
    })
  }

  // Create a simulated inbound message
  const simulatedMessage = {
    id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    to,
    from,
    body,
    status: 'delivered' as const,
    created_at: new Date().toISOString(),
    delivered_at: new Date().toISOString(),
    cost: 0.01
  }

  try {
    const webhookEvent = await webhookService.sendInboundMessageWebhook(simulatedMessage)
    
    res.json({
      message: 'Webhook simulation completed',
      webhook_event: webhookEvent,
      simulated_message: simulatedMessage,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    res.status(500).json({
      error: 'Webhook simulation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

export { router as webhooksRouter } 
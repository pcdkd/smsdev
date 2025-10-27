// Message types (compatible with production Relay API)
export interface Message {
  id: string
  to: string
  from: string
  body: string
  status: 'queued' | 'sent' | 'delivered' | 'failed'
  created_at: string
  delivered_at?: string
  cost?: number
}

// Request/Response types for API compatibility
export interface SendMessageRequest {
  to: string
  from?: string
  body: string
}

export interface SendMessageResponse {
  id: string
  to: string
  from: string
  message: string  // Production uses 'message' field in responses
  status: 'queued'
  created_at: string
  cost: number
}

// Template message request (for /v1/messages/send-template endpoint)
export interface SendTemplateMessageRequest {
  template: string  // Template ID
  to: string
  from?: string
  data?: Record<string, any>  // Template variables
  variant?: string
  metadata?: Record<string, any>
}

// Template message response
export interface SendTemplateMessageResponse {
  id: string
  to: string
  from: string
  message: string
  status: 'queued' | 'sent'
  template: {
    template_id: string
    variant: string | null
    resolved_from: 'mock' | 'package'
    variables_used: string[]
    variables_missing: string[]
    character_count: number
    sms_segments: number
  }
  created_at: string
  cost: number
}

export interface GetMessageResponse extends Message {}

export interface ListMessagesResponse {
  messages: Message[]
  pagination: {
    limit: number
    offset: number
    total: number
    has_more: boolean
  }
}

// Conversation grouping for UI
export interface Conversation {
  phoneNumber: string
  messages: Message[]
  lastActivity: string
  unreadCount: number
}

// Webhook simulation types
export interface WebhookEvent {
  id: string
  url: string
  payload: InboundMessageWebhook
  status: number
  timestamp: string
  error?: string
  duration?: number
}

export interface InboundMessageWebhook {
  id: string
  to: string
  from: string
  body: string
  received_at: string
  type: 'sms'
}

// WebSocket event types
export interface SocketEvents {
  // Server -> Client events
  'message:new': Message
  'message:updated': Message
  'webhook:sent': WebhookEvent
  'conversation:updated': Conversation
  
  // Client -> Server events
  'reply:send': {
    to: string
    from: string
    body: string
    conversationId?: string
  }
  'conversation:join': {
    phoneNumber: string
  }
  'conversation:leave': {
    phoneNumber: string
  }
}

// CLI configuration types
export interface SmsDevConfig {
  apiPort: number
  uiPort: number
  webhookUrl?: string
  cors: {
    enabled: boolean
    origins: string[]
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    enabled: boolean
  }
}

// API Server types
export interface ApiServerOptions {
  port: number
  cors: boolean
  logging: boolean
  webhookUrl?: string
}

// UI Server types
export interface UiServerOptions {
  port: number
  apiUrl: string
}

// Error types
export interface ApiError {
  error: string
  message: string
  timestamp: string
  path?: string
  details?: any[]
}

// Development utilities
export interface DeviceSimulation {
  phoneNumber: string
  name: string
  carrier?: string
  region?: string
}

export interface ConversationState {
  participants: string[]
  messageCount: number
  lastMessage?: Message
  isActive: boolean
} 
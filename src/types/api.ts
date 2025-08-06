/**
 * API response types for the SMS-Dev CLI
 */

export interface MockPhone {
  id: string
  phone: string
  name?: string
  type: 'business' | 'personal' | 'test'
  capabilities: {
    sms: boolean
  }
  createdAt: string
  updatedAt: string
}

export interface MockPhonesResponse {
  phones: MockPhone[]
  count: number
}

export interface ConversationFlow {
  id: string
  name: string
  description?: string
  active: boolean
  trigger: {
    type: string
    value: string
  }
  steps: Array<{
    type: string
    message?: string
    delay?: number
  }>
  createdAt: string
  updatedAt: string
}

export interface ConversationFlowsResponse {
  flows: ConversationFlow[]
  count: number
}

export interface FlowExecutionResult {
  execution_id: string
  flow_id: string
  phone?: string
  status: 'started' | 'running' | 'completed' | 'failed'
  startedAt: string
}

export interface PerformanceStats {
  uptime: number
  memory: {
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
  }
  api: {
    total_messages: number
    total_conversations: number
    active_flows: number
    mock_phones: number
  }
  system: {
    platform: string
    nodeVersion: string
    pid: number
  }
}

export interface LoadTestResult {
  test_id: string
  status: 'started' | 'running' | 'completed' | 'failed'
  config: {
    message_count: number
    concurrent_users: number
    duration_seconds: number
  }
  startedAt: string
}

export interface Message {
  id: string
  to: string
  from: string
  body: string
  status: string
  timestamp: string
  conversationId?: string
}

export interface Conversation {
  id: string
  participants: string[]
  messageCount: number
  lastMessage: Message
  createdAt: string
  updatedAt: string
}

export interface MessagesExportResponse {
  messages: Message[]
  count: number
  filters: {
    phone?: string
    from_date?: string
    to_date?: string
  }
}

export interface ConversationsExportResponse {
  conversations: Conversation[]
  count: number
  filters: {
    phone?: string
    from_date?: string
    to_date?: string
  }
}
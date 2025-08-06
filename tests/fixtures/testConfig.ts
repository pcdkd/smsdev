import { CliConfig } from '../../src/utils/config.js'

export const DEFAULT_TEST_CONFIG: CliConfig = {
  apiPort: 4001,
  uiPort: 4000,
  webhookUrl: undefined,
  cors: {
    enabled: true,
    origins: ['*']
  },
  logging: {
    level: 'info',
    enabled: true
  },
  startUI: true,
  verbose: false
}

export const TEST_CONFIG_WITH_WEBHOOK: CliConfig = {
  ...DEFAULT_TEST_CONFIG,
  webhookUrl: 'http://localhost:3000/webhook/sms',
  verbose: true
}

export const TEST_CONFIG_API_ONLY: CliConfig = {
  ...DEFAULT_TEST_CONFIG,
  startUI: false,
  apiPort: 4002
}

// Mock responses for API calls
export const MOCK_PHONE_RESPONSE = {
  id: 'phone_123',
  phone: '+1234567890',
  name: 'Test User',
  type: 'test',
  capabilities: { sms: true }
}

export const MOCK_FLOW_RESPONSE = {
  id: 'flow_123',
  name: 'Welcome Flow',
  active: true,
  steps: [
    { type: 'send', message: 'Hello!', delay: 1000 },
    { type: 'wait', delay: 2000 }
  ]
}

export const MOCK_PERFORMANCE_STATS = {
  uptime: 3600,
  memory: { heapUsed: 50 * 1024 * 1024 },
  api: {
    total_messages: 42,
    total_conversations: 12,
    active_flows: 3,
    mock_phones: 5
  }
}

export const MOCK_MESSAGES_EXPORT = {
  messages: [
    {
      id: 'msg_1',
      to: '+1234567890',
      from: '+15551234567',
      body: 'Test message',
      timestamp: '2024-01-01T12:00:00Z'
    }
  ],
  count: 1
}
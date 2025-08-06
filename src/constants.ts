/**
 * Constants for the SMS-Dev CLI application
 */

// Default ports
export const DEFAULT_PORTS = {
  API: 4001,
  UI: 4000
} as const

// API endpoints
export const ENDPOINTS = {
  HEALTH: '/v1/health',
  MOCK_PHONES: '/v1/dev/mock-phones',
  CONVERSATION_FLOWS: '/v1/dev/conversation-flows', 
  MESSAGES_EXPORT: '/v1/messages/export',
  CONVERSATIONS_EXPORT: '/v1/conversations/export',
  PERFORMANCE_STATS: '/v1/dev/performance/stats',
  LOAD_TEST: '/v1/dev/performance/load-test'
} as const

// Configuration file names (in order of precedence)
export const CONFIG_FILE_NAMES = [
  'sms-dev.config.js',
  'sms-dev.config.json',
  '.smsdevrc',
  '.smsdevrc.json',
  '.smsdevrc.js'
] as const

// Environment variable prefixes
export const ENV_PREFIX = 'SMS_DEV_' as const

// Default timeout values (in milliseconds)
export const TIMEOUTS = {
  API_REQUEST: 10000,
  SERVER_START: 30000,
  SERVER_STOP: 10000,
  HEALTH_CHECK: 5000
} as const

// Port ranges
export const PORT_RANGE = {
  MIN: 1024,
  MAX: 65535
} as const

// Log levels
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const

// Export formats
export const EXPORT_FORMATS = ['json', 'csv'] as const

// Mock phone types
export const MOCK_PHONE_TYPES = ['business', 'personal', 'test'] as const
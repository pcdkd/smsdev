/**
 * Security module for SMS-Dev CLI
 * Exports all security-related functionality
 */

export * from './SecurityHeaders.js'
export * from './SecurityConfig.js'
export * from './SecurityUtils.js'

// Convenience exports
export {
  createSecurityMiddleware,
  DEFAULT_DEV_SECURITY,
  DEFAULT_PROD_SECURITY,
  MemoryRateLimitStore
} from './SecurityHeaders.js'

export {
  SecurityConfigManager,
  SECURITY_PROFILES,
  type SecurityProfile,
  type EnhancedSecurityConfig
} from './SecurityConfig.js'

export {
  CertificateManager,
  SecurityAuditor,
  SecurityHelpers,
  type CertificateInfo,
  type SecurityAuditResult,
  type SecurityIssue
} from './SecurityUtils.js'
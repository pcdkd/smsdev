/**
 * Mock template catalog for SMS-Dev local testing
 * Simulates the production template system without requiring @relay-works/templates
 */

export interface MockTemplate {
  id: string
  name: string
  category: string
  body: string
  variables: string[]
  description: string
  campaignType: '2FA' | 'CUSTOMER_CARE' | 'MARKETING'
}

export const mockTemplates: MockTemplate[] = [
  {
    id: 'otp-verification',
    name: 'OTP Verification',
    category: 'authentication',
    body: 'Your verification code is {{code}}. It expires in {{expiry}} minutes.',
    variables: ['code', 'expiry'],
    description: '2FA verification code template',
    campaignType: '2FA'
  },
  {
    id: 'password-reset',
    name: 'Password Reset',
    category: 'authentication',
    body: 'Reset your password using code {{code}}. Valid for {{expiry}} minutes.',
    variables: ['code', 'expiry'],
    description: 'Password reset code',
    campaignType: '2FA'
  },
  {
    id: 'appointment-reminder',
    name: 'Appointment Reminder',
    category: 'transactional',
    body: 'Reminder: Your appointment with {{provider}} is scheduled for {{date}} at {{time}}.',
    variables: ['provider', 'date', 'time'],
    description: 'Appointment reminder notification',
    campaignType: 'CUSTOMER_CARE'
  },
  {
    id: 'order-confirmation',
    name: 'Order Confirmation',
    category: 'transactional',
    body: 'Order #{{orderNumber}} confirmed! Expected delivery: {{deliveryDate}}. Track: {{trackingUrl}}',
    variables: ['orderNumber', 'deliveryDate', 'trackingUrl'],
    description: 'Order confirmation message',
    campaignType: 'CUSTOMER_CARE'
  },
  {
    id: 'shipping-update',
    name: 'Shipping Update',
    category: 'transactional',
    body: 'Your order #{{orderNumber}} has shipped! Track at {{trackingUrl}}',
    variables: ['orderNumber', 'trackingUrl'],
    description: 'Shipping notification',
    campaignType: 'CUSTOMER_CARE'
  }
]

/**
 * Get a template by ID
 */
export function getMockTemplate(id: string): MockTemplate | undefined {
  return mockTemplates.find(t => t.id === id)
}

/**
 * Render a template with variable interpolation
 */
export function renderMockTemplate(
  template: MockTemplate,
  data: Record<string, any>
): {
  text: string
  variablesUsed: string[]
  variablesMissing: string[]
} {
  let text = template.body
  const variablesUsed: string[] = []
  const variablesMissing: string[] = []

  // Replace all variables in the template
  template.variables.forEach(variable => {
    const value = data[variable]
    const placeholder = `{{${variable}}}`

    if (value !== undefined && value !== null) {
      text = text.replace(new RegExp(placeholder, 'g'), String(value))
      variablesUsed.push(variable)
    } else {
      variablesMissing.push(variable)
    }
  })

  return {
    text,
    variablesUsed,
    variablesMissing
  }
}

/**
 * Calculate SMS segment count (GSM-7 encoding simulation)
 */
export function calculateSmsSegments(text: string): number {
  const length = text.length

  // Single SMS: 160 characters
  if (length <= 160) return 1

  // Multi-part SMS: 153 characters per segment
  return Math.ceil(length / 153)
}

/**
 * Validate template data
 */
export function validateMockTemplateData(
  template: MockTemplate,
  data: Record<string, any>
): {
  valid: boolean
  errors: Array<{ field: string; message: string }>
} {
  const errors: Array<{ field: string; message: string }> = []

  // Check required variables
  template.variables.forEach(variable => {
    if (data[variable] === undefined || data[variable] === null || data[variable] === '') {
      errors.push({
        field: variable,
        message: `Required template variable '${variable}' is missing or empty`
      })
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

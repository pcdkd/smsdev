/**
 * Core validation framework types for SMS-Dev CLI
 * Provides type-safe validation with comprehensive error handling
 */

export interface ValidationContext {
  /** The command being executed */
  command: string
  /** The action within the command (if applicable) */
  action?: string
  /** Other parameters that might affect validation logic */
  otherParams: Record<string, any>
  /** Whether to provide verbose validation messages */
  verbose?: boolean
}

export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean
  /** Error message if validation failed */
  error?: string
  /** Sanitized/transformed value if validation passed */
  sanitizedValue?: any
  /** Additional context for the error */
  errorContext?: string
  /** Suggestions for fixing the error */
  suggestions?: string[]
}

export interface ValidationRule<T = any> {
  /** Name of the validation rule */
  name: string
  /** The validation function */
  validate: (value: T, context?: ValidationContext) => ValidationResult | Promise<ValidationResult>
  /** Whether this validation rule requires async operation */
  async?: boolean
  /** Priority for ordering validations (higher runs first) */
  priority?: number
}

export interface ValidatorConfig {
  /** Whether to stop on first validation error */
  stopOnFirstError?: boolean
  /** Whether to perform async validations */
  skipAsync?: boolean
  /** Custom context for this validation run */
  context?: ValidationContext
}

/**
 * Enhanced validation error that provides detailed context
 */
export class ValidationError extends Error {
  public readonly field: string
  public readonly value: any
  public readonly rule: string
  public readonly suggestions: string[]
  public readonly context?: string

  constructor(
    field: string,
    value: any,
    rule: string,
    message: string,
    suggestions: string[] = [],
    context?: string
  ) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
    this.value = value
    this.rule = rule
    this.suggestions = suggestions
    this.context = context
  }

  /**
   * Get a formatted error message with suggestions
   */
  getFormattedMessage(): string {
    let message = `❌ ${this.message}`
    
    if (this.context) {
      message += `\n   Context: ${this.context}`
    }
    
    if (this.suggestions.length > 0) {
      message += '\n   💡 Suggestions:'
      this.suggestions.forEach(suggestion => {
        message += `\n      • ${suggestion}`
      })
    }
    
    return message
  }
}

/**
 * Result of validating multiple fields
 */
export interface ValidationResults {
  /** Whether all validations passed */
  isValid: boolean
  /** Array of validation errors */
  errors: ValidationError[]
  /** Results for each field */
  fieldResults: Record<string, ValidationResult>
  /** Sanitized values for fields that passed validation */
  sanitizedValues: Record<string, any>
  /** Summary of validation results */
  summary: {
    total: number
    passed: number
    failed: number
  }
}

/**
 * Options for a specific field validation
 */
export interface FieldValidationOptions {
  /** Whether the field is required */
  required?: boolean
  /** Custom error message for required field */
  requiredMessage?: string
  /** Whether to skip validation if field is empty/undefined */
  skipIfEmpty?: boolean
  /** Custom context for this field */
  context?: string
}

/**
 * Schema for validating a complete command input
 */
export interface ValidationSchema {
  [fieldName: string]: {
    rules: ValidationRule[]
    options?: FieldValidationOptions
  }
}
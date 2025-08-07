/**
 * Simplified validation for SMS-Dev CLI
 * Three core validation types that cover all CLI needs
 */

export interface ValidationError {
  field: string
  value: any
  message: string
}

export class ValidationResult {
  constructor(
    public isValid: boolean,
    public errors: ValidationError[] = [],
    public value?: any
  ) {}

  static success(value?: any): ValidationResult {
    return new ValidationResult(true, [], value)
  }

  static error(field: string, value: any, message: string): ValidationResult {
    return new ValidationResult(false, [{ field, value, message }])
  }

  static errors(errors: ValidationError[]): ValidationResult {
    return new ValidationResult(false, errors)
  }
}

/**
 * Simple CLI validation utilities
 */
export class CLIValidator {
  
  /**
   * Validate string inputs (covers: phone numbers, file paths, names, etc.)
   */
  static validateString(
    field: string, 
    value: any, 
    options: {
      required?: boolean
      minLength?: number
      maxLength?: number
      pattern?: RegExp
      enum?: string[]
    } = {}
  ): ValidationResult {
    // Check if required
    if (options.required && (value === undefined || value === null || value === '')) {
      return ValidationResult.error(field, value, `${field} is required`)
    }

    // Allow empty for optional fields
    if (!options.required && (value === undefined || value === null || value === '')) {
      return ValidationResult.success(value)
    }

    // Convert to string
    const str = String(value).trim()

    // Length checks
    if (options.minLength !== undefined && str.length < options.minLength) {
      return ValidationResult.error(field, value, `${field} must be at least ${options.minLength} characters`)
    }

    if (options.maxLength !== undefined && str.length > options.maxLength) {
      return ValidationResult.error(field, value, `${field} must be no more than ${options.maxLength} characters`)
    }

    // Pattern check (covers phone numbers, file paths, etc.)
    if (options.pattern && !options.pattern.test(str)) {
      return ValidationResult.error(field, value, `${field} format is invalid`)
    }

    // Enum check
    if (options.enum && !options.enum.includes(str)) {
      return ValidationResult.error(field, value, `${field} must be one of: ${options.enum.join(', ')}`)
    }

    return ValidationResult.success(str)
  }

  /**
   * Validate numeric inputs (covers: ports, counts, timeouts, etc.)
   */
  static validateNumber(
    field: string,
    value: any,
    options: {
      required?: boolean
      min?: number
      max?: number
      integer?: boolean
    } = {}
  ): ValidationResult {
    // Check if required
    if (options.required && (value === undefined || value === null || value === '')) {
      return ValidationResult.error(field, value, `${field} is required`)
    }

    // Allow empty for optional fields
    if (!options.required && (value === undefined || value === null || value === '')) {
      return ValidationResult.success(value)
    }

    // Convert to number
    const num = Number(value)

    if (isNaN(num)) {
      return ValidationResult.error(field, value, `${field} must be a valid number`)
    }

    // Integer check
    if (options.integer && !Number.isInteger(num)) {
      return ValidationResult.error(field, value, `${field} must be an integer`)
    }

    // Range checks
    if (options.min !== undefined && num < options.min) {
      return ValidationResult.error(field, value, `${field} must be at least ${options.min}`)
    }

    if (options.max !== undefined && num > options.max) {
      return ValidationResult.error(field, value, `${field} must be no more than ${options.max}`)
    }

    return ValidationResult.success(num)
  }

  /**
   * Validate structured inputs (covers: URLs, JSON, dates, etc.)
   */
  static validateStructured(
    field: string,
    value: any,
    type: 'url' | 'json' | 'date' | 'email',
    options: {
      required?: boolean
    } = {}
  ): ValidationResult {
    // Check if required
    if (options.required && (value === undefined || value === null || value === '')) {
      return ValidationResult.error(field, value, `${field} is required`)
    }

    // Allow empty for optional fields
    if (!options.required && (value === undefined || value === null || value === '')) {
      return ValidationResult.success(value)
    }

    const str = String(value).trim()

    switch (type) {
      case 'url':
        try {
          const url = new URL(str)
          return ValidationResult.success(url.toString())
        } catch {
          return ValidationResult.error(field, value, `${field} must be a valid URL`)
        }

      case 'json':
        try {
          const parsed = JSON.parse(str)
          return ValidationResult.success(parsed)
        } catch {
          return ValidationResult.error(field, value, `${field} must be valid JSON`)
        }

      case 'date':
        const date = new Date(str)
        if (isNaN(date.getTime())) {
          return ValidationResult.error(field, value, `${field} must be a valid date`)
        }
        return ValidationResult.success(date)

      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailPattern.test(str)) {
          return ValidationResult.error(field, value, `${field} must be a valid email address`)
        }
        return ValidationResult.success(str)

      default:
        return ValidationResult.error(field, value, `Unknown validation type: ${type}`)
    }
  }

  /**
   * Common validation patterns for CLI inputs
   */
  static readonly PATTERNS = {
    PHONE_NUMBER: /^\+?[\d\s\-\(\)]+$/,
    FILE_PATH: /^[^\0]+$/,
    PORT: /^\d+$/,
    API_KEY: /^[a-zA-Z0-9_-]+$/
  }

  /**
   * Convenience methods for common CLI validations
   */
  static validatePhoneNumber(field: string, value: any, required = false): ValidationResult {
    return this.validateString(field, value, {
      required,
      pattern: this.PATTERNS.PHONE_NUMBER,
      minLength: 10,
      maxLength: 20
    })
  }

  static validatePort(field: string, value: any, required = false): ValidationResult {
    return this.validateNumber(field, value, {
      required,
      integer: true,
      min: 1024,
      max: 65535
    })
  }

  static validateFilePath(field: string, value: any, required = false): ValidationResult {
    return this.validateString(field, value, {
      required,
      pattern: this.PATTERNS.FILE_PATH
    })
  }

  static validateUrl(field: string, value: any, required = false): ValidationResult {
    return this.validateStructured(field, value, 'url', { required })
  }

  /**
   * Validate multiple fields at once
   */
  static validateFields(validations: Array<() => ValidationResult>): ValidationResult {
    const errors: ValidationError[] = []
    
    for (const validation of validations) {
      const result = validation()
      if (!result.isValid) {
        errors.push(...result.errors)
      }
    }

    return errors.length === 0 
      ? ValidationResult.success() 
      : ValidationResult.errors(errors)
  }
}
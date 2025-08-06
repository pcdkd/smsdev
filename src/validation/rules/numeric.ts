/**
 * Numeric validation rules for SMS-Dev CLI
 * Handles integers, floats, ranges, and port numbers
 */

import { ValidationRule, ValidationResult } from '../types.js'

/**
 * Basic integer validation
 */
export const integerRule: ValidationRule<number | string> = {
  name: 'integer',
  priority: 95,
  validate: (value: number | string): ValidationResult => {
    let numValue: number

    if (typeof value === 'string') {
      const trimmed = value.trim()
      
      if (trimmed === '') {
        return {
          isValid: false,
          error: 'Value cannot be empty',
          suggestions: ['Provide a numeric value']
        }
      }

      numValue = parseInt(trimmed, 10)
      
      if (isNaN(numValue) || !Number.isInteger(numValue)) {
        return {
          isValid: false,
          error: `"${value}" is not a valid integer`,
          suggestions: [
            'Use a whole number (e.g., 1, 42, -5)',
            'Remove any decimal points or non-numeric characters'
          ]
        }
      }
      
      // Check if the string representation matches (catches cases like "3.14" -> 3)
      if (parseInt(trimmed, 10).toString() !== trimmed) {
        return {
          isValid: false,
          error: `"${value}" is not a valid integer format`,
          suggestions: [
            'Remove decimal points for integer values',
            'Use whole numbers only'
          ]
        }
      }
    } else if (typeof value === 'number') {
      if (!Number.isInteger(value)) {
        return {
          isValid: false,
          error: `${value} is not an integer`,
          suggestions: ['Use a whole number without decimal places']
        }
      }
      numValue = value
    } else {
      return {
        isValid: false,
        error: 'Value must be a number or numeric string',
        suggestions: ['Provide a valid numeric value']
      }
    }

    return {
      isValid: true,
      sanitizedValue: numValue
    }
  }
}

/**
 * Floating point number validation
 */
export const floatRule: ValidationRule<number | string> = {
  name: 'float',
  priority: 95,
  validate: (value: number | string): ValidationResult => {
    let numValue: number

    if (typeof value === 'string') {
      const trimmed = value.trim()
      
      if (trimmed === '') {
        return {
          isValid: false,
          error: 'Value cannot be empty',
          suggestions: ['Provide a numeric value']
        }
      }

      numValue = parseFloat(trimmed)
      
      if (isNaN(numValue) || !isFinite(numValue)) {
        return {
          isValid: false,
          error: `"${value}" is not a valid number`,
          suggestions: [
            'Use a valid number (e.g., 1.5, 42, -3.14)',
            'Remove any non-numeric characters except decimal point'
          ]
        }
      }
    } else if (typeof value === 'number') {
      if (!isFinite(value)) {
        return {
          isValid: false,
          error: `${value} is not a finite number`,
          suggestions: ['Use a finite numeric value']
        }
      }
      numValue = value
    } else {
      return {
        isValid: false,
        error: 'Value must be a number or numeric string',
        suggestions: ['Provide a valid numeric value']
      }
    }

    return {
      isValid: true,
      sanitizedValue: numValue
    }
  }
}

/**
 * Range validation for numbers
 */
export const rangeRule = (min: number, max: number, inclusive = true): ValidationRule<number> => ({
  name: 'range',
  priority: 80,
  validate: (value: number): ValidationResult => {
    if (typeof value !== 'number' || !isFinite(value)) {
      return {
        isValid: false,
        error: 'Value must be a finite number',
        suggestions: ['Provide a valid numeric value for range validation']
      }
    }

    const isInRange = inclusive 
      ? (value >= min && value <= max)
      : (value > min && value < max)

    if (!isInRange) {
      const rangeDesc = inclusive 
        ? `between ${min} and ${max} (inclusive)`
        : `between ${min} and ${max} (exclusive)`
      
      const suggestions = [`Value must be ${rangeDesc}`]
      
      if (value < min) {
        suggestions.push(`Minimum allowed value is ${min}`)
      } else if (value > max) {
        suggestions.push(`Maximum allowed value is ${max}`)
      }

      return {
        isValid: false,
        error: `Value ${value} is not in valid range`,
        suggestions
      }
    }

    return {
      isValid: true,
      sanitizedValue: value
    }
  }
})

/**
 * Port number validation (1024-65535 for non-privileged ports)
 */
export const portRule: ValidationRule<number | string> = {
  name: 'port_number',
  priority: 90,
  validate: (value: number | string): ValidationResult => {
    // First validate it's an integer
    const intResult = integerRule.validate(value)
    if (!intResult.isValid) {
      return {
        ...intResult,
        error: 'Port must be a valid integer',
        suggestions: [
          'Use a whole number for port (e.g., 3000, 8080)',
          ...intResult.suggestions || []
        ]
      }
    }

    const port = intResult.sanitizedValue as number

    // Port range validation
    if (port < 1 || port > 65535) {
      return {
        isValid: false,
        error: `Port ${port} is outside valid range`,
        suggestions: [
          'Use a port between 1 and 65535',
          'For non-privileged ports, use 1024-65535',
          'Common development ports: 3000, 8000, 8080, 9000'
        ]
      }
    }

    // Warn about privileged ports
    let errorContext: string | undefined
    if (port < 1024) {
      errorContext = 'Using privileged port (< 1024) - may require administrator rights'
    }

    // Warn about commonly used ports
    const commonPorts: Record<number, string> = {
      80: 'HTTP',
      443: 'HTTPS', 
      22: 'SSH',
      21: 'FTP',
      25: 'SMTP',
      53: 'DNS',
      110: 'POP3',
      143: 'IMAP',
      993: 'IMAPS',
      995: 'POP3S'
    }

    if (commonPorts[port]) {
      errorContext = `Port ${port} is commonly used for ${commonPorts[port]} - ensure it's available`
    }

    return {
      isValid: true,
      sanitizedValue: port,
      errorContext
    }
  }
}

/**
 * Positive integer validation
 */
export const positiveIntegerRule: ValidationRule<number | string> = {
  name: 'positive_integer',
  priority: 85,
  validate: (value: number | string): ValidationResult => {
    const intResult = integerRule.validate(value)
    if (!intResult.isValid) {
      return intResult
    }

    const numValue = intResult.sanitizedValue as number
    
    if (numValue <= 0) {
      return {
        isValid: false,
        error: `Value must be positive, got ${numValue}`,
        suggestions: [
          'Use a positive integer (greater than 0)',
          'Example: 1, 10, 100'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: numValue
    }
  }
}

/**
 * Non-negative integer validation (>= 0)
 */
export const nonNegativeIntegerRule: ValidationRule<number | string> = {
  name: 'non_negative_integer',
  priority: 85,
  validate: (value: number | string): ValidationResult => {
    const intResult = integerRule.validate(value)
    if (!intResult.isValid) {
      return intResult
    }

    const numValue = intResult.sanitizedValue as number
    
    if (numValue < 0) {
      return {
        isValid: false,
        error: `Value cannot be negative, got ${numValue}`,
        suggestions: [
          'Use a non-negative integer (0 or greater)',
          'Example: 0, 1, 10, 100'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: numValue
    }
  }
}

/**
 * Factory function to create integer validation with range
 */
export function createIntegerRule(options: {
  min?: number
  max?: number
  positive?: boolean
  nonNegative?: boolean
}): ValidationRule<number | string> {
  return {
    name: 'custom_integer',
    priority: 90,
    validate: (value: number | string): ValidationResult => {
      // First validate it's an integer
      const intResult = integerRule.validate(value)
      if (!intResult.isValid) {
        return intResult
      }

      const numValue = intResult.sanitizedValue as number

      // Apply constraints
      if (options.positive && numValue <= 0) {
        return {
          isValid: false,
          error: `Value must be positive, got ${numValue}`,
          suggestions: ['Use a positive integer (greater than 0)']
        }
      }

      if (options.nonNegative && numValue < 0) {
        return {
          isValid: false,
          error: `Value cannot be negative, got ${numValue}`,
          suggestions: ['Use a non-negative integer (0 or greater)']
        }
      }

      // Range validation
      if (options.min !== undefined && numValue < options.min) {
        return {
          isValid: false,
          error: `Value ${numValue} is below minimum ${options.min}`,
          suggestions: [`Use a value >= ${options.min}`]
        }
      }

      if (options.max !== undefined && numValue > options.max) {
        return {
          isValid: false,
          error: `Value ${numValue} is above maximum ${options.max}`,
          suggestions: [`Use a value <= ${options.max}`]
        }
      }

      return {
        isValid: true,
        sanitizedValue: numValue
      }
    }
  }
}

/**
 * Percentage validation (0-100)
 */
export const percentageRule: ValidationRule<number | string> = {
  name: 'percentage',
  priority: 85,
  validate: (value: number | string): ValidationResult => {
    const floatResult = floatRule.validate(value)
    if (!floatResult.isValid) {
      return {
        ...floatResult,
        error: 'Percentage must be a valid number'
      }
    }

    const numValue = floatResult.sanitizedValue as number
    const rangeResult = rangeRule(0, 100, true).validate(numValue)
    
    if (!rangeResult.isValid) {
      return {
        ...rangeResult,
        error: `Percentage must be between 0 and 100, got ${numValue}`,
        suggestions: [
          'Use a value between 0 and 100',
          'Example: 50 (for 50%), 75.5 (for 75.5%)'
        ]
      }
    }

    return rangeResult
  }
}
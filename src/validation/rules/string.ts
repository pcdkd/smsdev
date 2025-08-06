/**
 * String validation rules for SMS-Dev CLI
 * Handles length, format, and content validation for text inputs
 */

import { ValidationRule, ValidationResult } from '../types.js'

/**
 * Basic string validation (non-empty after trim)
 */
export const nonEmptyStringRule: ValidationRule<string> = {
  name: 'non_empty_string',
  priority: 95,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Value must be a string',
        suggestions: ['Provide a text value']
      }
    }

    const trimmed = value.trim()
    
    if (trimmed === '') {
      return {
        isValid: false,
        error: 'String cannot be empty',
        suggestions: ['Provide a non-empty text value']
      }
    }

    return {
      isValid: true,
      sanitizedValue: trimmed
    }
  }
}

/**
 * String length validation
 */
export const stringLengthRule = (minLength: number = 0, maxLength: number = Infinity): ValidationRule<string> => ({
  name: 'string_length',
  priority: 85,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Value must be a string',
        suggestions: ['Provide a text value']
      }
    }

    const length = value.length

    if (length < minLength) {
      return {
        isValid: false,
        error: `String is too short: ${length} characters (minimum: ${minLength})`,
        suggestions: [
          `Add at least ${minLength - length} more characters`,
          `Minimum length required: ${minLength} characters`
        ]
      }
    }

    if (length > maxLength) {
      return {
        isValid: false,
        error: `String is too long: ${length} characters (maximum: ${maxLength})`,
        suggestions: [
          `Remove at least ${length - maxLength} characters`,
          `Maximum length allowed: ${maxLength} characters`
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: value
    }
  }
})

/**
 * Alphanumeric validation (letters and numbers only)
 */
export const alphanumericRule: ValidationRule<string> = {
  name: 'alphanumeric',
  priority: 80,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Value must be a string',
        suggestions: ['Provide a text value']
      }
    }

    const alphanumericRegex = /^[a-zA-Z0-9]+$/
    
    if (!alphanumericRegex.test(value)) {
      return {
        isValid: false,
        error: 'String must contain only letters and numbers',
        suggestions: [
          'Use only letters (a-z, A-Z) and numbers (0-9)',
          'Remove spaces, special characters, or symbols'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: value
    }
  }
}

/**
 * Safe filename validation (for file/directory names)
 */
export const safeFilenameRule: ValidationRule<string> = {
  name: 'safe_filename',
  priority: 80,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Filename must be a string',
        suggestions: ['Provide a valid filename']
      }
    }

    const trimmed = value.trim()
    
    if (trimmed === '') {
      return {
        isValid: false,
        error: 'Filename cannot be empty',
        suggestions: ['Provide a non-empty filename']
      }
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
    if (invalidChars.test(trimmed)) {
      return {
        isValid: false,
        error: 'Filename contains invalid characters',
        suggestions: [
          'Remove characters: < > : " / \\ | ? *',
          'Use letters, numbers, hyphens, and underscores',
          'Example: my-file-name.txt'
        ]
      }
    }

    // Check for reserved names (Windows)
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ]
    
    const nameWithoutExt = trimmed.split('.')[0].toUpperCase()
    if (reservedNames.includes(nameWithoutExt)) {
      return {
        isValid: false,
        error: `"${trimmed}" is a reserved filename`,
        suggestions: [
          'Use a different filename',
          'Add a prefix or suffix to make it unique',
          `Example: my-${trimmed}`
        ]
      }
    }

    // Check length (most filesystems support 255 chars)
    if (trimmed.length > 255) {
      return {
        isValid: false,
        error: `Filename is too long: ${trimmed.length} characters (max: 255)`,
        suggestions: [
          'Use a shorter filename',
          'Remove unnecessary characters'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: trimmed
    }
  }
}

/**
 * UUID/ID format validation
 */
export const uuidRule: ValidationRule<string> = {
  name: 'uuid',
  priority: 85,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'UUID must be a string',
        suggestions: ['Provide a valid UUID string']
      }
    }

    const trimmed = value.trim()
    
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    
    if (!uuidRegex.test(trimmed)) {
      return {
        isValid: false,
        error: `Invalid UUID format: "${value}"`,
        suggestions: [
          'Use UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
          'Example: 123e4567-e89b-12d3-a456-426614174000',
          'Ensure all characters are hexadecimal (0-9, a-f)'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: trimmed.toLowerCase()
    }
  }
}

/**
 * Simple ID format validation (alphanumeric with hyphens/underscores)
 */
export const simpleIdRule: ValidationRule<string> = {
  name: 'simple_id',
  priority: 85,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'ID must be a string',
        suggestions: ['Provide a valid ID string']
      }
    }

    const trimmed = value.trim()
    
    if (trimmed === '') {
      return {
        isValid: false,
        error: 'ID cannot be empty',
        suggestions: ['Provide a non-empty ID']
      }
    }

    // Allow letters, numbers, hyphens, and underscores
    const idRegex = /^[a-zA-Z0-9_-]+$/
    
    if (!idRegex.test(trimmed)) {
      return {
        isValid: false,
        error: `Invalid ID format: "${value}"`,
        suggestions: [
          'Use only letters, numbers, hyphens (-), and underscores (_)',
          'Example: user-123, flow_abc, test-id-01'
        ]
      }
    }

    // Check reasonable length
    if (trimmed.length > 64) {
      return {
        isValid: false,
        error: `ID is too long: ${trimmed.length} characters (max: 64)`,
        suggestions: ['Use a shorter ID (64 characters or less)']
      }
    }

    return {
      isValid: true,
      sanitizedValue: trimmed
    }
  }
}

/**
 * Pattern matching validation
 */
export const patternRule = (pattern: RegExp, description: string): ValidationRule<string> => ({
  name: 'pattern_match',
  priority: 75,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Value must be a string',
        suggestions: ['Provide a text value']
      }
    }

    if (!pattern.test(value)) {
      return {
        isValid: false,
        error: `String does not match required pattern`,
        errorContext: description,
        suggestions: [
          `Must match pattern: ${description}`,
          'Check the format requirements'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: value
    }
  }
})

/**
 * No whitespace validation
 */
export const noWhitespaceRule: ValidationRule<string> = {
  name: 'no_whitespace',
  priority: 70,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Value must be a string',
        suggestions: ['Provide a text value']
      }
    }

    if (/\s/.test(value)) {
      return {
        isValid: false,
        error: 'String cannot contain whitespace characters',
        suggestions: [
          'Remove all spaces, tabs, and newlines',
          'Use hyphens (-) or underscores (_) instead of spaces'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: value
    }
  }
}

/**
 * Trim whitespace sanitizer
 */
export const trimRule: ValidationRule<string> = {
  name: 'trim',
  priority: 100,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Value must be a string',
        suggestions: ['Provide a text value']
      }
    }

    return {
      isValid: true,
      sanitizedValue: value.trim()
    }
  }
}

/**
 * Factory function to create comprehensive string validation
 */
export function createStringRule(options: {
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  patternDescription?: string
  allowEmpty?: boolean
  trim?: boolean
  alphanumericOnly?: boolean
  noWhitespace?: boolean
}): ValidationRule<string> {
  return {
    name: 'comprehensive_string',
    priority: 90,
    validate: (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return {
          isValid: false,
          error: 'Value must be a string',
          suggestions: ['Provide a text value']
        }
      }

      let processedValue = value

      // Trim if requested
      if (options.trim !== false) {
        processedValue = processedValue.trim()
      }

      // Empty check
      if (!options.allowEmpty && processedValue === '') {
        return {
          isValid: false,
          error: 'String cannot be empty',
          suggestions: ['Provide a non-empty text value']
        }
      }

      // Length validation
      if (options.minLength !== undefined || options.maxLength !== undefined) {
        const lengthResult = stringLengthRule(
          options.minLength || 0,
          options.maxLength || Infinity
        ).validate(processedValue)
        if (!lengthResult.isValid) {
          return lengthResult
        }
      }

      // Alphanumeric only
      if (options.alphanumericOnly) {
        const alphanumericResult = alphanumericRule.validate(processedValue)
        if (!alphanumericResult.isValid) {
          return alphanumericResult
        }
      }

      // No whitespace
      if (options.noWhitespace) {
        const noWhitespaceResult = noWhitespaceRule.validate(processedValue)
        if (!noWhitespaceResult.isValid) {
          return noWhitespaceResult
        }
      }

      // Pattern matching
      if (options.pattern) {
        const patternResult = patternRule(
          options.pattern,
          options.patternDescription || 'specified pattern'
        ).validate(processedValue)
        if (!patternResult.isValid) {
          return patternResult
        }
      }

      return {
        isValid: true,
        sanitizedValue: processedValue
      }
    }
  }
}
/**
 * Enum validation rules for SMS-Dev CLI
 * Validates values against predefined sets with helpful suggestions
 */

import { ValidationRule, ValidationResult } from '../types.js'

/**
 * Generic enum validation rule
 */
export const enumRule = (allowedValues: string[], caseSensitive = false): ValidationRule<string> => ({
  name: 'enum_validation',
  priority: 90,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Value must be a string',
        suggestions: ['Provide a valid string value']
      }
    }

    const cleanValue = value.trim()
    const compareValues = caseSensitive ? allowedValues : allowedValues.map(v => v.toLowerCase())
    const compareInput = caseSensitive ? cleanValue : cleanValue.toLowerCase()

    if (!compareValues.includes(compareInput)) {
      // Find closest matches using simple string distance
      const suggestions = [
        `Allowed values: ${allowedValues.join(', ')}`,
      ]

      // Add suggestions for similar values
      const similar = findSimilarValues(cleanValue, allowedValues, 2)
      if (similar.length > 0) {
        suggestions.unshift(`Did you mean: ${similar.join(', ')}?`)
      }

      return {
        isValid: false,
        error: `Invalid value: "${value}"`,
        suggestions
      }
    }

    // Return the properly cased value from the allowed values
    const properValue = allowedValues[compareValues.indexOf(compareInput)]
    return {
      isValid: true,
      sanitizedValue: properValue
    }
  }
})

/**
 * Export format validation (json, csv)
 */
export const exportFormatRule: ValidationRule<string> = {
  name: 'export_format',
  priority: 85,
  validate: (value: string): ValidationResult => {
    const allowedFormats = ['json', 'csv']
    return enumRule(allowedFormats, false).validate(value)
  }
}

/**
 * Export type validation (messages, conversations)
 */
export const exportTypeRule: ValidationRule<string> = {
  name: 'export_type',
  priority: 85,
  validate: (value: string): ValidationResult => {
    const allowedTypes = ['messages', 'conversations']
    return enumRule(allowedTypes, false).validate(value)
  }
}

/**
 * Mock phone type validation (business, personal, test)
 */
export const mockPhoneTypeRule: ValidationRule<string> = {
  name: 'mock_phone_type',
  priority: 85,
  validate: (value: string): ValidationResult => {
    const allowedTypes = ['business', 'personal', 'test']
    return enumRule(allowedTypes, false).validate(value)
  }
}

/**
 * Mock phone action validation (create, list, delete)
 */
export const mockPhoneActionRule: ValidationRule<string> = {
  name: 'mock_phone_action',
  priority: 85,
  validate: (value: string): ValidationResult => {
    const allowedActions = ['create', 'list', 'delete']
    return enumRule(allowedActions, false).validate(value)
  }
}

/**
 * Flow action validation (create, list, execute)
 */
export const flowActionRule: ValidationRule<string> = {
  name: 'flow_action',
  priority: 85,
  validate: (value: string): ValidationResult => {
    const allowedActions = ['create', 'list', 'execute']
    return enumRule(allowedActions, false).validate(value)
  }
}

/**
 * Performance action validation (stats, load-test)
 */
export const performanceActionRule: ValidationRule<string> = {
  name: 'performance_action',
  priority: 85,
  validate: (value: string): ValidationResult => {
    const allowedActions = ['stats', 'load-test']
    return enumRule(allowedActions, false).validate(value)
  }
}

/**
 * Configuration format validation (js, json)
 */
export const configFormatRule: ValidationRule<string> = {
  name: 'config_format',
  priority: 85,
  validate: (value: string): ValidationResult => {
    const allowedFormats = ['js', 'json']
    return enumRule(allowedFormats, false).validate(value)
  }
}

/**
 * Log level validation (debug, info, warn, error)
 */
export const logLevelRule: ValidationRule<string> = {
  name: 'log_level',
  priority: 85,
  validate: (value: string): ValidationResult => {
    const allowedLevels = ['debug', 'info', 'warn', 'error']
    return enumRule(allowedLevels, false).validate(value)
  }
}

/**
 * Environment validation (development, production, test)
 */
export const environmentRule: ValidationRule<string> = {
  name: 'environment',
  priority: 85,
  validate: (value: string): ValidationResult => {
    const allowedEnvironments = ['development', 'production', 'test']
    return enumRule(allowedEnvironments, false).validate(value)
  }
}

/**
 * Helper function to find similar values using Levenshtein distance
 */
function findSimilarValues(input: string, allowedValues: string[], maxDistance: number): string[] {
  const similar: Array<{ value: string; distance: number }> = []
  
  for (const allowed of allowedValues) {
    const distance = levenshteinDistance(input.toLowerCase(), allowed.toLowerCase())
    if (distance <= maxDistance && distance > 0) {
      similar.push({ value: allowed, distance })
    }
  }
  
  // Sort by distance (closest first) and return up to 3 suggestions
  return similar
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map(item => item.value)
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  // Create matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

/**
 * Factory function to create custom enum validation with context
 */
export function createEnumRule(
  allowedValues: string[],
  options: {
    caseSensitive?: boolean
    name?: string
    context?: string
  } = {}
): ValidationRule<string> {
  return {
    name: options.name || 'custom_enum',
    priority: 85,
    validate: (value: string): ValidationResult => {
      const result = enumRule(allowedValues, options.caseSensitive).validate(value)
      
      if (!result.isValid && options.context) {
        return {
          ...result,
          errorContext: options.context
        }
      }
      
      return result
    }
  }
}
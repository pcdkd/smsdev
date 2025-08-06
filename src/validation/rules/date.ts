/**
 * Date validation rules for SMS-Dev CLI
 * Supports ISO 8601 format validation and date range checks
 */

import { ValidationRule, ValidationResult } from '../types.js'

/**
 * ISO 8601 date format validation
 * Supports formats like: 2023-12-01T10:30:00Z, 2023-12-01T10:30:00+05:00
 */
export const iso8601DateRule: ValidationRule<string> = {
  name: 'iso8601_date',
  priority: 95,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Date must be a string',
        suggestions: ['Provide date as a string in ISO 8601 format']
      }
    }

    const cleanValue = value.trim()
    
    if (cleanValue === '') {
      return {
        isValid: false,
        error: 'Date cannot be empty',
        suggestions: ['Provide a valid ISO 8601 date']
      }
    }

    // ISO 8601 regex pattern - more comprehensive
    const iso8601Regex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/
    
    if (!iso8601Regex.test(cleanValue)) {
      const suggestions = [
        'Use ISO 8601 format: YYYY-MM-DDTHH:mm:ssZ',
        'Examples: 2023-12-01T10:30:00Z, 2023-12-01T10:30:00+05:00',
        'Include T separator between date and time',
        'Include timezone (Z for UTC or +/-HH:mm offset)'
      ]

      // Provide specific feedback based on common mistakes
      if (!cleanValue.includes('T')) {
        suggestions.unshift('Missing T separator between date and time')
      } else if (!cleanValue.match(/Z$|[+-]\d{2}:\d{2}$/)) {
        suggestions.unshift('Missing timezone information (Z or +/-HH:mm)')
      } else if (!/^\d{4}-\d{2}-\d{2}/.test(cleanValue)) {
        suggestions.unshift('Date part must be in YYYY-MM-DD format')
      }

      return {
        isValid: false,
        error: `Invalid ISO 8601 date format: "${value}"`,
        suggestions
      }
    }

    // Validate the date is actually valid (not just format)
    const date = new Date(cleanValue)
    
    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        error: `Invalid date: "${value}"`,
        suggestions: [
          'Check that the date values are valid',
          'Ensure month is 01-12, day is valid for the month',
          'Ensure time values are valid (00-23 hours, 00-59 minutes/seconds)'
        ]
      }
    }

    // Additional validation for reasonable date ranges
    const year = date.getFullYear()
    if (year < 1900 || year > 2100) {
      return {
        isValid: false,
        error: `Date year ${year} is outside reasonable range`,
        suggestions: [
          'Use dates between 1900 and 2100',
          'Check for typos in the year'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: cleanValue
    }
  }
}

/**
 * Flexible date parsing that accepts multiple formats
 */
export const flexibleDateRule: ValidationRule<string> = {
  name: 'flexible_date',
  priority: 85,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Date must be a string',
        suggestions: ['Provide date as a string']
      }
    }

    const cleanValue = value.trim()
    
    if (cleanValue === '') {
      return {
        isValid: false,
        error: 'Date cannot be empty',
        suggestions: ['Provide a valid date']
      }
    }

    // Try to parse the date
    const date = new Date(cleanValue)
    
    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        error: `Cannot parse date: "${value}"`,
        suggestions: [
          'Use ISO 8601 format: 2023-12-01T10:30:00Z',
          'Or common formats: 2023-12-01, 12/01/2023',
          'Ensure the date values are valid'
        ]
      }
    }

    // Convert to ISO 8601 format for consistency
    const isoString = date.toISOString()
    
    return {
      isValid: true,
      sanitizedValue: isoString
    }
  }
}

/**
 * Date range validation - ensures from date is before to date
 */
export const dateRangeRule = (fromDateField: string, toDateField: string): ValidationRule<any> => ({
  name: 'date_range',
  priority: 70,
  validate: (value: any, context): ValidationResult => {
    if (!context?.otherParams) {
      return {
        isValid: true,
        sanitizedValue: value // Skip validation if no context
      }
    }

    const fromDate = context.otherParams[fromDateField]
    const toDate = context.otherParams[toDateField]

    // Skip if either date is missing
    if (!fromDate || !toDate) {
      return {
        isValid: true,
        sanitizedValue: value
      }
    }

    const fromDateTime = new Date(fromDate).getTime()
    const toDateTime = new Date(toDate).getTime()

    if (isNaN(fromDateTime) || isNaN(toDateTime)) {
      return {
        isValid: false,
        error: 'Invalid date format in date range',
        suggestions: [
          'Ensure both dates are in valid format',
          'Use ISO 8601 format for consistency'
        ]
      }
    }

    if (fromDateTime >= toDateTime) {
      return {
        isValid: false,
        error: `From date (${fromDate}) must be before to date (${toDate})`,
        suggestions: [
          'Ensure from-date is earlier than to-date',
          'Check the date values for correctness'
        ]
      }
    }

    // Check if date range is reasonable (not too large)
    const diffDays = (toDateTime - fromDateTime) / (1000 * 60 * 60 * 24)
    if (diffDays > 365) {
      return {
        isValid: false,
        error: `Date range is too large: ${Math.round(diffDays)} days`,
        errorContext: 'Large date ranges may cause performance issues',
        suggestions: [
          'Use a smaller date range (less than 1 year)',
          'Consider breaking large exports into smaller chunks'
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
 * Future date validation
 */
export const futureDateRule: ValidationRule<string> = {
  name: 'future_date',
  priority: 75,
  validate: (value: string): ValidationResult => {
    const date = new Date(value)
    const now = new Date()
    
    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        error: 'Invalid date format',
        suggestions: ['Provide a valid date']
      }
    }

    if (date <= now) {
      return {
        isValid: false,
        error: `Date must be in the future, got ${value}`,
        suggestions: [
          'Use a date and time that is after now',
          `Current time: ${now.toISOString()}`
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
 * Past date validation
 */
export const pastDateRule: ValidationRule<string> = {
  name: 'past_date',
  priority: 75,
  validate: (value: string): ValidationResult => {
    const date = new Date(value)
    const now = new Date()
    
    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        error: 'Invalid date format',
        suggestions: ['Provide a valid date']
      }
    }

    if (date >= now) {
      return {
        isValid: false,
        error: `Date must be in the past, got ${value}`,
        suggestions: [
          'Use a date and time that is before now',
          `Current time: ${now.toISOString()}`
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
 * Recent date validation (within last N days)
 */
export const recentDateRule = (maxDaysAgo: number): ValidationRule<string> => ({
  name: 'recent_date',
  priority: 75,
  validate: (value: string): ValidationResult => {
    const date = new Date(value)
    const now = new Date()
    
    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        error: 'Invalid date format',
        suggestions: ['Provide a valid date']
      }
    }

    const diffMs = now.getTime() - date.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (diffDays > maxDaysAgo) {
      return {
        isValid: false,
        error: `Date is too old: ${Math.round(diffDays)} days ago`,
        suggestions: [
          `Use a date within the last ${maxDaysAgo} days`,
          `Earliest allowed: ${new Date(now.getTime() - maxDaysAgo * 24 * 60 * 60 * 1000).toISOString()}`
        ]
      }
    }

    if (diffDays < 0) {
      return {
        isValid: false,
        error: 'Date cannot be in the future',
        suggestions: ['Use a date in the past']
      }
    }

    return {
      isValid: true,
      sanitizedValue: value
    }
  }
})

/**
 * Factory function to create comprehensive date validation
 */
export function createDateRule(options: {
  format?: 'iso8601' | 'flexible'
  allowFuture?: boolean
  allowPast?: boolean
  maxDaysAgo?: number
  maxDaysAhead?: number
}): ValidationRule<string> {
  return {
    name: 'comprehensive_date',
    priority: 90,
    validate: (value: string): ValidationResult => {
      // Format validation
      const formatRule = options.format === 'flexible' ? flexibleDateRule : iso8601DateRule
      const formatResult = formatRule.validate(value)
      if (!formatResult.isValid) {
        return formatResult
      }

      const sanitizedValue = formatResult.sanitizedValue!
      const date = new Date(sanitizedValue)
      const now = new Date()
      const diffMs = date.getTime() - now.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)

      // Future/past validation
      if (diffDays > 0 && !options.allowFuture) {
        return {
          isValid: false,
          error: 'Future dates are not allowed',
          suggestions: ['Use a date in the past or present']
        }
      }

      if (diffDays < 0 && !options.allowPast) {
        return {
          isValid: false,
          error: 'Past dates are not allowed',
          suggestions: ['Use a date in the future or present']
        }
      }

      // Range validation
      if (options.maxDaysAgo && Math.abs(diffDays) > options.maxDaysAgo && diffDays < 0) {
        return {
          isValid: false,
          error: `Date is too far in the past: ${Math.round(Math.abs(diffDays))} days ago`,
          suggestions: [`Use a date within the last ${options.maxDaysAgo} days`]
        }
      }

      if (options.maxDaysAhead && diffDays > options.maxDaysAhead && diffDays > 0) {
        return {
          isValid: false,
          error: `Date is too far in the future: ${Math.round(diffDays)} days ahead`,
          suggestions: [`Use a date within the next ${options.maxDaysAhead} days`]
        }
      }

      return {
        isValid: true,
        sanitizedValue
      }
    }
  }
}
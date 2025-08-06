/**
 * Phone number validation rules for SMS-Dev CLI
 * Supports E.164 format and common international formats
 */

import { ValidationRule, ValidationResult } from '../types.js'

/**
 * Validates phone numbers in E.164 format
 * E.164 format: +[country code][national number] (max 15 digits total)
 * Examples: +1234567890, +441234567890, +33123456789
 */
export const e164PhoneNumberRule: ValidationRule<string> = {
  name: 'e164_phone_number',
  priority: 100,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Phone number must be a string',
        suggestions: ['Provide phone number as a string value']
      }
    }

    // Remove any whitespace
    const cleaned = value.trim()
    
    if (cleaned.length === 0) {
      return {
        isValid: false,
        error: 'Phone number cannot be empty',
        suggestions: ['Provide a valid phone number']
      }
    }

    // E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/
    
    if (!e164Regex.test(cleaned)) {
      const suggestions = [
        'Use E.164 format: +[country code][number]',
        'Example: +1234567890 (US), +441234567890 (UK)',
        'Must start with + followed by 1-15 digits',
        'No spaces, dashes, or parentheses allowed'
      ]

      // Provide specific feedback based on the input
      if (!cleaned.startsWith('+')) {
        suggestions.unshift('Phone number must start with + (plus sign)')
      } else if (cleaned.length > 16) {
        suggestions.unshift('Phone number is too long (max 15 digits after +)')
      } else if (cleaned.length < 8) {
        suggestions.unshift('Phone number is too short (min 7 digits after +)')
      } else if (!/^\+[1-9]/.test(cleaned)) {
        suggestions.unshift('Country code cannot start with 0')
      }

      return {
        isValid: false,
        error: `Invalid phone number format: "${value}"`,
        suggestions
      }
    }

    return {
      isValid: true,
      sanitizedValue: cleaned
    }
  }
}

/**
 * More lenient phone number validation that accepts common formats
 * and attempts to convert them to E.164
 */
export const flexiblePhoneNumberRule: ValidationRule<string> = {
  name: 'flexible_phone_number',
  priority: 90,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Phone number must be a string',
        suggestions: ['Provide phone number as a string value']
      }
    }

    // Remove common formatting characters
    const cleaned = value
      .trim()
      .replace(/[\s\-\(\)\.\+]/g, '')
      .replace(/^00/, '+') // Convert 00 prefix to +
    
    if (cleaned.length === 0) {
      return {
        isValid: false,
        error: 'Phone number cannot be empty',
        suggestions: ['Provide a valid phone number']
      }
    }

    // Check if it's all digits after cleaning
    if (!/^\+?\d+$/.test(cleaned)) {
      return {
        isValid: false,
        error: 'Phone number contains invalid characters',
        suggestions: [
          'Use only digits, spaces, dashes, parentheses, and + symbol',
          'Remove any letters or special characters'
        ]
      }
    }

    // Convert to E.164-like format
    let e164Format = cleaned.startsWith('+') ? cleaned : `+${cleaned}`
    
    // Basic length validation
    if (e164Format.length < 8 || e164Format.length > 16) {
      return {
        isValid: false,
        error: 'Phone number has invalid length',
        suggestions: [
          'Phone number should be 7-15 digits long',
          'Include country code for international numbers'
        ]
      }
    }

    // Country code should not start with 0
    if (/^\+0/.test(e164Format)) {
      return {
        isValid: false,
        error: 'Country code cannot start with 0',
        suggestions: [
          'Remove leading 0 from country code',
          'Example: +1234567890 (not +01234567890)'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: e164Format
    }
  }
}

/**
 * Validates that phone number is in a supported country
 * This is a basic implementation - in production you might use a phone number library
 */
export const supportedCountryRule: ValidationRule<string> = {
  name: 'supported_country',
  priority: 80,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string' || !value.startsWith('+')) {
      return {
        isValid: false,
        error: 'Phone number must be in E.164 format for country validation',
        suggestions: ['Use E.164 format: +[country code][number]']
      }
    }

    // Common country codes - this is a simplified list
    const supportedCountryCodes = [
      '1',    // US, Canada
      '44',   // UK
      '33',   // France
      '49',   // Germany
      '39',   // Italy
      '34',   // Spain
      '31',   // Netherlands
      '32',   // Belgium
      '41',   // Switzerland
      '43',   // Austria
      '45',   // Denmark
      '46',   // Sweden
      '47',   // Norway
      '358',  // Finland
      '61',   // Australia
      '64',   // New Zealand
      '81',   // Japan
      '82',   // South Korea
      '86',   // China
      '91',   // India
      '55',   // Brazil
      '52',   // Mexico
    ]

    const number = value.substring(1) // Remove + prefix
    const matchedCode = supportedCountryCodes.find(code => number.startsWith(code))

    if (!matchedCode) {
      return {
        isValid: false,
        error: 'Phone number uses an unsupported country code',
        suggestions: [
          'Check if the country code is correct',
          'Supported regions: US, Canada, Europe, Australia, Japan, etc.',
          'Contact support to add support for additional countries'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: value,
      errorContext: `Country code: +${matchedCode}`
    }
  }
}

/**
 * Factory function to create a phone number validator with specific requirements
 */
export function createPhoneNumberRule(options: {
  strict?: boolean
  requireCountryCode?: boolean
  allowedCountries?: string[]
}): ValidationRule<string> {
  return {
    name: 'custom_phone_number',
    priority: 95,
    validate: (value: string): ValidationResult => {
      // Use strict E.164 validation if requested
      if (options.strict) {
        return e164PhoneNumberRule.validate(value)
      }
      
      // Otherwise use flexible validation
      const result = flexiblePhoneNumberRule.validate(value)
      
      if (!result.isValid || !result.sanitizedValue) {
        return result
      }
      
      // Additional country restrictions if specified
      if (options.allowedCountries && options.allowedCountries.length > 0) {
        const number = result.sanitizedValue.substring(1) // Remove +
        const isAllowed = options.allowedCountries.some(code => number.startsWith(code))
        
        if (!isAllowed) {
          return {
            isValid: false,
            error: 'Phone number uses a restricted country code',
            suggestions: [
              `Allowed countries: ${options.allowedCountries.join(', ')}`,
              'Use a phone number from an allowed country'
            ]
          }
        }
      }
      
      return result
    }
  }
}
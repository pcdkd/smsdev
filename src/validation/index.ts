/**
 * Main validation module for SMS-Dev CLI
 * Exports all validation functionality and provides convenience functions
 */

// Core validation framework
export * from './types.js'
export * from './Validator.js'

// All validation rules
export * from './rules/index.js'

// Convenience imports for common patterns
import { Validator } from './Validator.js'
import { ValidationSchema, ValidationContext } from './types.js'
import {
  // Phone number validation
  e164PhoneNumberRule,
  flexiblePhoneNumberRule,
  createPhoneNumberRule,
  
  // File path validation
  fileExistsRule,
  outputFileRule,
  createFilePathRule,
  noDirectoryTraversalRule,
  
  // URL validation
  urlFormatRule,
  httpsOnlyRule,
  webhookUrlRule,
  createUrlRule,
  
  // Numeric validation
  integerRule,
  portRule,
  rangeRule,
  createIntegerRule,
  
  // String validation
  nonEmptyStringRule,
  stringLengthRule,
  safeFilenameRule,
  uuidRule,
  simpleIdRule,
  createStringRule,
  
  // Date validation
  iso8601DateRule,
  dateRangeRule,
  createDateRule,
  
  // Enum validation
  exportFormatRule,
  exportTypeRule,
  mockPhoneActionRule,
  flowActionRule,
  performanceActionRule,
  createEnumRule,
  
  // JSON validation
  jsonParseRule,
  jsonFileRule,
  flowJsonSchemaRule,
  configJsonSchemaRule
} from './rules/index.js'

/**
 * Pre-configured validator instances for common use cases
 */
export class ValidationPresets {
  /**
   * Validator for phone numbers (flexible format with E.164 conversion)
   */
  static phoneNumber(): Validator {
    const validator = new Validator()
    validator.addRule('phone', flexiblePhoneNumberRule)
    return validator
  }

  /**
   * Validator for strict E.164 phone numbers
   */
  static strictPhoneNumber(): Validator {
    const validator = new Validator()
    validator.addRule('phone', e164PhoneNumberRule)
    return validator
  }

  /**
   * Validator for file paths that must exist
   */
  static existingFile(allowedExtensions?: string[]): Validator {
    const validator = new Validator()
    validator.addRule('file', noDirectoryTraversalRule)
    validator.addRule('file', createFilePathRule({
      mustExist: true,
      allowedExtensions,
      securityCheck: false // Already added above
    }))
    return validator
  }

  /**
   * Validator for output file paths
   */
  static outputFile(allowedExtensions?: string[]): Validator {
    const validator = new Validator()
    validator.addRule('file', noDirectoryTraversalRule)
    validator.addRule('file', createFilePathRule({
      requireWritable: true,
      allowedExtensions,
      securityCheck: false // Already added above
    }))
    return validator
  }

  /**
   * Validator for webhook URLs
   */
  static webhookUrl(requireHttps = true): Validator {
    const validator = new Validator()
    validator.addRule('url', createUrlRule({
      requireHttps,
      requirePath: true,
      allowAccessibilityCheck: false // Can be enabled separately
    }))
    return validator
  }

  /**
   * Validator for port numbers
   */
  static port(): Validator {
    const validator = new Validator()
    validator.addRule('port', portRule)
    return validator
  }

  /**
   * Validator for ISO 8601 dates
   */
  static isoDate(allowPast = true, allowFuture = true): Validator {
    const validator = new Validator()
    validator.addRule('date', createDateRule({
      format: 'iso8601',
      allowPast,
      allowFuture
    }))
    return validator
  }

  /**
   * Validator for date ranges (from-date and to-date)
   */
  static dateRange(): Validator {
    const validator = new Validator()
    validator.addRule('fromDate', iso8601DateRule)
    validator.addRule('toDate', iso8601DateRule)
    validator.addRule('dateRange', dateRangeRule('fromDate', 'toDate'))
    return validator
  }

  /**
   * Validator for JSON flow definitions
   */
  static flowJson(): Validator {
    const validator = new Validator()
    validator.addRule('flow', jsonParseRule)
    validator.addRule('flow', flowJsonSchemaRule)
    return validator
  }

  /**
   * Validator for configuration JSON
   */
  static configJson(): Validator {
    const validator = new Validator()
    validator.addRule('config', jsonParseRule)
    validator.addRule('config', configJsonSchemaRule)
    return validator
  }
}

/**
 * Validation schemas for each command
 */
export const CommandValidationSchemas = {
  /**
   * Mock phone command validation
   */
  mockPhone: {
    action: {
      rules: [mockPhoneActionRule],
      options: { required: false }
    },
    phone: {
      rules: [flexiblePhoneNumberRule],
      options: { 
        required: false, // Conditional based on action
        context: 'Required for create and delete actions'
      }
    },
    name: {
      rules: [createStringRule({ 
        minLength: 1, 
        maxLength: 100,
        trim: true 
      })],
      options: { required: false }
    }
  } as ValidationSchema,

  /**
   * Export command validation
   */
  export: {
    type: {
      rules: [exportTypeRule],
      options: { required: false }
    },
    format: {
      rules: [exportFormatRule],
      options: { required: false }
    },
    phone: {
      rules: [flexiblePhoneNumberRule],
      options: { required: false }
    },
    fromDate: {
      rules: [iso8601DateRule],
      options: { required: false }
    },
    toDate: {
      rules: [iso8601DateRule],
      options: { required: false }
    },
    output: {
      rules: [createFilePathRule({ requireWritable: true })],
      options: { required: false }
    }
  } as ValidationSchema,

  /**
   * Flow command validation
   */
  flow: {
    action: {
      rules: [flowActionRule],
      options: { required: false }
    },
    name: {
      rules: [createStringRule({ 
        minLength: 1, 
        maxLength: 50,
        trim: true 
      })],
      options: { required: false }
    },
    file: {
      rules: [
        createFilePathRule({ 
          mustExist: true, 
          allowedExtensions: ['json'] 
        }),
        jsonFileRule,
        flowJsonSchemaRule
      ],
      options: { required: false }
    },
    flowId: {
      rules: [simpleIdRule],
      options: { required: false }
    },
    phone: {
      rules: [flexiblePhoneNumberRule],
      options: { required: false }
    }
  } as ValidationSchema,

  /**
   * Performance command validation
   */
  performance: {
    action: {
      rules: [performanceActionRule],
      options: { required: false }
    },
    messages: {
      rules: [createIntegerRule({ min: 1, max: 10000 })],
      options: { required: false }
    },
    users: {
      rules: [createIntegerRule({ min: 1, max: 100 })],
      options: { required: false }
    },
    duration: {
      rules: [createIntegerRule({ min: 1, max: 300 })],
      options: { required: false }
    }
  } as ValidationSchema,

  /**
   * Server start command validation
   */
  start: {
    config: {
      rules: [createFilePathRule({ mustExist: true, allowedExtensions: ['js', 'json'] })],
      options: { required: false }
    },
    apiPort: {
      rules: [portRule],
      options: { required: false }
    },
    uiPort: {
      rules: [portRule],
      options: { required: false }
    },
    webhookUrl: {
      rules: [createUrlRule({ requireHttps: false, requirePath: true })],
      options: { required: false }
    }
  } as ValidationSchema,

  /**
   * Config command validation
   */
  config: {
    config: {
      rules: [createFilePathRule({ mustExist: true, allowedExtensions: ['js', 'json'] })],
      options: { required: false }
    }
  } as ValidationSchema
}

/**
 * Quick validation functions for common patterns
 */
export const QuickValidate = {
  /**
   * Validate a phone number
   */
  async phoneNumber(value: string, strict = false): Promise<boolean> {
    const rule = strict ? e164PhoneNumberRule : flexiblePhoneNumberRule
    const result = await rule.validate(value)
    return result.isValid
  },

  /**
   * Validate a file path exists
   */
  async fileExists(path: string): Promise<boolean> {
    const result = await fileExistsRule.validate(path)
    return result.isValid
  },

  /**
   * Validate a URL format
   */
  async url(url: string): Promise<boolean> {
    const result = await urlFormatRule.validate(url)
    return result.isValid
  },

  /**
   * Validate a port number
   */
  async port(port: number | string): Promise<boolean> {
    const result = await portRule.validate(port)
    return result.isValid
  },

  /**
   * Validate ISO 8601 date
   */
  async isoDate(date: string): Promise<boolean> {
    const result = await iso8601DateRule.validate(date)
    return result.isValid
  },

  /**
   * Validate JSON format
   */
  async json(json: string): Promise<boolean> {
    const result = await jsonParseRule.validate(json)
    return result.isValid
  }
}
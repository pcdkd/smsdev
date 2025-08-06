/**
 * Core Validator class for SMS-Dev CLI
 * Provides centralized, type-safe validation with comprehensive error handling
 */

import {
  ValidationContext,
  ValidationResult,
  ValidationRule,
  ValidatorConfig,
  ValidationError,
  ValidationResults,
  FieldValidationOptions,
  ValidationSchema
} from './types.js'

export class Validator {
  private rules: Map<string, ValidationRule[]> = new Map()
  private config: ValidatorConfig

  constructor(config: ValidatorConfig = {}) {
    this.config = {
      stopOnFirstError: false,
      skipAsync: false,
      ...config
    }
  }

  /**
   * Register a validation rule for a specific field
   */
  addRule(fieldName: string, rule: ValidationRule): void {
    if (!this.rules.has(fieldName)) {
      this.rules.set(fieldName, [])
    }
    
    const fieldRules = this.rules.get(fieldName)!
    fieldRules.push(rule)
    
    // Sort by priority (higher priority first)
    fieldRules.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  /**
   * Add multiple rules for a field
   */
  addRules(fieldName: string, rules: ValidationRule[]): void {
    rules.forEach(rule => this.addRule(fieldName, rule))
  }

  /**
   * Validate a single value against its registered rules
   */
  async validateField(
    fieldName: string, 
    value: any, 
    context?: ValidationContext,
    options: FieldValidationOptions = {}
  ): Promise<ValidationResult> {
    const rules = this.rules.get(fieldName) || []
    
    // Check if field is required
    if (options.required && (value === undefined || value === null || value === '')) {
      return {
        isValid: false,
        error: options.requiredMessage || `${fieldName} is required`,
        suggestions: [`Provide a value for ${fieldName}`]
      }
    }

    // Skip validation if empty and skipIfEmpty is true
    if (options.skipIfEmpty && (value === undefined || value === null || value === '')) {
      return {
        isValid: true,
        sanitizedValue: value
      }
    }

    // Run all validation rules
    for (const rule of rules) {
      // Skip async rules if configured to do so
      if (rule.async && this.config.skipAsync) {
        continue
      }

      try {
        const result = await rule.validate(value, context)
        
        if (!result.isValid) {
          return {
            ...result,
            errorContext: options.context || result.errorContext
          }
        }
        
        // Use sanitized value for next validation
        if (result.sanitizedValue !== undefined) {
          value = result.sanitizedValue
        }
      } catch (error: any) {
        return {
          isValid: false,
          error: `Validation rule '${rule.name}' failed: ${error.message}`,
          suggestions: ['Check the validation rule implementation', 'Contact support if this persists']
        }
      }
    }

    return {
      isValid: true,
      sanitizedValue: value
    }
  }

  /**
   * Validate multiple fields using a schema
   */
  async validateSchema(
    data: Record<string, any>,
    schema: ValidationSchema,
    context?: ValidationContext
  ): Promise<ValidationResults> {
    const errors: ValidationError[] = []
    const sanitizedValues: Record<string, any> = {}
    let totalFields = 0
    
    for (const [fieldName, fieldConfig] of Object.entries(schema)) {
      totalFields++
      const value = data[fieldName]
      
      // Add rules for this field if not already added
      if (!this.rules.has(fieldName)) {
        this.addRules(fieldName, fieldConfig.rules)
      }
      
      const result = await this.validateField(
        fieldName,
        value,
        context,
        fieldConfig.options
      )
      
      if (!result.isValid) {
        errors.push(new ValidationError(
          fieldName,
          value,
          'schema_validation',
          result.error || 'Validation failed',
          result.suggestions || [],
          result.errorContext
        ))
        
        if (this.config.stopOnFirstError) {
          break
        }
      } else {
        sanitizedValues[fieldName] = result.sanitizedValue !== undefined ? result.sanitizedValue : value
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValues,
      summary: {
        total: totalFields,
        passed: totalFields - errors.length,
        failed: errors.length
      }
    }
  }

  /**
   * Validate a simple key-value object
   */
  async validateObject(
    data: Record<string, any>,
    context?: ValidationContext
  ): Promise<ValidationResults> {
    const errors: ValidationError[] = []
    const sanitizedValues: Record<string, any> = {}
    let totalFields = 0
    
    for (const [fieldName, value] of Object.entries(data)) {
      totalFields++
      
      const result = await this.validateField(fieldName, value, context)
      
      if (!result.isValid) {
        errors.push(new ValidationError(
          fieldName,
          value,
          'field_validation',
          result.error || 'Validation failed',
          result.suggestions || [],
          result.errorContext
        ))
        
        if (this.config.stopOnFirstError) {
          break
        }
      } else {
        sanitizedValues[fieldName] = result.sanitizedValue !== undefined ? result.sanitizedValue : value
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValues,
      summary: {
        total: totalFields,
        passed: totalFields - errors.length,
        failed: errors.length
      }
    }
  }

  /**
   * Create a new validator instance with different config
   */
  withConfig(config: Partial<ValidatorConfig>): Validator {
    const newValidator = new Validator({ ...this.config, ...config })
    
    // Copy all rules to new instance
    for (const [fieldName, rules] of this.rules.entries()) {
      newValidator.addRules(fieldName, [...rules])
    }
    
    return newValidator
  }

  /**
   * Get all registered rules for debugging
   */
  getRules(): Map<string, ValidationRule[]> {
    return new Map(this.rules)
  }

  /**
   * Clear all rules
   */
  clearRules(): void {
    this.rules.clear()
  }

  /**
   * Remove rules for a specific field
   */
  removeFieldRules(fieldName: string): void {
    this.rules.delete(fieldName)
  }
}
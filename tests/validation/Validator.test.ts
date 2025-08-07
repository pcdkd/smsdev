/**
 * Tests for the core Validator class
 * Tests rule registration, execution, priority handling, and schema validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { 
  Validator, 
  ValidationRule, 
  ValidationResult,
  ValidationSchema,
  ValidationContext 
} from '../../src/validation/index.js'

describe('Validator Class Tests', () => {
  let validator: Validator

  beforeEach(() => {
    validator = new Validator()
  })

  describe('Rule Registration', () => {
    it('should register and execute single rules', async () => {
      const testRule: ValidationRule = {
        name: 'test_rule',
        validate: (value: any) => ({
          isValid: value === 'valid',
          error: value !== 'valid' ? 'Value must be "valid"' : undefined
        })
      }

      validator.addRule('testField', testRule)
      
      const validResult = await validator.validateField('testField', 'valid')
      expect(validResult.isValid).toBe(true)
      
      const invalidResult = await validator.validateField('testField', 'invalid')
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.error).toBe('Value must be "valid"')
    })

    it('should register multiple rules for same field', async () => {
      const rule1: ValidationRule = {
        name: 'min_length',
        priority: 90,
        validate: (value: string) => ({
          isValid: value.length >= 3,
          error: value.length < 3 ? 'Too short' : undefined
        })
      }

      const rule2: ValidationRule = {
        name: 'max_length',
        priority: 80,
        validate: (value: string) => ({
          isValid: value.length <= 10,
          error: value.length > 10 ? 'Too long' : undefined
        })
      }

      validator.addRule('username', rule1)
      validator.addRule('username', rule2)

      const validResult = await validator.validateField('username', 'john')
      expect(validResult.isValid).toBe(true)

      const tooShort = await validator.validateField('username', 'ab')
      expect(tooShort.isValid).toBe(false)
      expect(tooShort.error).toBe('Too short')

      const tooLong = await validator.validateField('username', 'verylongusername')
      expect(tooLong.isValid).toBe(false)
      expect(tooLong.error).toBe('Too long')
    })

    it('should clear rules for a field', () => {
      const rule: ValidationRule = {
        name: 'test',
        validate: () => ({ isValid: false, error: 'Always fails' })
      }

      validator.addRule('field', rule)
      validator.clearRules('field')

      // Should return valid since no rules exist
      const result = validator.validateField('field', 'any value')
      expect(result).resolves.toEqual({ isValid: true })
    })

    it('should clear all rules', () => {
      validator.addRule('field1', { name: 'rule1', validate: () => ({ isValid: true }) })
      validator.addRule('field2', { name: 'rule2', validate: () => ({ isValid: true }) })
      
      validator.clearAllRules()

      expect(validator.validateField('field1', 'value')).resolves.toEqual({ isValid: true })
      expect(validator.validateField('field2', 'value')).resolves.toEqual({ isValid: true })
    })
  })

  describe('Priority Handling', () => {
    it('should execute rules in priority order (highest first)', async () => {
      const executionOrder: string[] = []

      const lowPriority: ValidationRule = {
        name: 'low',
        priority: 10,
        validate: () => {
          executionOrder.push('low')
          return { isValid: true }
        }
      }

      const highPriority: ValidationRule = {
        name: 'high',
        priority: 100,
        validate: () => {
          executionOrder.push('high')
          return { isValid: true }
        }
      }

      const mediumPriority: ValidationRule = {
        name: 'medium',
        priority: 50,
        validate: () => {
          executionOrder.push('medium')
          return { isValid: true }
        }
      }

      // Add in random order
      validator.addRule('field', lowPriority)
      validator.addRule('field', highPriority)
      validator.addRule('field', mediumPriority)

      await validator.validateField('field', 'value')

      expect(executionOrder).toEqual(['high', 'medium', 'low'])
    })

    it('should stop on first error with stopOnFirstError option', async () => {
      const executionOrder: string[] = []

      const rule1: ValidationRule = {
        name: 'rule1',
        priority: 100,
        validate: () => {
          executionOrder.push('rule1')
          return { isValid: false, error: 'Rule 1 failed' }
        }
      }

      const rule2: ValidationRule = {
        name: 'rule2',
        priority: 50,
        validate: () => {
          executionOrder.push('rule2')
          return { isValid: true }
        }
      }

      validator.addRule('field', rule1)
      validator.addRule('field', rule2)

      const result = await validator.validateField('field', 'value', undefined, {
        stopOnFirstError: true
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Rule 1 failed')
      expect(executionOrder).toEqual(['rule1']) // Rule2 should not execute
    })
  })

  describe('Async Rule Handling', () => {
    it('should handle async validation rules', async () => {
      const asyncRule: ValidationRule = {
        name: 'async_rule',
        async: true,
        validate: async (value: string) => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10))
          return {
            isValid: value === 'async-valid',
            error: value !== 'async-valid' ? 'Async validation failed' : undefined
          }
        }
      }

      validator.addRule('asyncField', asyncRule)

      const result = await validator.validateField('asyncField', 'async-valid')
      expect(result.isValid).toBe(true)
    })

    it('should skip async rules with skipAsync option', async () => {
      let asyncExecuted = false

      const asyncRule: ValidationRule = {
        name: 'async_rule',
        async: true,
        validate: async () => {
          asyncExecuted = true
          return { isValid: false, error: 'Should not execute' }
        }
      }

      const syncRule: ValidationRule = {
        name: 'sync_rule',
        validate: () => ({ isValid: true })
      }

      validator.addRule('field', asyncRule)
      validator.addRule('field', syncRule)

      const result = await validator.validateField('field', 'value', undefined, {
        skipAsync: true
      })

      expect(result.isValid).toBe(true)
      expect(asyncExecuted).toBe(false)
    })

    it('should handle mixed sync and async rules', async () => {
      const results: string[] = []

      const syncRule1: ValidationRule = {
        name: 'sync1',
        priority: 100,
        validate: () => {
          results.push('sync1')
          return { isValid: true }
        }
      }

      const asyncRule: ValidationRule = {
        name: 'async',
        priority: 90,
        async: true,
        validate: async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          results.push('async')
          return { isValid: true }
        }
      }

      const syncRule2: ValidationRule = {
        name: 'sync2',
        priority: 80,
        validate: () => {
          results.push('sync2')
          return { isValid: true }
        }
      }

      validator.addRule('field', syncRule1)
      validator.addRule('field', asyncRule)
      validator.addRule('field', syncRule2)

      await validator.validateField('field', 'value')

      expect(results).toEqual(['sync1', 'async', 'sync2'])
    })
  })

  describe('Context Handling', () => {
    it('should pass context to validation rules', async () => {
      let receivedContext: ValidationContext | undefined

      const contextAwareRule: ValidationRule = {
        name: 'context_aware',
        validate: (value, context) => {
          receivedContext = context
          return { isValid: true }
        }
      }

      validator.addRule('field', contextAwareRule)

      const context: ValidationContext = {
        command: 'test-command',
        action: 'create',
        otherParams: { userId: 123 },
        verbose: true
      }

      await validator.validateField('field', 'value', context)

      expect(receivedContext).toEqual(context)
    })

    it('should merge config context with provided context', async () => {
      let receivedContext: ValidationContext | undefined

      const rule: ValidationRule = {
        name: 'test',
        validate: (value, context) => {
          receivedContext = context
          return { isValid: true }
        }
      }

      validator.addRule('field', rule)

      const configContext: ValidationContext = {
        command: 'global-command',
        otherParams: { global: true }
      }

      const fieldContext: ValidationContext = {
        command: 'field-command',
        action: 'create',
        otherParams: { field: true }
      }

      await validator.validateField('field', 'value', fieldContext, {
        context: configContext
      })

      // Field context should override config context
      expect(receivedContext?.command).toBe('field-command')
      expect(receivedContext?.action).toBe('create')
      expect(receivedContext?.otherParams).toEqual({ field: true })
    })
  })

  describe('Schema Validation', () => {
    it('should validate complete schemas', async () => {
      const schema: ValidationSchema = {
        username: {
          rules: [{
            name: 'length',
            validate: (value: string) => ({
              isValid: value.length >= 3 && value.length <= 20,
              error: 'Username must be 3-20 characters'
            })
          }],
          options: { required: true }
        },
        email: {
          rules: [{
            name: 'email',
            validate: (value: string) => ({
              isValid: value.includes('@'),
              error: 'Invalid email format'
            })
          }],
          options: { required: true }
        },
        age: {
          rules: [{
            name: 'age',
            validate: (value: number) => ({
              isValid: value >= 18,
              error: 'Must be 18 or older'
            })
          }],
          options: { required: false }
        }
      }

      // Add rules from schema
      for (const [field, config] of Object.entries(schema)) {
        for (const rule of config.rules) {
          validator.addRule(field, rule)
        }
      }

      // Valid data
      const validData = {
        username: 'johndoe',
        email: 'john@example.com',
        age: 25
      }

      const validResults = await validator.validateSchema(validData, schema)
      expect(validResults.isValid).toBe(true)
      expect(validResults.errors).toHaveLength(0)
      expect(validResults.summary.passed).toBe(3)

      // Invalid data
      const invalidData = {
        username: 'ab', // Too short
        email: 'invalid-email', // No @
        age: 16 // Too young
      }

      const invalidResults = await validator.validateSchema(invalidData, schema)
      expect(invalidResults.isValid).toBe(false)
      expect(invalidResults.errors).toHaveLength(3)
      expect(invalidResults.summary.failed).toBe(3)
    })

    it('should handle required fields in schema', async () => {
      const schema: ValidationSchema = {
        requiredField: {
          rules: [{
            name: 'test',
            validate: () => ({ isValid: true })
          }],
          options: { required: true, requiredMessage: 'This field is mandatory' }
        },
        optionalField: {
          rules: [{
            name: 'test',
            validate: () => ({ isValid: true })
          }],
          options: { required: false }
        }
      }

      // Add rules
      for (const [field, config] of Object.entries(schema)) {
        for (const rule of config.rules) {
          validator.addRule(field, rule)
        }
      }

      // Missing required field
      const missingRequired = {
        optionalField: 'value'
      }

      const results = await validator.validateSchema(missingRequired, schema)
      expect(results.isValid).toBe(false)
      expect(results.errors).toHaveLength(1)
      expect(results.errors[0].message).toBe('This field is mandatory')
    })

    it('should skip validation for empty optional fields', async () => {
      let validationExecuted = false

      const schema: ValidationSchema = {
        optionalField: {
          rules: [{
            name: 'test',
            validate: () => {
              validationExecuted = true
              return { isValid: false, error: 'Should not execute' }
            }
          }],
          options: { required: false, skipIfEmpty: true }
        }
      }

      validator.addRule('optionalField', schema.optionalField.rules[0])

      const data = {
        optionalField: ''
      }

      const results = await validator.validateSchema(data, schema)
      expect(results.isValid).toBe(true)
      expect(validationExecuted).toBe(false)
    })

    it('should collect sanitized values from schema validation', async () => {
      const schema: ValidationSchema = {
        phone: {
          rules: [{
            name: 'phone',
            validate: (value: string) => ({
              isValid: true,
              sanitizedValue: value.replace(/\D/g, '') // Remove non-digits
            })
          }]
        },
        name: {
          rules: [{
            name: 'trim',
            validate: (value: string) => ({
              isValid: true,
              sanitizedValue: value.trim()
            })
          }]
        }
      }

      // Add rules
      for (const [field, config] of Object.entries(schema)) {
        for (const rule of config.rules) {
          validator.addRule(field, rule)
        }
      }

      const data = {
        phone: '(123) 456-7890',
        name: '  John Doe  '
      }

      const results = await validator.validateSchema(data, schema)
      expect(results.isValid).toBe(true)
      expect(results.fieldResults.phone.sanitizedValue).toBe('1234567890')
      expect(results.fieldResults.name.sanitizedValue).toBe('John Doe')
      expect(results.sanitizedValues).toEqual({
        phone: '1234567890',
        name: 'John Doe'
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle validation rule errors gracefully', async () => {
      const throwingRule: ValidationRule = {
        name: 'throwing',
        validate: () => {
          throw new Error('Rule implementation error')
        }
      }

      validator.addRule('field', throwingRule)

      const result = await validator.validateField('field', 'value')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Validation error')
      expect(result.error).toContain('Rule implementation error')
    })

    it('should handle Promise rejection in async rules', async () => {
      const rejectingRule: ValidationRule = {
        name: 'rejecting',
        async: true,
        validate: async () => {
          throw new Error('Async rejection')
        }
      }

      validator.addRule('field', rejectingRule)

      const result = await validator.validateField('field', 'value')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Async rejection')
    })

    it('should validate fields with no rules', async () => {
      const result = await validator.validateField('unregisteredField', 'any value')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should handle null and undefined values', async () => {
      const rule: ValidationRule = {
        name: 'null_check',
        validate: (value) => ({
          isValid: value !== null && value !== undefined,
          error: 'Value cannot be null or undefined'
        })
      }

      validator.addRule('field', rule)

      const nullResult = await validator.validateField('field', null)
      expect(nullResult.isValid).toBe(false)

      const undefinedResult = await validator.validateField('field', undefined)
      expect(undefinedResult.isValid).toBe(false)
    })

    it('should preserve original error suggestions', async () => {
      const rule: ValidationRule = {
        name: 'suggestions_test',
        validate: () => ({
          isValid: false,
          error: 'Validation failed',
          suggestions: ['Try this', 'Or try that', 'Check the documentation']
        })
      }

      validator.addRule('field', rule)

      const result = await validator.validateField('field', 'value')
      expect(result.isValid).toBe(false)
      expect(result.suggestions).toEqual(['Try this', 'Or try that', 'Check the documentation'])
    })
  })

  describe('Performance Considerations', () => {
    it('should handle large numbers of rules efficiently', async () => {
      // Add 100 rules
      for (let i = 0; i < 100; i++) {
        const rule: ValidationRule = {
          name: `rule_${i}`,
          priority: i,
          validate: () => ({ isValid: true })
        }
        validator.addRule('field', rule)
      }

      const startTime = Date.now()
      const result = await validator.validateField('field', 'value')
      const duration = Date.now() - startTime

      expect(result.isValid).toBe(true)
      expect(duration).toBeLessThan(100) // Should complete in under 100ms
    })

    it('should handle complex schemas efficiently', async () => {
      const schema: ValidationSchema = {}
      
      // Create a schema with 50 fields
      for (let i = 0; i < 50; i++) {
        schema[`field_${i}`] = {
          rules: [
            {
              name: `rule_${i}_1`,
              validate: () => ({ isValid: true })
            },
            {
              name: `rule_${i}_2`,
              validate: () => ({ isValid: true })
            }
          ]
        }
      }

      // Add all rules
      for (const [field, config] of Object.entries(schema)) {
        for (const rule of config.rules) {
          validator.addRule(field, rule)
        }
      }

      // Create data for all fields
      const data: Record<string, any> = {}
      for (let i = 0; i < 50; i++) {
        data[`field_${i}`] = `value_${i}`
      }

      const startTime = Date.now()
      const results = await validator.validateSchema(data, schema)
      const duration = Date.now() - startTime

      expect(results.isValid).toBe(true)
      expect(results.summary.total).toBe(50)
      expect(duration).toBeLessThan(200) // Should complete in under 200ms
    })
  })
})
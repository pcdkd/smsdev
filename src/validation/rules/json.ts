/**
 * JSON validation rules for SMS-Dev CLI
 * Handles JSON parsing, schema validation, and structure validation
 */

import fs from 'fs'
import { ValidationRule, ValidationResult } from '../types.js'

/**
 * Basic JSON parsing validation
 */
export const jsonParseRule: ValidationRule<string> = {
  name: 'json_parse',
  priority: 95,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'JSON must be a string',
        suggestions: ['Provide JSON as a string value']
      }
    }

    const trimmed = value.trim()
    
    if (trimmed === '') {
      return {
        isValid: false,
        error: 'JSON string cannot be empty',
        suggestions: ['Provide valid JSON content']
      }
    }

    try {
      const parsed = JSON.parse(trimmed)
      return {
        isValid: true,
        sanitizedValue: parsed
      }
    } catch (error: any) {
      const suggestions = [
        'Check for missing commas between properties',
        'Ensure all strings are in double quotes',
        'Verify brackets and braces are properly matched',
        'Remove trailing commas'
      ]

      // Provide specific feedback based on common JSON errors
      const errorMsg = error.message.toLowerCase()
      if (errorMsg.includes('unexpected token')) {
        suggestions.unshift('Check for syntax errors near the reported position')
      } else if (errorMsg.includes('unexpected end')) {
        suggestions.unshift('JSON appears to be incomplete - check for missing closing brackets')
      } else if (errorMsg.includes('property name')) {
        suggestions.unshift('Property names must be enclosed in double quotes')
      }

      return {
        isValid: false,
        error: `Invalid JSON: ${error.message}`,
        suggestions
      }
    }
  }
}

/**
 * JSON file validation (reads and parses file content)
 */
export const jsonFileRule: ValidationRule<string> = {
  name: 'json_file',
  async: true,
  priority: 90,
  validate: async (value: string): Promise<ValidationResult> => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'File path must be a string',
        suggestions: ['Provide a valid file path']
      }
    }

    const filePath = value.trim()
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf8')
      
      // Validate JSON content
      const jsonResult = jsonParseRule.validate(content)
      if (!jsonResult.isValid) {
        return {
          ...jsonResult,
          error: `Invalid JSON in file "${filePath}": ${jsonResult.error}`,
          errorContext: `File: ${filePath}`
        }
      }

      return {
        isValid: true,
        sanitizedValue: jsonResult.sanitizedValue
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          isValid: false,
          error: `JSON file not found: ${filePath}`,
          suggestions: [
            'Check the file path for typos',
            'Ensure the file exists',
            'Use an absolute path if needed'
          ]
        }
      } else if (error.code === 'EACCES') {
        return {
          isValid: false,
          error: `Permission denied reading file: ${filePath}`,
          suggestions: [
            'Check file permissions',
            'Ensure you have read access to the file'
          ]
        }
      } else {
        return {
          isValid: false,
          error: `Error reading JSON file: ${error.message}`,
          suggestions: [
            'Check if the file is accessible',
            'Verify file system permissions'
          ]
        }
      }
    }
  }
}

/**
 * JSON object structure validation
 */
export const jsonObjectRule: ValidationRule<any> = {
  name: 'json_object',
  priority: 85,
  validate: (value: any): ValidationResult => {
    if (value === null) {
      return {
        isValid: false,
        error: 'JSON cannot be null',
        suggestions: ['Provide a valid JSON object or array']
      }
    }

    if (typeof value !== 'object') {
      return {
        isValid: false,
        error: `Expected JSON object or array, got ${typeof value}`,
        suggestions: [
          'Ensure JSON represents an object {} or array []',
          'Primitive values (strings, numbers, booleans) are not allowed'
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
 * Required properties validation
 */
export const requiredPropertiesRule = (requiredProps: string[]): ValidationRule<any> => ({
  name: 'required_properties',
  priority: 80,
  validate: (value: any): ValidationResult => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        isValid: false,
        error: 'Value must be a JSON object',
        suggestions: ['Provide a valid JSON object with required properties']
      }
    }

    const missing = requiredProps.filter(prop => !(prop in value))
    
    if (missing.length > 0) {
      return {
        isValid: false,
        error: `Missing required properties: ${missing.join(', ')}`,
        suggestions: [
          `Add required properties: ${missing.join(', ')}`,
          'Check the JSON schema documentation',
          'Ensure all required fields are present'
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
 * JSON schema validation for conversation flows
 */
export const flowJsonSchemaRule: ValidationRule<any> = {
  name: 'flow_json_schema',
  priority: 75,
  validate: (value: any): ValidationResult => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        isValid: false,
        error: 'Flow definition must be a JSON object',
        suggestions: ['Provide a valid JSON object for flow definition']
      }
    }

    // Check required flow properties
    const requiredProps = ['name', 'triggers', 'steps']
    const missing = requiredProps.filter(prop => !(prop in value))
    
    if (missing.length > 0) {
      return {
        isValid: false,
        error: `Flow definition missing required properties: ${missing.join(', ')}`,
        suggestions: [
          'Include all required properties: name, triggers, steps',
          'Check the flow definition documentation',
          'Example: { "name": "Welcome Flow", "triggers": [...], "steps": [...] }'
        ]
      }
    }

    // Validate triggers
    if (!Array.isArray(value.triggers)) {
      return {
        isValid: false,
        error: 'Flow triggers must be an array',
        suggestions: [
          'Provide triggers as an array',
          'Example: "triggers": [{"type": "keyword", "value": "hello"}]'
        ]
      }
    }

    // Validate steps
    if (!Array.isArray(value.steps)) {
      return {
        isValid: false,
        error: 'Flow steps must be an array',
        suggestions: [
          'Provide steps as an array',
          'Example: "steps": [{"type": "message", "content": "Hello!"}]'
        ]
      }
    }

    // Basic validation of steps structure
    for (let i = 0; i < value.steps.length; i++) {
      const step = value.steps[i]
      if (!step || typeof step !== 'object' || !step.type) {
        return {
          isValid: false,
          error: `Invalid step at index ${i}: missing type property`,
          suggestions: [
            'Each step must have a "type" property',
            'Valid step types: message, delay, condition, action'
          ]
        }
      }
    }

    return {
      isValid: true,
      sanitizedValue: value
    }
  }
}

/**
 * Configuration JSON validation
 */
export const configJsonSchemaRule: ValidationRule<any> = {
  name: 'config_json_schema',
  priority: 75,
  validate: (value: any): ValidationResult => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        isValid: false,
        error: 'Configuration must be a JSON object',
        suggestions: ['Provide a valid JSON object for configuration']
      }
    }

    // Validate port numbers if present
    const portFields = ['apiPort', 'uiPort']
    for (const field of portFields) {
      if (field in value) {
        const port = value[field]
        if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
          return {
            isValid: false,
            error: `Invalid ${field}: must be an integer between 1 and 65535`,
            suggestions: [
              `Set ${field} to a valid port number`,
              'Example: "apiPort": 4001, "uiPort": 4000'
            ]
          }
        }
      }
    }

    // Validate webhook URL if present
    if ('webhookUrl' in value) {
      const webhookUrl = value.webhookUrl
      if (webhookUrl !== null && typeof webhookUrl !== 'string') {
        return {
          isValid: false,
          error: 'webhookUrl must be a string or null',
          suggestions: [
            'Set webhookUrl to a valid URL string',
            'Example: "webhookUrl": "https://api.example.com/webhook"',
            'Or set to null to disable: "webhookUrl": null'
          ]
        }
      }
    }

    // Validate CORS settings if present
    if ('cors' in value && value.cors !== null) {
      const cors = value.cors
      if (typeof cors !== 'object' || Array.isArray(cors)) {
        return {
          isValid: false,
          error: 'CORS configuration must be an object',
          suggestions: [
            'Provide CORS as an object with enabled and origins properties',
            'Example: "cors": { "enabled": true, "origins": ["*"] }'
          ]
        }
      }

      if ('enabled' in cors && typeof cors.enabled !== 'boolean') {
        return {
          isValid: false,
          error: 'CORS enabled property must be a boolean',
          suggestions: ['Set "enabled": true or "enabled": false']
        }
      }

      if ('origins' in cors && !Array.isArray(cors.origins)) {
        return {
          isValid: false,
          error: 'CORS origins must be an array',
          suggestions: [
            'Provide origins as an array of strings',
            'Example: "origins": ["*"] or "origins": ["http://localhost:3000"]'
          ]
        }
      }
    }

    return {
      isValid: true,
      sanitizedValue: value
    }
  }
}

/**
 * Factory function to create custom JSON schema validation
 */
export function createJsonSchemaRule(schema: {
  requiredProperties?: string[]
  optionalProperties?: string[]
  propertyValidators?: Record<string, (value: any) => ValidationResult>
}): ValidationRule<any> {
  return {
    name: 'custom_json_schema',
    priority: 75,
    validate: (value: any): ValidationResult => {
      // Basic object validation
      const objectResult = jsonObjectRule.validate(value)
      if (!objectResult.isValid) {
        return objectResult
      }

      // Required properties
      if (schema.requiredProperties && schema.requiredProperties.length > 0) {
        const requiredResult = requiredPropertiesRule(schema.requiredProperties).validate(value)
        if (!requiredResult.isValid) {
          return requiredResult
        }
      }

      // Property-specific validation
      if (schema.propertyValidators) {
        for (const [propName, validator] of Object.entries(schema.propertyValidators)) {
          if (propName in value) {
            const propResult = validator(value[propName])
            if (!propResult.isValid) {
              return {
                ...propResult,
                error: `Property "${propName}": ${propResult.error}`,
                errorContext: `Validating property: ${propName}`
              }
            }
          }
        }
      }

      return {
        isValid: true,
        sanitizedValue: value
      }
    }
  }
}
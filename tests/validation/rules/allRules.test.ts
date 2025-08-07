/**
 * Comprehensive tests for all validation rules
 * Tests each validation rule category with edge cases and error messages
 */

import { describe, it, expect } from '@jest/globals'
import {
  // Phone number rules
  e164PhoneNumberRule,
  flexiblePhoneNumberRule,
  createPhoneNumberRule,
  
  // File path rules
  fileExistsRule,
  outputFileRule,
  createFilePathRule,
  noDirectoryTraversalRule,
  
  // URL rules
  urlFormatRule,
  httpsOnlyRule,
  webhookUrlRule,
  createUrlRule,
  
  // Numeric rules
  integerRule,
  portRule,
  rangeRule,
  createIntegerRule,
  
  // String rules
  nonEmptyStringRule,
  stringLengthRule,
  safeFilenameRule,
  uuidRule,
  simpleIdRule,
  createStringRule,
  
  // Date rules
  iso8601DateRule,
  dateRangeRule,
  createDateRule,
  
  // Enum rules
  exportFormatRule,
  exportTypeRule,
  mockPhoneActionRule,
  flowActionRule,
  performanceActionRule,
  createEnumRule,
  
  // JSON rules
  jsonParseRule,
  jsonFileRule,
  flowJsonSchemaRule,
  configJsonSchemaRule
} from '../../../src/validation/rules/index.js'

import fs from 'fs'
import path from 'path'

describe('Validation Rules Comprehensive Tests', () => {
  const tempDir = path.join(__dirname, 'temp-validation-tests')
  
  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('Phone Number Validation Rules', () => {
    describe('e164PhoneNumberRule', () => {
      it('should validate strict E.164 format', () => {
        const validNumbers = ['+12345678900', '+442012345678', '+861234567890']
        
        for (const number of validNumbers) {
          const result = e164PhoneNumberRule.validate(number)
          expect(result.isValid).toBe(true)
          expect(result.sanitizedValue).toBe(number)
        }
      })

      it('should reject non-E.164 formats', () => {
        const invalidNumbers = [
          '12345678900',     // Missing +
          '+1-234-567-8900', // Contains formatting
          '(234) 567-8900',  // US format without country code
          '+1234',           // Too short
          'not-a-phone'      // Invalid format
        ]
        
        for (const number of invalidNumbers) {
          const result = e164PhoneNumberRule.validate(number)
          expect(result.isValid).toBe(false)
          expect(result.error).toBeDefined()
          expect(result.suggestions).toBeDefined()
        }
      })
    })

    describe('flexiblePhoneNumberRule', () => {
      it('should parse various phone formats to E.164', () => {
        const testCases = [
          { input: '+12345678900', expected: '+12345678900' },
          { input: '+1-234-567-8900', expected: '+12345678900' },
          { input: '+1 (234) 567-8900', expected: '+12345678900' },
          { input: '(234) 567-8900', expected: '+12345678900' },
          { input: '234-567-8900', expected: '+12345678900' },
          { input: '2345678900', expected: '+12345678900' }
        ]
        
        for (const { input, expected } of testCases) {
          const result = flexiblePhoneNumberRule.validate(input)
          expect(result.isValid).toBe(true)
          expect(result.sanitizedValue).toBe(expected)
        }
      })

      it('should provide helpful error messages for invalid formats', () => {
        const result = flexiblePhoneNumberRule.validate('123')
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('Too few digits')
        expect(result.suggestions).toContain('Include country code')
      })
    })

    describe('createPhoneNumberRule', () => {
      it('should create custom phone validation rules', () => {
        const ukOnlyRule = createPhoneNumberRule({
          allowedCountries: ['GB'],
          requireCountryCode: true
        })
        
        const validUK = ukOnlyRule.validate('+442012345678')
        expect(validUK.isValid).toBe(true)
        
        const invalidUS = ukOnlyRule.validate('+12345678900')
        expect(invalidUS.isValid).toBe(false)
        expect(invalidUS.error).toContain('allowed countries')
      })
    })
  })

  describe('File Path Validation Rules', () => {
    describe('fileExistsRule', () => {
      it('should validate existing files', async () => {
        const testFile = path.join(tempDir, 'test.txt')
        fs.writeFileSync(testFile, 'test content')
        
        const result = await fileExistsRule.validate(testFile)
        expect(result.isValid).toBe(true)
      })

      it('should reject non-existent files', async () => {
        const result = await fileExistsRule.validate('/non/existent/file.txt')
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('File not found')
        expect(result.suggestions).toContain('Check the file path')
      })
    })

    describe('noDirectoryTraversalRule', () => {
      it('should detect directory traversal attempts', () => {
        const maliciousPaths = [
          '../../../etc/passwd',
          '..\\..\\windows\\system32',
          '/tmp/../../../etc/shadow',
          'valid/../../../../../../etc/hosts'
        ]
        
        for (const path of maliciousPaths) {
          const result = noDirectoryTraversalRule.validate(path)
          expect(result.isValid).toBe(false)
          expect(result.error).toContain('Directory traversal')
        }
      })

      it('should allow safe paths', () => {
        const safePaths = [
          '/tmp/test.txt',
          './local/file.json',
          'relative/path/file.csv',
          '/absolute/path/to/file.xml'
        ]
        
        for (const path of safePaths) {
          const result = noDirectoryTraversalRule.validate(path)
          expect(result.isValid).toBe(true)
        }
      })
    })

    describe('createFilePathRule', () => {
      it('should validate file extensions', async () => {
        const jsonOnlyRule = createFilePathRule({
          allowedExtensions: ['json'],
          mustExist: false
        })
        
        expect(jsonOnlyRule.validate('test.json').isValid).toBe(true)
        expect(jsonOnlyRule.validate('test.txt').isValid).toBe(false)
      })

      it('should check write permissions', async () => {
        const writeRule = createFilePathRule({
          requireWritable: true
        })
        
        const readOnlyFile = path.join(tempDir, 'readonly.txt')
        fs.writeFileSync(readOnlyFile, 'content')
        fs.chmodSync(readOnlyFile, 0o444) // Read-only
        
        const result = await writeRule.validate(readOnlyFile)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('write permission')
      })
    })
  })

  describe('URL Validation Rules', () => {
    describe('urlFormatRule', () => {
      it('should validate URL formats', () => {
        const validUrls = [
          'https://example.com',
          'http://localhost:3000',
          'https://api.example.com/webhook',
          'https://sub.domain.example.com:8080/path'
        ]
        
        for (const url of validUrls) {
          const result = urlFormatRule.validate(url)
          expect(result.isValid).toBe(true)
          expect(result.sanitizedValue).toBe(url)
        }
      })

      it('should reject invalid URLs', () => {
        const invalidUrls = [
          'not-a-url',
          'ftp://example.com', // Will pass format but fail http protocol
          'example.com',       // Missing protocol
          'http://',          // Incomplete
          ''                  // Empty
        ]
        
        for (const url of invalidUrls) {
          const result = urlFormatRule.validate(url)
          expect(result.isValid).toBe(false)
        }
      })
    })

    describe('httpsOnlyRule', () => {
      it('should enforce HTTPS for external URLs', () => {
        const externalHttp = 'http://api.example.com/webhook'
        const result = httpsOnlyRule.validate(externalHttp)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('HTTPS is required')
      })

      it('should allow HTTP for localhost', () => {
        const localhostUrls = [
          'http://localhost:3000',
          'http://127.0.0.1:8080',
          'http://192.168.1.100:4000',
          'http://10.0.0.1:5000'
        ]
        
        for (const url of localhostUrls) {
          const result = httpsOnlyRule.validate(url)
          expect(result.isValid).toBe(true)
        }
      })
    })

    describe('webhookUrlRule', () => {
      it('should require specific path for webhooks', () => {
        const noPath = 'https://api.example.com/'
        const result = webhookUrlRule.validate(noPath)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('specific path')
      })

      it('should detect credentials in URL', () => {
        const withCreds = 'https://user:pass@api.example.com/webhook'
        const result = webhookUrlRule.validate(withCreds)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('should not contain credentials')
      })
    })
  })

  describe('Numeric Validation Rules', () => {
    describe('integerRule', () => {
      it('should validate integers', () => {
        const validIntegers = [0, 1, -1, 100, 999999]
        
        for (const num of validIntegers) {
          const result = integerRule.validate(num)
          expect(result.isValid).toBe(true)
        }
      })

      it('should reject non-integers', () => {
        const invalidValues = [1.5, '10', null, undefined, NaN, Infinity]
        
        for (const value of invalidValues) {
          const result = integerRule.validate(value)
          expect(result.isValid).toBe(false)
        }
      })
    })

    describe('portRule', () => {
      it('should validate port numbers', () => {
        const validPorts = [1024, 3000, 4001, 8080, 65535]
        
        for (const port of validPorts) {
          const result = portRule.validate(port)
          expect(result.isValid).toBe(true)
        }
      })

      it('should reject invalid ports with suggestions', () => {
        const invalidPorts = [
          { port: 0, error: 'Reserved system port' },
          { port: 80, error: 'Reserved system port' },
          { port: 443, error: 'Reserved system port' },
          { port: 70000, error: 'exceeds maximum' },
          { port: -1, error: 'must be positive' }
        ]
        
        for (const { port, error } of invalidPorts) {
          const result = portRule.validate(port)
          expect(result.isValid).toBe(false)
          expect(result.error).toContain(error)
          expect(result.suggestions?.length).toBeGreaterThan(0)
        }
      })

      it('should parse string ports', () => {
        const result = portRule.validate('4001')
        expect(result.isValid).toBe(true)
        expect(result.sanitizedValue).toBe(4001)
      })
    })

    describe('createIntegerRule', () => {
      it('should create custom range validators', () => {
        const percentRule = createIntegerRule({ min: 0, max: 100 })
        
        expect(percentRule.validate(50).isValid).toBe(true)
        expect(percentRule.validate(-1).isValid).toBe(false)
        expect(percentRule.validate(101).isValid).toBe(false)
      })
    })
  })

  describe('String Validation Rules', () => {
    describe('nonEmptyStringRule', () => {
      it('should validate non-empty strings', () => {
        const result = nonEmptyStringRule.validate('  test  ')
        expect(result.isValid).toBe(true)
        expect(result.sanitizedValue).toBe('test') // Trimmed
      })

      it('should reject empty strings', () => {
        const emptyValues = ['', '   ', '\t', '\n']
        
        for (const value of emptyValues) {
          const result = nonEmptyStringRule.validate(value)
          expect(result.isValid).toBe(false)
        }
      })
    })

    describe('safeFilenameRule', () => {
      it('should validate safe filenames', () => {
        const validNames = [
          'test.txt',
          'my-file-name.json',
          'data_export_2024.csv',
          'file123.xml'
        ]
        
        for (const name of validNames) {
          const result = safeFilenameRule.validate(name)
          expect(result.isValid).toBe(true)
        }
      })

      it('should reject unsafe filenames', () => {
        const unsafeNames = [
          'file<name>.txt',    // Invalid characters
          'CON.txt',           // Reserved name
          'PRN',               // Reserved name
          '../etc/passwd',     // Path traversal
          'a'.repeat(256)      // Too long
        ]
        
        for (const name of unsafeNames) {
          const result = safeFilenameRule.validate(name)
          expect(result.isValid).toBe(false)
        }
      })
    })

    describe('uuidRule', () => {
      it('should validate UUID v4 format', () => {
        const validUuids = [
          '123e4567-e89b-42d3-a456-426614174000',
          'A1B2C3D4-E5F6-4789-8ABC-DEF012345678'
        ]
        
        for (const uuid of validUuids) {
          const result = uuidRule.validate(uuid)
          expect(result.isValid).toBe(true)
          expect(result.sanitizedValue).toBe(uuid.toLowerCase())
        }
      })
    })

    describe('simpleIdRule', () => {
      it('should validate simple ID formats', () => {
        const validIds = ['user-123', 'flow_abc', 'test-id-01', 'abc123']
        
        for (const id of validIds) {
          const result = simpleIdRule.validate(id)
          expect(result.isValid).toBe(true)
        }
      })

      it('should reject complex IDs', () => {
        const invalidIds = [
          'id with spaces',
          'id!@#$%',
          '',
          'a'.repeat(65) // Too long
        ]
        
        for (const id of invalidIds) {
          const result = simpleIdRule.validate(id)
          expect(result.isValid).toBe(false)
        }
      })
    })
  })

  describe('Date Validation Rules', () => {
    describe('iso8601DateRule', () => {
      it('should validate ISO 8601 dates', () => {
        const validDates = [
          '2024-01-15T10:00:00Z',
          '2024-01-15T10:00:00.000Z',
          '2024-01-15T10:00:00+00:00',
          '2024-01-15T10:00:00-05:00'
        ]
        
        for (const date of validDates) {
          const result = iso8601DateRule.validate(date)
          expect(result.isValid).toBe(true)
          expect(result.sanitizedValue).toBeInstanceOf(Date)
        }
      })

      it('should reject invalid date formats', () => {
        const invalidDates = [
          '01/15/2024',           // US format
          '15-01-2024',           // EU format
          '2024-01-15',           // Date only (no time)
          'January 15, 2024',     // Text format
          'not-a-date'
        ]
        
        for (const date of invalidDates) {
          const result = iso8601DateRule.validate(date)
          expect(result.isValid).toBe(false)
          expect(result.suggestions).toContain('Use ISO 8601 format')
        }
      })
    })

    describe('dateRangeRule', () => {
      it('should validate date ranges', () => {
        const rule = dateRangeRule('fromDate', 'toDate')
        const validRange = {
          fromDate: new Date('2024-01-01'),
          toDate: new Date('2024-12-31')
        }
        
        const result = rule.validate(validRange)
        expect(result.isValid).toBe(true)
      })

      it('should reject invalid ranges', () => {
        const rule = dateRangeRule('fromDate', 'toDate')
        const invalidRange = {
          fromDate: new Date('2024-12-31'),
          toDate: new Date('2024-01-01')
        }
        
        const result = rule.validate(invalidRange)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('must be before')
      })
    })
  })

  describe('Enum Validation Rules', () => {
    describe('Command-specific enum rules', () => {
      it('should validate export formats', () => {
        expect(exportFormatRule.validate('json').isValid).toBe(true)
        expect(exportFormatRule.validate('csv').isValid).toBe(true)
        expect(exportFormatRule.validate('xml').isValid).toBe(false)
      })

      it('should validate export types', () => {
        expect(exportTypeRule.validate('messages').isValid).toBe(true)
        expect(exportTypeRule.validate('conversations').isValid).toBe(true)
        expect(exportTypeRule.validate('users').isValid).toBe(false)
      })

      it('should provide suggestions for invalid values', () => {
        const result = mockPhoneActionRule.validate('update')
        expect(result.isValid).toBe(false)
        expect(result.suggestions).toContain('Must be one of: create, list, delete')
      })
    })

    describe('createEnumRule', () => {
      it('should create custom enum validators', () => {
        const statusRule = createEnumRule({
          values: ['active', 'inactive', 'pending'],
          name: 'status'
        })
        
        expect(statusRule.validate('active').isValid).toBe(true)
        expect(statusRule.validate('deleted').isValid).toBe(false)
      })

      it('should handle case sensitivity options', () => {
        const caseInsensitiveRule = createEnumRule({
          values: ['GET', 'POST', 'PUT'],
          name: 'method',
          caseInsensitive: true
        })
        
        expect(caseInsensitiveRule.validate('get').isValid).toBe(true)
        expect(caseInsensitiveRule.validate('Get').isValid).toBe(true)
      })
    })
  })

  describe('JSON Validation Rules', () => {
    describe('jsonParseRule', () => {
      it('should parse valid JSON', () => {
        const validJson = '{"name": "test", "value": 123}'
        const result = jsonParseRule.validate(validJson)
        expect(result.isValid).toBe(true)
        expect(result.sanitizedValue).toEqual({ name: 'test', value: 123 })
      })

      it('should provide specific error messages', () => {
        const invalidJsonCases = [
          {
            json: '{"name": "test",}', // Trailing comma
            expectedSuggestion: 'Remove trailing commas'
          },
          {
            json: "{'name': 'test'}", // Single quotes
            expectedSuggestion: 'Ensure all strings are in double quotes'
          },
          {
            json: '{"name": "test"', // Missing closing brace
            expectedSuggestion: 'check for missing closing brackets'
          }
        ]
        
        for (const { json, expectedSuggestion } of invalidJsonCases) {
          const result = jsonParseRule.validate(json)
          expect(result.isValid).toBe(false)
          expect(result.suggestions?.some(s => s.includes(expectedSuggestion))).toBe(true)
        }
      })
    })

    describe('flowJsonSchemaRule', () => {
      it('should validate flow JSON structure', () => {
        const validFlow = {
          name: 'Test Flow',
          triggers: [{ type: 'keyword', value: 'hello' }],
          steps: [
            { type: 'message', content: 'Hello!' },
            { type: 'delay', duration: 1000 }
          ]
        }
        
        const result = flowJsonSchemaRule.validate(validFlow)
        expect(result.isValid).toBe(true)
      })

      it('should validate step structure', () => {
        const invalidFlow = {
          name: 'Test Flow',
          triggers: [],
          steps: [{ content: 'Missing type field' }]
        }
        
        const result = flowJsonSchemaRule.validate(invalidFlow)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('missing type property')
      })
    })

    describe('configJsonSchemaRule', () => {
      it('should validate configuration JSON', () => {
        const validConfig = {
          apiPort: 4001,
          uiPort: 4000,
          webhookUrl: 'https://api.example.com/webhook',
          cors: {
            enabled: true,
            origins: ['*']
          }
        }
        
        const result = configJsonSchemaRule.validate(validConfig)
        expect(result.isValid).toBe(true)
      })

      it('should validate nested CORS configuration', () => {
        const invalidCors = {
          cors: {
            enabled: 'yes', // Should be boolean
            origins: '*'     // Should be array
          }
        }
        
        const result = configJsonSchemaRule.validate(invalidCors)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('enabled property must be a boolean')
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined values gracefully', () => {
      const rules = [
        nonEmptyStringRule,
        integerRule,
        urlFormatRule,
        jsonParseRule
      ]
      
      for (const rule of rules) {
        const nullResult = rule.validate(null as any)
        expect(nullResult.isValid).toBe(false)
        expect(nullResult.error).toBeDefined()
        
        const undefinedResult = rule.validate(undefined as any)
        expect(undefinedResult.isValid).toBe(false)
        expect(undefinedResult.error).toBeDefined()
      }
    })

    it('should provide consistent error message format', () => {
      const testCases = [
        { rule: portRule, value: 0 },
        { rule: urlFormatRule, value: 'invalid' },
        { rule: iso8601DateRule, value: 'invalid' }
      ]
      
      for (const { rule, value } of testCases) {
        const result = rule.validate(value)
        expect(result.isValid).toBe(false)
        expect(result.error).toBeTruthy()
        expect(Array.isArray(result.suggestions)).toBe(true)
        expect(result.suggestions!.length).toBeGreaterThan(0)
      }
    })
  })
})
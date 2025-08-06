/**
 * File path validation rules for SMS-Dev CLI
 * Includes security checks for directory traversal and file system operations
 */

import fs from 'fs'
import path from 'path'
import { ValidationRule, ValidationResult } from '../types.js'

/**
 * Validates that a file path exists and is readable
 */
export const fileExistsRule: ValidationRule<string> = {
  name: 'file_exists',
  async: true,
  priority: 100,
  validate: async (value: string): Promise<ValidationResult> => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'File path must be a string',
        suggestions: ['Provide a valid file path as a string']
      }
    }

    const cleanPath = path.resolve(value.trim())

    try {
      const stats = await fs.promises.stat(cleanPath)
      
      if (!stats.isFile()) {
        return {
          isValid: false,
          error: `Path exists but is not a file: ${value}`,
          suggestions: [
            'Provide a path to a file, not a directory',
            'Check that the path points to an existing file'
          ]
        }
      }

      return {
        isValid: true,
        sanitizedValue: cleanPath
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          isValid: false,
          error: `File does not exist: ${value}`,
          suggestions: [
            'Check the file path for typos',
            'Ensure the file exists at the specified location',
            'Use an absolute path if using relative paths'
          ]
        }
      } else if (error.code === 'EACCES') {
        return {
          isValid: false,
          error: `Permission denied accessing file: ${value}`,
          suggestions: [
            'Check file permissions',
            'Run with appropriate user permissions',
            'Ensure you have read access to the file'
          ]
        }
      } else {
        return {
          isValid: false,
          error: `Error accessing file: ${error.message}`,
          suggestions: [
            'Check the file path is valid',
            'Ensure the file system is accessible'
          ]
        }
      }
    }
  }
}

/**
 * Validates that a directory path exists and is writable
 */
export const directoryWritableRule: ValidationRule<string> = {
  name: 'directory_writable',
  async: true,
  priority: 90,
  validate: async (value: string): Promise<ValidationResult> => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Directory path must be a string',
        suggestions: ['Provide a valid directory path as a string']
      }
    }

    const cleanPath = path.resolve(value.trim())

    try {
      const stats = await fs.promises.stat(cleanPath)
      
      if (!stats.isDirectory()) {
        return {
          isValid: false,
          error: `Path exists but is not a directory: ${value}`,
          suggestions: [
            'Provide a path to a directory, not a file',
            'Create the directory if it doesn\'t exist'
          ]
        }
      }

      // Test write permissions
      try {
        await fs.promises.access(cleanPath, fs.constants.W_OK)
        return {
          isValid: true,
          sanitizedValue: cleanPath
        }
      } catch {
        return {
          isValid: false,
          error: `Directory is not writable: ${value}`,
          suggestions: [
            'Check directory permissions',
            'Run with appropriate user permissions',
            'Ensure you have write access to the directory'
          ]
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          isValid: false,
          error: `Directory does not exist: ${value}`,
          suggestions: [
            'Create the directory first',
            'Check the directory path for typos',
            'Use an absolute path if using relative paths'
          ]
        }
      } else {
        return {
          isValid: false,
          error: `Error accessing directory: ${error.message}`,
          suggestions: [
            'Check the directory path is valid',
            'Ensure the file system is accessible'
          ]
        }
      }
    }
  }
}

/**
 * Security check to prevent directory traversal attacks
 */
export const noDirectoryTraversalRule: ValidationRule<string> = {
  name: 'no_directory_traversal',
  priority: 200, // High priority security check
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Path must be a string',
        suggestions: ['Provide a valid path as a string']
      }
    }

    const cleanPath = value.trim()
    
    // Check for directory traversal patterns
    const dangerousPatterns = [
      '../',
      '..\\',
      '..\\/',
      '\\..\\',
      '\\..',
      '%2e%2e',
      '%252e%252e',
      '..%2f',
      '..%5c',
      '..%255c'
    ]

    const lowerPath = cleanPath.toLowerCase()
    const foundPattern = dangerousPatterns.find(pattern => lowerPath.includes(pattern))

    if (foundPattern) {
      return {
        isValid: false,
        error: `Potential directory traversal detected: ${value}`,
        errorContext: `Found pattern: ${foundPattern}`,
        suggestions: [
          'Use absolute paths instead of relative paths',
          'Avoid using .. in file paths',
          'Specify files within the allowed directories only'
        ]
      }
    }

    // Additional check for absolute path traversal
    const resolved = path.resolve(cleanPath)
    const cwd = process.cwd()
    
    // Allow paths within current working directory and common system paths
    const allowedPrefixes = [
      cwd,
      '/tmp',
      '/var/tmp',
      path.join(cwd, 'exports'),
      path.join(cwd, 'configs'),
      path.join(cwd, 'flows')
    ]

    const isAllowed = allowedPrefixes.some(prefix => resolved.startsWith(prefix))

    if (!isAllowed && path.isAbsolute(resolved)) {
      return {
        isValid: false,
        error: `Path is outside allowed directories: ${value}`,
        suggestions: [
          'Use paths within the current project directory',
          'Use relative paths for local files',
          'Specify allowed absolute paths in configuration'
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: cleanPath
    }
  }
}

/**
 * Validates file extension
 */
export const fileExtensionRule = (allowedExtensions: string[]): ValidationRule<string> => ({
  name: 'file_extension',
  priority: 80,
  validate: (value: string): ValidationResult => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'File path must be a string',
        suggestions: ['Provide a valid file path as a string']
      }
    }

    const cleanPath = value.trim()
    const extension = path.extname(cleanPath).toLowerCase()
    const normalizedAllowed = allowedExtensions.map(ext => 
      ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
    )

    if (!normalizedAllowed.includes(extension)) {
      return {
        isValid: false,
        error: `Invalid file extension: ${extension || '(no extension)'}`,
        suggestions: [
          `Allowed extensions: ${normalizedAllowed.join(', ')}`,
          `Add the correct extension to your file: ${cleanPath}${normalizedAllowed[0]}`
        ]
      }
    }

    return {
      isValid: true,
      sanitizedValue: cleanPath
    }
  }
})

/**
 * Validates that output file can be created (directory exists and is writable)
 */
export const outputFileRule: ValidationRule<string> = {
  name: 'output_file',
  async: true,
  priority: 85,
  validate: async (value: string): Promise<ValidationResult> => {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Output file path must be a string',
        suggestions: ['Provide a valid file path as a string']
      }
    }

    const cleanPath = path.resolve(value.trim())
    const directory = path.dirname(cleanPath)

    // Check if directory exists or can be created
    try {
      await fs.promises.access(directory, fs.constants.F_OK)
      
      // Directory exists, check if it's writable
      try {
        await fs.promises.access(directory, fs.constants.W_OK)
      } catch {
        return {
          isValid: false,
          error: `Output directory is not writable: ${directory}`,
          suggestions: [
            'Check directory permissions',
            'Choose a different output directory',
            'Run with appropriate user permissions'
          ]
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist - check if parent exists and is writable
        const parentDir = path.dirname(directory)
        try {
          await fs.promises.access(parentDir, fs.constants.W_OK)
          // Parent is writable, we can create the directory
        } catch {
          return {
            isValid: false,
            error: `Cannot create output directory: ${directory}`,
            suggestions: [
              'Create the directory manually first',
              'Choose an existing directory',
              'Check parent directory permissions'
            ]
          }
        }
      }
    }

    // Check if file already exists and warn
    try {
      await fs.promises.access(cleanPath, fs.constants.F_OK)
      return {
        isValid: true,
        sanitizedValue: cleanPath,
        errorContext: 'File already exists and will be overwritten'
      }
    } catch {
      // File doesn't exist, which is fine for output
      return {
        isValid: true,
        sanitizedValue: cleanPath
      }
    }
  }
}

/**
 * Factory function to create a comprehensive file path validator
 */
export function createFilePathRule(options: {
  mustExist?: boolean
  allowedExtensions?: string[]
  requireWritable?: boolean
  securityCheck?: boolean
}): ValidationRule<string> {
  return {
    name: 'comprehensive_file_path',
    async: options.mustExist || options.requireWritable,
    priority: 95,
    validate: async (value: string): Promise<ValidationResult> => {
      // Security check first
      if (options.securityCheck !== false) {
        const securityResult = noDirectoryTraversalRule.validate(value)
        if (!securityResult.isValid) {
          return securityResult
        }
      }

      // Extension check
      if (options.allowedExtensions && options.allowedExtensions.length > 0) {
        const extensionResult = fileExtensionRule(options.allowedExtensions).validate(value)
        if (!extensionResult.isValid) {
          return extensionResult
        }
      }

      // Existence check
      if (options.mustExist) {
        const existsResult = await fileExistsRule.validate(value)
        if (!existsResult.isValid) {
          return existsResult
        }
      }

      // Writable check (for output files)
      if (options.requireWritable) {
        const writableResult = await outputFileRule.validate(value)
        if (!writableResult.isValid) {
          return writableResult
        }
      }

      return {
        isValid: true,
        sanitizedValue: path.resolve(value.trim())
      }
    }
  }
}
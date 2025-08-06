import chalk from 'chalk'
import ora, { Ora } from 'ora'
import { ApiError, CliError, ValidationError } from '../../types/errors.js'

/**
 * Options that all commands receive
 */
export interface CommandOptions {
  verbose?: boolean
  apiUrl?: string
  [key: string]: any
}

/**
 * Base abstract class for all CLI commands
 */
export abstract class BaseCommand {
  abstract readonly name: string
  abstract readonly description: string
  
  protected spinner?: Ora
  protected verbose: boolean = false
  protected apiUrl: string = 'http://localhost:4001'
  
  constructor() {}
  
  /**
   * Initialize the command with options
   */
  initialize(options: CommandOptions): void {
    this.verbose = options.verbose || false
    this.apiUrl = options.apiUrl || this.apiUrl
    
    if (this.verbose) {
      console.log(chalk.gray(`[DEBUG] Initializing ${this.name} command`))
      console.log(chalk.gray(`[DEBUG] API URL: ${this.apiUrl}`))
    }
  }
  
  /**
   * Execute the command - must be implemented by subclasses
   */
  abstract execute(options: CommandOptions): Promise<void>
  
  /**
   * Show a loading spinner with message
   */
  protected startSpinner(message: string): void {
    if (!this.verbose) {
      this.spinner = ora(message).start()
    } else {
      console.log(chalk.blue(`⏳ ${message}...`))
    }
  }
  
  /**
   * Stop the spinner with success message
   */
  protected stopSpinner(message?: string): void {
    if (this.spinner) {
      if (message) {
        this.spinner.succeed(message)
      } else {
        this.spinner.stop()
      }
      this.spinner = undefined
    } else if (message && this.verbose) {
      console.log(chalk.green(`✅ ${message}`))
    }
  }
  
  /**
   * Stop the spinner with failure message
   */
  protected failSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.fail(message)
      this.spinner = undefined
    } else {
      console.log(chalk.red(`❌ ${message}`))
    }
  }
  
  /**
   * Log a verbose message (only shown when verbose is enabled)
   */
  protected logVerbose(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray(`[DEBUG] ${message}`))
    }
  }
  
  /**
   * Log an info message
   */
  protected logInfo(message: string): void {
    console.log(chalk.blue(`ℹ️ ${message}`))
  }
  
  /**
   * Log a success message
   */
  protected logSuccess(message: string): void {
    console.log(chalk.green(`✅ ${message}`))
  }
  
  /**
   * Log a warning message
   */
  protected logWarning(message: string): void {
    console.log(chalk.yellow(`⚠️ ${message}`))
  }
  
  /**
   * Log an error message
   */
  protected logError(message: string): void {
    console.log(chalk.red(`❌ ${message}`))
  }
  
  /**
   * Handle errors with appropriate logging and exit
   */
  protected handleError(error: any, context?: string): never {
    // Stop any active spinner
    if (this.spinner) {
      this.spinner.stop()
    }
    
    const contextMessage = context ? ` in ${context}` : ''
    
    if (error instanceof ApiError) {
      this.logError(`API Error${contextMessage} (${error.statusCode}): ${error.message}`)
      if (error.endpoint && this.verbose) {
        this.logVerbose(`Endpoint: ${error.endpoint}`)
      }
    } else if (error instanceof ValidationError) {
      this.logError(`Validation Error${contextMessage}: ${error.message}`)
      if (error.field) {
        this.logVerbose(`Field: ${error.field}`)
      }
    } else if (error instanceof CliError) {
      this.logError(`${error.code}${contextMessage}: ${error.message}`)
    } else if (error.name === 'AbortError') {
      this.logError(`Request timeout${contextMessage}`)
    } else {
      this.logError(`Unexpected error${contextMessage}: ${error.message || error}`)
    }
    
    if (this.verbose && error.stack) {
      console.log(chalk.gray(error.stack))
    }
    
    const exitCode = error instanceof CliError ? error.exitCode : 1
    process.exit(exitCode)
  }
  
  /**
   * Validate required options
   */
  protected validateRequiredOptions(options: CommandOptions, required: string[]): void {
    const missing = required.filter(key => !options[key])
    
    if (missing.length > 0) {
      throw new ValidationError(
        `Missing required options: ${missing.join(', ')}`
      )
    }
  }
  
  /**
   * Build full API URL for an endpoint
   */
  protected buildApiUrl(endpoint: string): string {
    return `${this.apiUrl.replace(/\/$/, '')}${endpoint}`
  }
}
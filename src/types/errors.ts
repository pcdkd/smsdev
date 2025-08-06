/**
 * Base error class for CLI operations
 */
export class CliError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

/**
 * Error for API communication issues
 */
export class ApiError extends CliError {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint?: string
  ) {
    super(message, 'API_ERROR', 1)
    this.statusCode = statusCode
    this.endpoint = endpoint
  }
}

/**
 * Error for configuration validation issues
 */
export class ValidationError extends CliError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 1)
    this.field = field
  }
}

/**
 * Error for timeout operations
 */
export class TimeoutError extends CliError {
  constructor(message: string, public timeoutMs: number) {
    super(message, 'TIMEOUT_ERROR', 1)
    this.timeoutMs = timeoutMs
  }
}

/**
 * Error for configuration issues
 */
export class ConfigurationError extends CliError {
  constructor(message: string, public configPath?: string) {
    super(message, 'CONFIGURATION_ERROR', 1)
    this.configPath = configPath
  }
}
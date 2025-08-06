import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { BaseCommand, CommandOptions } from '../base/BaseCommand.js'
import { ApiClient } from '../../services/ApiClient.js'
import { ValidationError } from '../../types/errors.js'
import { ENDPOINTS, EXPORT_FORMATS } from '../../constants.js'

/**
 * Options for the export command
 */
interface ExportOptions extends CommandOptions {
  type?: string
  format?: string
  phone?: string
  fromDate?: string
  toDate?: string
  output?: string
}

/**
 * Command to export conversation history and messages
 */
export class ExportCommand extends BaseCommand {
  readonly name = 'export'
  readonly description = 'Export conversation history'
  
  private apiClient: ApiClient

  constructor() {
    super()
    this.apiClient = new ApiClient()
  }
  
  initialize(options: ExportOptions): void {
    super.initialize(options)
    this.apiClient.setBaseUrl(this.apiUrl)
  }

  async execute(options: ExportOptions): Promise<void> {
    const exportType = options.type || 'messages'
    
    if (!['messages', 'conversations'].includes(exportType)) {
      throw new ValidationError('Export type must be "messages" or "conversations"', 'type')
    }

    // Validate format
    if (options.format && !EXPORT_FORMATS.includes(options.format as any)) {
      throw new ValidationError(
        `Invalid export format. Must be one of: ${EXPORT_FORMATS.join(', ')}`,
        'format'
      )
    }

    // Validate date formats if provided
    if (options.fromDate && !this.isValidISO8601Date(options.fromDate)) {
      throw new ValidationError('from-date must be in ISO 8601 format (e.g., 2023-12-01T00:00:00Z)', 'fromDate')
    }
    
    if (options.toDate && !this.isValidISO8601Date(options.toDate)) {
      throw new ValidationError('to-date must be in ISO 8601 format (e.g., 2023-12-31T23:59:59Z)', 'toDate')
    }

    await this.exportData(exportType as 'messages' | 'conversations', options)
  }

  /**
   * Export messages or conversations
   */
  private async exportData(type: 'messages' | 'conversations', options: ExportOptions): Promise<void> {
    try {
      this.startSpinner(`Preparing ${type} export`)
      
      // Build query parameters
      const params = new URLSearchParams()
      if (options.format) params.append('format', options.format)
      if (options.phone) params.append('phone', options.phone)
      if (options.fromDate) params.append('from_date', options.fromDate)
      if (options.toDate) params.append('to_date', options.toDate)

      const endpoint = type === 'messages' 
        ? ENDPOINTS.MESSAGES_EXPORT
        : ENDPOINTS.CONVERSATIONS_EXPORT
      
      this.logVerbose(`Exporting ${type} with params: ${params.toString()}`)
      this.logVerbose(`Using endpoint: ${endpoint}`)
      
      const response = await fetch(`${this.apiUrl}${endpoint}?${params}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || `HTTP ${response.status} ${response.statusText}`)
      }
      
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')
      
      this.stopSpinner()
      
      if (options.output) {
        await this.saveExportToFile(response, options.output, isJson)
      } else {
        await this.displayExportData(response, isJson)
      }
      
      this.logSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} export completed`)
      
      // Show export summary
      this.showExportSummary(type, options)
      
    } catch (error: any) {
      this.stopSpinner()
      this.handleError(error, `exporting ${type}`)
    }
  }

  /**
   * Save export data to a file
   */
  private async saveExportToFile(response: Response, outputPath: string, isJson: boolean): Promise<void> {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
        this.logVerbose(`Created output directory: ${outputDir}`)
      }
      
      let content: string
      if (isJson) {
        const data = await response.json()
        content = JSON.stringify(data, null, 2)
      } else {
        content = await response.text()
      }
      
      fs.writeFileSync(outputPath, content, 'utf8')
      console.log(`📄 Export saved to: ${chalk.cyan(path.resolve(outputPath))}`)
      
      // Show file size
      const stats = fs.statSync(outputPath)
      const fileSizeKB = Math.round(stats.size / 1024 * 100) / 100
      console.log(`📊 File size: ${fileSizeKB} KB`)
      
    } catch (error: any) {
      throw new Error(`Failed to save export: ${error.message}`)
    }
  }

  /**
   * Display export data to console
   */
  private async displayExportData(response: Response, isJson: boolean): Promise<void> {
    try {
      if (isJson) {
        const data = await response.json()
        console.log(JSON.stringify(data, null, 2))
      } else {
        const content = await response.text()
        console.log(content)
      }
    } catch (error: any) {
      throw new Error(`Failed to display export data: ${error.message}`)
    }
  }

  /**
   * Show export summary information
   */
  private showExportSummary(type: string, options: ExportOptions): void {
    console.log('')
    console.log(chalk.blue('📋 Export Summary:'))
    console.log(`   Type: ${type}`)
    console.log(`   Format: ${options.format || 'json'}`)
    
    if (options.phone) {
      console.log(`   Phone filter: ${options.phone}`)
    }
    
    if (options.fromDate) {
      console.log(`   From date: ${options.fromDate}`)
    }
    
    if (options.toDate) {
      console.log(`   To date: ${options.toDate}`)
    }
    
    if (this.verbose) {
      console.log(`   API URL: ${this.apiUrl}`)
    }
  }

  /**
   * Validate ISO 8601 date format
   */
  private isValidISO8601Date(dateString: string): boolean {
    try {
      const date = new Date(dateString)
      return !isNaN(date.getTime()) && dateString.includes('T')
    } catch {
      return false
    }
  }

  /**
   * Show help for export commands
   */
  private showHelp(): void {
    console.log(chalk.blue('Export conversation history commands:'))
    console.log('')
    console.log(chalk.yellow('Basic usage:'))
    console.log('  sms-dev export messages                    # Export all messages as JSON')
    console.log('  sms-dev export conversations              # Export all conversations as JSON')
    console.log('')
    console.log(chalk.yellow('Format options:'))
    console.log('  sms-dev export messages --format csv      # Export as CSV')
    console.log('  sms-dev export messages --format json     # Export as JSON (default)')
    console.log('')
    console.log(chalk.yellow('Filtering:'))
    console.log('  sms-dev export messages --phone +1234567890')
    console.log('  sms-dev export messages --from-date 2023-12-01T00:00:00Z')
    console.log('  sms-dev export messages --to-date 2023-12-31T23:59:59Z')
    console.log('')
    console.log(chalk.yellow('Save to file:'))
    console.log('  sms-dev export messages --output ./exports/messages.json')
    console.log('  sms-dev export conversations --output ./exports/conversations.csv --format csv')
    console.log('')
    console.log(chalk.yellow('Options:'))
    console.log('  [type]              Export type: messages, conversations (default: messages)')
    console.log('  --format <format>   Export format: json, csv (default: json)')
    console.log('  --phone <number>    Filter by phone number')
    console.log('  --from-date <date>  Start date (ISO 8601 format)')
    console.log('  --to-date <date>    End date (ISO 8601 format)')
    console.log('  --output <file>     Output file path (prints to console if not specified)')
    console.log('')
    console.log(chalk.yellow('Date format examples:'))
    console.log('  2023-12-01T00:00:00Z         # UTC midnight on Dec 1, 2023')
    console.log('  2023-12-31T23:59:59-05:00    # End of Dec 31, 2023 EST')
    console.log('  2023-11-15T10:30:00.000Z     # With milliseconds')
  }
}
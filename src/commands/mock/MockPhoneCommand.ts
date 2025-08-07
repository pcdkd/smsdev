import chalk from 'chalk'
import { BaseCommand, CommandOptions } from '../base/BaseCommand.js'
import { ApiClient } from '../../services/ApiClient.js'
import { ValidationError } from '../../types/errors.js'
import { ENDPOINTS, MOCK_PHONE_TYPES } from '../../constants.js'
import { MockPhone, MockPhonesResponse } from '../../types/api.js'
import { CLIValidator } from '../../validation/index.js'

/**
 * Options for the mock-phone command
 */
interface MockPhoneOptions extends CommandOptions {
  action?: string
  phone?: string
  name?: string
  type?: string
}

/**
 * Command to manage mock phone numbers
 */
export class MockPhoneCommand extends BaseCommand {
  readonly name = 'mock-phone'
  readonly description = 'Mock phone number management'
  
  private apiClient: ApiClient

  constructor() {
    super()
    this.apiClient = new ApiClient()
  }
  
  initialize(options: MockPhoneOptions): void {
    super.initialize(options)
    this.apiClient.setBaseUrl(this.apiUrl)
  }

  async execute(options: MockPhoneOptions): Promise<void> {
    // Simple validation for phone commands
    if (options.phone && (options.action === 'create' || options.action === 'delete')) {
      this.validatePhoneNumber(options.phone, true)
    }
    
    const action = options.action

    switch (action) {
      case 'create':
        await this.createMockPhone(options)
        break
      case 'list':
        await this.listMockPhones()
        break
      case 'delete':
        await this.deleteMockPhone(options)
        break
      default:
        this.showHelp()
    }
  }

  /**
   * Create a new mock phone number
   */
  private async createMockPhone(options: MockPhoneOptions): Promise<void> {
    // Conditional validation for create action
    if (!options.phone) {
      throw new ValidationError('Phone number is required for create action', 'phone')
    }
    
    // Additional validation for phone number format
    const sanitizedPhone = this.validatePhoneNumber(options.phone, false)
    
    // Name validation if provided - simple validation for local dev
    if (options.name && (options.name.length < 1 || options.name.length > 100)) {
      throw new ValidationError('Name must be between 1 and 100 characters', 'name')
    }

    try {
      this.startSpinner('Creating mock phone')
      
      const phone = await this.apiClient.post<MockPhone>(ENDPOINTS.MOCK_PHONES, {
        phone: sanitizedPhone,
        name: options.name,
        type: options.type || 'test',
        capabilities: { sms: true }
      })
      
      this.stopSpinner()
      this.logSuccess('Mock phone created:')
      console.log(`📱 ${phone.phone} (${phone.name || 'Unnamed'}) - ${phone.type}`)
    } catch (error: any) {
      this.stopSpinner()
      this.handleError(error, 'creating mock phone')
    }
  }

  /**
   * List all mock phone numbers
   */
  private async listMockPhones(): Promise<void> {
    try {
      this.startSpinner('Fetching mock phones')
      
      const { phones } = await this.apiClient.get<MockPhonesResponse>(ENDPOINTS.MOCK_PHONES)
      
      this.stopSpinner()
      
      if (phones.length === 0) {
        console.log('📱 No mock phones found')
      } else {
        console.log(`📱 Mock Phones (${phones.length}):`)
        phones.forEach((phone: MockPhone) => {
          console.log(`  ${phone.phone} - ${phone.name || 'Unnamed'} (${phone.type})`)
        })
      }
    } catch (error: any) {
      this.stopSpinner()
      this.handleError(error, 'listing mock phones')
    }
  }

  /**
   * Delete a mock phone number
   */
  private async deleteMockPhone(options: MockPhoneOptions): Promise<void> {
    // Conditional validation for delete action
    if (!options.phone) {
      throw new ValidationError('Phone number is required for delete action', 'phone')
    }
    
    // Validate and sanitize phone number
    const sanitizedPhone = await this.validatePhoneNumber(options.phone, false)

    try {
      this.startSpinner('Finding mock phone')
      
      // First find the phone ID
      const { phones } = await this.apiClient.get<MockPhonesResponse>(ENDPOINTS.MOCK_PHONES)
      const phone = phones.find((p: MockPhone) => p.phone === sanitizedPhone)
      
      if (!phone) {
        throw new ValidationError(`Mock phone ${sanitizedPhone} not found`)
      }
      
      this.startSpinner('Deleting mock phone')
      
      await this.apiClient.delete(`${ENDPOINTS.MOCK_PHONES}/${phone.id}`)
      
      this.stopSpinner()
      this.logSuccess(`Mock phone ${sanitizedPhone} deleted`)
    } catch (error: any) {
      this.stopSpinner()
      this.handleError(error, 'deleting mock phone')
    }
  }

  /**
   * Show help for mock phone commands
   */
  private showHelp(): void {
    console.log(chalk.blue('Mock phone management commands:'))
    console.log('  sms-dev mock-phone create --phone +1234567890 --name "Test User"')
    console.log('  sms-dev mock-phone list')
    console.log('  sms-dev mock-phone delete --phone +1234567890')
    console.log('')
    console.log(chalk.yellow('Options:'))
    console.log('  --phone <number>   Phone number (required for create/delete)')
    console.log('  --name <name>      Contact name (optional for create)')
    console.log('  --type <type>      Phone type: business, personal, test (default: test)')
  }
}
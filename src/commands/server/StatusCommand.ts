import { BaseCommand, CommandOptions } from '../base/BaseCommand.js'
import { showStatus } from '../status.js'

/**
 * Command to check SMS-Dev server status
 */
export class StatusCommand extends BaseCommand {
  readonly name = 'status'
  readonly description = 'Check sms-dev server status'

  async execute(options: CommandOptions): Promise<void> {
    try {
      await showStatus()
    } catch (error: any) {
      this.handleError(error, 'checking server status')
    }
  }
}
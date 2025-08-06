import { BaseCommand, CommandOptions } from '../base/BaseCommand.js'
import { stopSmsDevServer } from '../stop.js'

/**
 * Command to stop the SMS-Dev server
 */
export class StopCommand extends BaseCommand {
  readonly name = 'stop'
  readonly description = 'Stop the sms-dev server'

  async execute(options: CommandOptions): Promise<void> {
    this.startSpinner('Stopping sms-dev server')
    
    try {
      await stopSmsDevServer()
      this.stopSpinner('sms-dev server stopped')
    } catch (error: any) {
      this.failSpinner('Failed to stop sms-dev server')
      this.handleError(error, 'stopping server')
    }
  }
}
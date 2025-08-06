import chalk from 'chalk'
import { BaseCommand, CommandOptions } from '../base/BaseCommand.js'
import { startSmsDevServer } from '../start.js'
import { loadConfig, printConfig } from '../../utils/config.js'

/**
 * Options for the start command
 */
interface StartOptions extends CommandOptions {
  config?: string
  apiPort?: string
  uiPort?: string
  ui?: boolean
  webhookUrl?: string
  verbose?: boolean
  showConfig?: boolean
}

/**
 * Command to start the SMS-Dev server (API + UI)
 */
export class StartCommand extends BaseCommand {
  readonly name = 'start'
  readonly description = 'Start the sms-dev server (API + UI)'

  async execute(options: StartOptions): Promise<void> {
    try {
      // Load configuration from all sources
      const config = loadConfig({
        configFile: options.config,
        apiPort: options.apiPort ? parseInt(options.apiPort) : undefined,
        uiPort: options.uiPort ? parseInt(options.uiPort) : undefined,
        webhookUrl: options.webhookUrl,
        startUI: options.ui !== false,
        verbose: options.verbose || false
      })

      // Show config and exit if requested
      if (options.showConfig) {
        printConfig(config)
        return
      }

      this.startSpinner('Starting sms-dev server')
      
      await startSmsDevServer({
        apiPort: config.apiPort,
        uiPort: config.uiPort,
        startUI: config.startUI,
        webhookUrl: config.webhookUrl,
        verbose: config.verbose
      })
      
      this.stopSpinner('sms-dev server started successfully!')
      
      // Show server information
      this.showServerInfo(config.apiPort, config.uiPort, config.startUI)
      
    } catch (error: any) {
      this.handleError(error, 'starting server')
    }
  }
  
  /**
   * Display server information and quick start guide
   */
  private showServerInfo(apiPort: number, uiPort: number, startUI: boolean): void {
    console.log('')
    console.log(chalk.blue('📡 API Server:'), `http://localhost:${apiPort}`)
    if (startUI) {
      console.log(chalk.blue('📱 Virtual Phone UI:'), `http://localhost:${uiPort}`)
    }
    console.log('')
    console.log(chalk.yellow('💡 Quick Start:'))
    console.log('  1. Point your SDK to:', chalk.cyan(`http://localhost:${apiPort}`))
    if (startUI) {
      console.log('  2. Open Virtual Phone:', chalk.cyan(`http://localhost:${uiPort}`))
      console.log('  3. Send test messages and see them in the UI!')
    }
    console.log('')
    console.log(chalk.gray('Press Ctrl+C to stop'))
  }
}
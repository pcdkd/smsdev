import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { BaseCommand, CommandOptions } from '../base/BaseCommand.js'
import { generateSampleConfig } from '../../utils/config.js'
import { DEFAULT_PORTS } from '../../constants.js'

/**
 * Options for the init command
 */
interface InitOptions extends CommandOptions {
  force?: boolean
  json?: boolean
}

/**
 * Command to generate a sample configuration file
 */
export class InitCommand extends BaseCommand {
  readonly name = 'init'
  readonly description = 'Generate a sample configuration file'

  async execute(options: InitOptions): Promise<void> {
    const configFileName = options.json ? 'sms-dev.config.json' : 'sms-dev.config.js'
    const configPath = path.join(process.cwd(), configFileName)

    // Check if file already exists
    if (fs.existsSync(configPath) && !options.force) {
      this.logWarning(`Configuration file already exists: ${configPath}`)
      console.log('Use --force to overwrite or choose a different name')
      return
    }

    try {
      let configContent: string

      if (options.json) {
        const jsonConfig = {
          apiPort: DEFAULT_PORTS.API,
          uiPort: DEFAULT_PORTS.UI,
          cors: {
            enabled: true,
            origins: ['*']
          },
          logging: {
            enabled: true,
            level: 'info'
          }
        }
        configContent = JSON.stringify(jsonConfig, null, 2)
      } else {
        configContent = generateSampleConfig()
      }

      fs.writeFileSync(configPath, configContent)
      this.logSuccess(`Created configuration file: ${configPath}`)
      
      console.log('')
      console.log(chalk.yellow('📝 Edit the file to customize your settings:'))
      console.log('  - API and UI ports')
      console.log('  - Webhook URL for testing')
      console.log('  - CORS and logging preferences')
      console.log('')
      console.log(chalk.blue('🚀 Start with your config:'), `sms-dev start`)
    } catch (error: any) {
      this.handleError(error, 'creating config file')
    }
  }
}
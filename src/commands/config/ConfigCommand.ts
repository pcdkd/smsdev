import { BaseCommand, CommandOptions } from '../base/BaseCommand.js'
import { loadConfig, printConfig } from '../../utils/config.js'

/**
 * Options for the config command
 */
interface ConfigOptions extends CommandOptions {
  config?: string
}

/**
 * Command to show current configuration
 */
export class ConfigCommand extends BaseCommand {
  readonly name = 'config'
  readonly description = 'Show current configuration'

  async execute(options: ConfigOptions): Promise<void> {
    try {
      const config = await loadConfig({
        configFile: options.config
      })
      printConfig(config)
    } catch (error: any) {
      this.handleError(error, 'loading configuration')
    }
  }
}
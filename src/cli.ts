#!/usr/bin/env node

import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import { CommandRegistry } from './commands/base/CommandRegistry.js'

// Import all commands
import { StartCommand } from './commands/server/StartCommand.js'
import { StopCommand } from './commands/server/StopCommand.js'
import { StatusCommand } from './commands/server/StatusCommand.js'
import { ConfigCommand } from './commands/config/ConfigCommand.js'
import { InitCommand } from './commands/config/InitCommand.js'
import { MockPhoneCommand } from './commands/mock/MockPhoneCommand.js'
import { FlowCommand } from './commands/flow/FlowCommand.js'
import { ExportCommand } from './commands/data/ExportCommand.js'
import { PerformanceCommand } from './commands/performance/PerformanceCommand.js'
import { stopSmsDevServer } from './commands/stop.js'

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load version from package.json
const packageJsonPath = path.join(__dirname, '../package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

// Create main program
const program = new Command()

program
  .name('sms-dev')
  .description('Local development tool for SMS applications - the Mailtrap for SMS')
  .version(packageJson.version)

// Create command registry
const registry = new CommandRegistry(program)

// Register all commands
registry.registerAll([
  // Server management commands
  {
    command: new StartCommand(),
    options: [
      { flags: '-c, --config <file>', description: 'Configuration file path' },
      { flags: '-p, --api-port <port>', description: 'API server port' },
      { flags: '-u, --ui-port <port>', description: 'UI server port' },
      { flags: '--no-ui', description: 'Start only the API server' },
      { flags: '--webhook-url <url>', description: 'Webhook URL for testing' },
      { flags: '--show-config', description: 'Show resolved configuration and exit' }
    ]
  },
  {
    command: new StopCommand()
  },
  {
    command: new StatusCommand()
  },
  
  // Configuration commands
  {
    command: new ConfigCommand(),
    options: [
      { flags: '-c, --config <file>', description: 'Configuration file path' }
    ]
  },
  {
    command: new InitCommand(),
    options: [
      { flags: '-f, --force', description: 'Overwrite existing configuration file' },
      { flags: '--json', description: 'Generate JSON configuration instead of JavaScript' }
    ]
  },

  // Mock phone management
  {
    command: new MockPhoneCommand(),
    arguments: [
      { name: 'action', description: 'Action: create, list, delete', required: false }
    ],
    options: [
      { flags: '--phone <number>', description: 'Phone number' },
      { flags: '--name <name>', description: 'Contact name' },
      { flags: '--type <type>', description: 'Phone type: business, personal, test', defaultValue: 'test' }
    ]
  },

  // Conversation flow management
  {
    command: new FlowCommand(),
    arguments: [
      { name: 'action', description: 'Action: create, list, execute', required: false }
    ],
    options: [
      { flags: '--name <name>', description: 'Flow name' },
      { flags: '--file <file>', description: 'Flow definition file (JSON)' },
      { flags: '--flow-id <id>', description: 'Flow ID for execution' },
      { flags: '--phone <number>', description: 'Target phone number for execution' }
    ]
  },

  // Data export
  {
    command: new ExportCommand(),
    arguments: [
      { name: 'type', description: 'Export type: messages, conversations', required: false }
    ],
    options: [
      { flags: '--format <format>', description: 'Export format: json, csv', defaultValue: 'json' },
      { flags: '--phone <number>', description: 'Filter by phone number' },
      { flags: '--from-date <date>', description: 'Start date (ISO 8601)' },
      { flags: '--to-date <date>', description: 'End date (ISO 8601)' },
      { flags: '--output <file>', description: 'Output file path' }
    ]
  },

  // Performance testing
  {
    command: new PerformanceCommand(),
    arguments: [
      { name: 'action', description: 'Action: stats, load-test', required: false }
    ],
    options: [
      { flags: '--messages <count>', description: 'Number of messages for load test', defaultValue: '100' },
      { flags: '--users <count>', description: 'Concurrent users for load test', defaultValue: '5' },
      { flags: '--duration <seconds>', description: 'Test duration in seconds', defaultValue: '30' }
    ]
  }
])

// Add docs command (simple command, no need to extract)
program
  .command('docs')
  .description('Open sms-dev documentation')
  .action(() => {
    console.log(chalk.blue('📚 sms-dev Documentation'))
    console.log('')
    console.log('GitHub:', chalk.cyan('https://github.com/pcdkd/smsdev'))
    console.log('Docs:', chalk.cyan('https://smsdev.app'))
    console.log('')
    console.log(chalk.yellow('Quick Commands:'))
    console.log('  sms-dev init           # Create configuration file')
    console.log('  sms-dev start          # Start server with config')
    console.log('  sms-dev start --no-ui  # API only')
    console.log('  sms-dev config         # Show current config')
    console.log('  sms-dev status         # Check status')
    console.log('  sms-dev stop           # Stop server')
    console.log('')
    console.log(chalk.yellow('Configuration:'))
    console.log('  sms-dev.config.js      # JavaScript config file')
    console.log('  sms-dev.config.json    # JSON config file')
    console.log('  .smsdevrc              # RC file (JSON)')
    console.log('')
    console.log(chalk.yellow('Environment Variables:'))
    console.log('  SMS_DEV_API_PORT       # API server port')
    console.log('  SMS_DEV_UI_PORT        # UI server port')
    console.log('  SMS_DEV_WEBHOOK_URL    # Webhook URL')
    console.log('  SMS_DEV_VERBOSE=true   # Enable verbose logging')
    console.log('  SMS_DEV_NO_UI=true     # Disable UI server')
  })

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason)
  process.exit(1)
})

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Shutting down sms-dev...'))
  try {
    await stopSmsDevServer()
    console.log(chalk.green('✅ Shutdown complete'))
    process.exit(0)
  } catch (error: any) {
    console.error(chalk.red('Error during shutdown:'), error?.message || error)
    process.exit(1)
  }
})

program.parse(process.argv)
#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs'
import path from 'path'
import { startSmsDevServer } from './commands/start.js'
import { stopSmsDevServer } from './commands/stop.js'
import { showStatus } from './commands/status.js'
import { loadConfig, generateSampleConfig, printConfig } from './utils/config.js'

const program = new Command()

program
  .name('sms-dev')
  .description('Local development tool for SMS applications - the Mailtrap for SMS')
  .version('1.0.0')

program
  .command('start')
  .description('Start the sms-dev server (API + UI)')
  .option('-c, --config <file>', 'Configuration file path')
  .option('-p, --api-port <port>', 'API server port')
  .option('-u, --ui-port <port>', 'UI server port')
  .option('--no-ui', 'Start only the API server')
  .option('--webhook-url <url>', 'Webhook URL for testing')
  .option('--verbose', 'Enable verbose logging')
  .option('--show-config', 'Show resolved configuration and exit')
  .action(async (options) => {
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

      const spinner = ora('Starting sms-dev server...').start()
      
      await startSmsDevServer({
        apiPort: config.apiPort,
        uiPort: config.uiPort,
        startUI: config.startUI,
        webhookUrl: config.webhookUrl,
        verbose: config.verbose
      })
      
      spinner.stop()
      
      console.log(chalk.green('✅ sms-dev is running!'))
      console.log('')
      console.log(chalk.blue('📡 API Server:'), `http://localhost:${config.apiPort}`)
      if (config.startUI) {
        console.log(chalk.blue('📱 Virtual Phone UI:'), `http://localhost:${config.uiPort}`)
      }
      console.log('')
      console.log(chalk.yellow('💡 Quick Start:'))
      console.log('  1. Point your SDK to:', chalk.cyan(`http://localhost:${config.apiPort}`))
      if (config.startUI) {
        console.log('  2. Open Virtual Phone:', chalk.cyan(`http://localhost:${config.uiPort}`))
        console.log('  3. Send test messages and see them in the UI!')
      }
      console.log('')
      console.log(chalk.gray('Press Ctrl+C to stop'))
      
    } catch (error: any) {
      console.error(chalk.red('Error:'), error?.message || error)
      process.exit(1)
    }
  })

program
  .command('init')
  .description('Generate a sample configuration file')
  .option('-f, --force', 'Overwrite existing configuration file')
  .option('--json', 'Generate JSON configuration instead of JavaScript')
  .action(async (options) => {
    const configFileName = options.json ? 'sms-dev.config.json' : 'sms-dev.config.js'
    const configPath = path.join(process.cwd(), configFileName)

    // Check if file already exists
    if (fs.existsSync(configPath) && !options.force) {
      console.log(chalk.yellow('⚠️  Configuration file already exists:'), configPath)
      console.log('Use --force to overwrite or choose a different name')
      return
    }

    try {
      let configContent: string

      if (options.json) {
        const jsonConfig = {
          apiPort: 4001,
          uiPort: 4000,
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
      console.log(chalk.green('✅ Created configuration file:'), configPath)
      console.log('')
      console.log(chalk.yellow('📝 Edit the file to customize your settings:'))
      console.log('  - API and UI ports')
      console.log('  - Webhook URL for testing')
      console.log('  - CORS and logging preferences')
      console.log('')
      console.log(chalk.blue('🚀 Start with your config:'), `sms-dev start`)
    } catch (error: any) {
      console.error(chalk.red('Error creating config file:'), error?.message || error)
      process.exit(1)
    }
  })

program
  .command('config')
  .description('Show current configuration')
  .option('-c, --config <file>', 'Configuration file path')
  .action(async (options) => {
    try {
      const config = loadConfig({
        configFile: options.config
      })
      printConfig(config)
    } catch (error: any) {
      console.error(chalk.red('Error loading configuration:'), error?.message || error)
      process.exit(1)
    }
  })

program
  .command('stop')
  .description('Stop the sms-dev server')
  .action(async () => {
    const spinner = ora('Stopping sms-dev server...').start()
    
    try {
      await stopSmsDevServer()
      spinner.succeed('sms-dev server stopped')
    } catch (error: any) {
      spinner.fail('Failed to stop sms-dev server')
      console.error(chalk.red('Error:'), error?.message || error)
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Check sms-dev server status')
  .action(async () => {
    await showStatus()
  })

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

// Mock phone management commands
program
  .command('mock-phone')
  .description('Mock phone number management')
  .argument('[action]', 'Action: create, list, delete')
  .option('--phone <number>', 'Phone number')
  .option('--name <name>', 'Contact name')
  .option('--type <type>', 'Phone type: business, personal, test', 'test')
  .option('--api-url <url>', 'API base URL', 'http://localhost:4001')
  .action(async (action, options) => {
    const apiUrl = options.apiUrl

    switch (action) {
      case 'create':
        if (!options.phone) {
          console.error('❌ Phone number is required for create action')
          process.exit(1)
        }
        
        try {
          const response = await fetch(`${apiUrl}/v1/dev/mock-phones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: options.phone,
              name: options.name,
              type: options.type,
              capabilities: { sms: true }
            })
          })
          
          if (response.ok) {
            const phone = await response.json()
            console.log('✅ Mock phone created:')
            console.log(`📱 ${phone.phone} (${phone.name || 'Unnamed'}) - ${phone.type}`)
          } else {
            const error = await response.json()
            console.error('❌ Failed to create mock phone:', error.message)
          }
        } catch (error) {
          console.error('❌ Error creating mock phone:', error)
        }
        break

      case 'list':
        try {
          const response = await fetch(`${apiUrl}/v1/dev/mock-phones`)
          if (response.ok) {
            const { phones } = await response.json()
            if (phones.length === 0) {
              console.log('📱 No mock phones found')
            } else {
              console.log(`📱 Mock Phones (${phones.length}):`)
              phones.forEach((phone: any) => {
                console.log(`  ${phone.phone} - ${phone.name || 'Unnamed'} (${phone.type})`)
              })
            }
          } else {
            console.error('❌ Failed to list mock phones')
          }
        } catch (error) {
          console.error('❌ Error listing mock phones:', error)
        }
        break

      case 'delete':
        if (!options.phone) {
          console.error('❌ Phone number is required for delete action')
          process.exit(1)
        }
        
        try {
          // First find the phone ID
          const listResponse = await fetch(`${apiUrl}/v1/dev/mock-phones`)
          const { phones } = await listResponse.json()
          const phone = phones.find((p: any) => p.phone === options.phone)
          
          if (!phone) {
            console.error('❌ Mock phone not found')
            process.exit(1)
          }
          
          const deleteResponse = await fetch(`${apiUrl}/v1/dev/mock-phones/${phone.id}`, {
            method: 'DELETE'
          })
          
          if (deleteResponse.ok) {
            console.log(`✅ Mock phone ${options.phone} deleted`)
          } else {
            console.error('❌ Failed to delete mock phone')
          }
        } catch (error) {
          console.error('❌ Error deleting mock phone:', error)
        }
        break

      default:
        console.log('Mock phone management commands:')
        console.log('  sms-dev mock-phone create --phone +1234567890 --name "Test User"')
        console.log('  sms-dev mock-phone list')
        console.log('  sms-dev mock-phone delete --phone +1234567890')
    }
  })

// Conversation flow commands
program
  .command('flow')
  .description('Conversation flow management')
  .argument('[action]', 'Action: create, list, execute')
  .option('--name <name>', 'Flow name')
  .option('--file <file>', 'Flow definition file (JSON)')
  .option('--flow-id <id>', 'Flow ID for execution')
  .option('--phone <number>', 'Target phone number for execution')
  .option('--api-url <url>', 'API base URL', 'http://localhost:4001')
  .action(async (action, options) => {
    const apiUrl = options.apiUrl

    switch (action) {
      case 'create':
        if (!options.file && !options.name) {
          console.error('❌ Either --file or --name is required for create action')
          process.exit(1)
        }
        
        let flowData
        if (options.file) {
          try {
            const fileContent = fs.readFileSync(options.file, 'utf8')
            flowData = JSON.parse(fileContent)
          } catch (error) {
            console.error('❌ Error reading flow file:', error)
            process.exit(1)
          }
        } else {
          // Create a sample flow
          flowData = {
            name: options.name,
            description: 'Sample conversation flow',
            trigger: { type: 'keyword', value: 'hello' },
            steps: [
              {
                type: 'send',
                message: 'Hello! Thanks for your message.',
                delay: 1000
              },
              {
                type: 'wait',
                delay: 2000
              },
              {
                type: 'send',
                message: 'How can I help you today?'
              }
            ]
          }
        }
        
        try {
          const response = await fetch(`${apiUrl}/v1/dev/conversation-flows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(flowData)
          })
          
          if (response.ok) {
            const flow = await response.json()
            console.log('✅ Conversation flow created:')
            console.log(`🔄 ${flow.name} (${flow.id})`)
            console.log(`📝 ${flow.steps.length} steps`)
          } else {
            const error = await response.json()
            console.error('❌ Failed to create flow:', error.message)
          }
        } catch (error) {
          console.error('❌ Error creating flow:', error)
        }
        break

      case 'list':
        try {
          const response = await fetch(`${apiUrl}/v1/dev/conversation-flows`)
          if (response.ok) {
            const { flows } = await response.json()
            if (flows.length === 0) {
              console.log('🔄 No conversation flows found')
            } else {
              console.log(`🔄 Conversation Flows (${flows.length}):`)
              flows.forEach((flow: any) => {
                const status = flow.active ? '🟢' : '🔴'
                console.log(`  ${status} ${flow.name} (${flow.id}) - ${flow.steps.length} steps`)
              })
            }
          } else {
            console.error('❌ Failed to list flows')
          }
        } catch (error) {
          console.error('❌ Error listing flows:', error)
        }
        break

      case 'execute':
        if (!options.flowId) {
          console.error('❌ Flow ID is required for execute action')
          process.exit(1)
        }
        
        try {
          const response = await fetch(`${apiUrl}/v1/dev/conversation-flows/${options.flowId}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: options.phone,
              context: { user: 'CLI User' }
            })
          })
          
          if (response.ok) {
            const result = await response.json()
            console.log('✅ Flow execution started:')
            console.log(`🚀 Execution ID: ${result.execution_id}`)
            if (options.phone) {
              console.log(`📱 Target: ${options.phone}`)
            }
          } else {
            const error = await response.json()
            console.error('❌ Failed to execute flow:', error.message)
          }
        } catch (error) {
          console.error('❌ Error executing flow:', error)
        }
        break

      default:
        console.log('Conversation flow commands:')
        console.log('  sms-dev flow create --name "Welcome Flow"')
        console.log('  sms-dev flow create --file flow-definition.json')
        console.log('  sms-dev flow list')
        console.log('  sms-dev flow execute --flow-id flow_123 --phone +1234567890')
    }
  })

// Export commands
program
  .command('export')
  .description('Export conversation history')
  .argument('[type]', 'Export type: messages, conversations')
  .option('--format <format>', 'Export format: json, csv', 'json')
  .option('--phone <number>', 'Filter by phone number')
  .option('--from-date <date>', 'Start date (ISO 8601)')
  .option('--to-date <date>', 'End date (ISO 8601)')
  .option('--output <file>', 'Output file path')
  .option('--api-url <url>', 'API base URL', 'http://localhost:4001')
  .action(async (type, options) => {
    const apiUrl = options.apiUrl
    const exportType = type || 'messages'
    
    if (!['messages', 'conversations'].includes(exportType)) {
      console.error('❌ Export type must be "messages" or "conversations"')
      process.exit(1)
    }

    try {
      const params = new URLSearchParams()
      if (options.format) params.append('format', options.format)
      if (options.phone) params.append('phone', options.phone)
      if (options.fromDate) params.append('from_date', options.fromDate)
      if (options.toDate) params.append('to_date', options.toDate)

      const endpoint = exportType === 'messages' 
        ? `/v1/messages/export`
        : `/v1/conversations/export`
      
      const response = await fetch(`${apiUrl}${endpoint}?${params}`)
      
      if (response.ok) {
        const contentType = response.headers.get('content-type')
        const isJson = contentType?.includes('application/json')
        
        if (options.output) {
          const content = isJson ? JSON.stringify(await response.json(), null, 2) : await response.text()
          fs.writeFileSync(options.output, content)
          console.log(`✅ Export saved to: ${options.output}`)
        } else {
          if (isJson) {
            const data = await response.json()
            console.log(JSON.stringify(data, null, 2))
          } else {
            const content = await response.text()
            console.log(content)
          }
        }
      } else {
        const error = await response.json()
        console.error('❌ Export failed:', error.message)
      }
    } catch (error) {
      console.error('❌ Error during export:', error)
    }
  })

// Performance testing commands
program
  .command('perf')
  .description('Performance testing utilities')
  .argument('[action]', 'Action: stats, load-test')
  .option('--messages <count>', 'Number of messages for load test', '100')
  .option('--users <count>', 'Concurrent users for load test', '5')
  .option('--duration <seconds>', 'Test duration in seconds', '30')
  .option('--api-url <url>', 'API base URL', 'http://localhost:4001')
  .action(async (action, options) => {
    const apiUrl = options.apiUrl

    switch (action) {
      case 'stats':
        try {
          const response = await fetch(`${apiUrl}/v1/dev/performance/stats`)
          if (response.ok) {
            const stats = await response.json()
            console.log('📊 Performance Statistics:')
            console.log(`⏱️  Uptime: ${Math.floor(stats.uptime / 60)}m ${Math.floor(stats.uptime % 60)}s`)
            console.log(`💾 Memory: ${Math.round(stats.memory.heapUsed / 1024 / 1024)}MB used`)
            console.log(`📨 Messages: ${stats.api.total_messages}`)
            console.log(`💬 Conversations: ${stats.api.total_conversations}`)
            console.log(`🔄 Active Flows: ${stats.api.active_flows}`)
            console.log(`📱 Mock Phones: ${stats.api.mock_phones}`)
          } else {
            console.error('❌ Failed to get performance stats')
          }
        } catch (error) {
          console.error('❌ Error getting stats:', error)
        }
        break

      case 'load-test':
        const messageCount = parseInt(options.messages)
        const userCount = parseInt(options.users)
        const duration = parseInt(options.duration)
        
        console.log(`🚀 Starting load test...`)
        console.log(`📨 Messages: ${messageCount}`)
        console.log(`👥 Users: ${userCount}`)
        console.log(`⏱️  Duration: ${duration}s`)
        
        try {
          const response = await fetch(`${apiUrl}/v1/dev/performance/load-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message_count: messageCount,
              concurrent_users: userCount,
              duration_seconds: duration
            })
          })
          
          if (response.ok) {
            const result = await response.json()
            console.log(`✅ Load test started: ${result.test_id}`)
            console.log('⏳ Test running... Results will be available via WebSocket or stats endpoint')
          } else {
            const error = await response.json()
            console.error('❌ Load test failed:', error.message)
          }
        } catch (error) {
          console.error('❌ Error starting load test:', error)
        }
        break

      default:
        console.log('Performance testing commands:')
        console.log('  sms-dev perf stats')
        console.log('  sms-dev perf load-test --messages 500 --users 10 --duration 60')
    }
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
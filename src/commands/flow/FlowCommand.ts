import chalk from 'chalk'
import fs from 'fs'
import { BaseCommand, CommandOptions } from '../base/BaseCommand.js'
import { ApiClient } from '../../services/ApiClient.js'
import { ValidationError } from '../../types/errors.js'
import { ENDPOINTS } from '../../constants.js'
import { ConversationFlow, ConversationFlowsResponse, FlowExecutionResult } from '../../types/api.js'

/**
 * Options for the flow command
 */
interface FlowOptions extends CommandOptions {
  action?: string
  name?: string
  file?: string
  flowId?: string
  phone?: string
}

/**
 * Flow definition interface
 */
interface FlowStep {
  type: 'send' | 'wait'
  message?: string
  delay?: number
}

interface FlowDefinition {
  name: string
  description?: string
  trigger?: {
    type: string
    value: string
  }
  steps: FlowStep[]
}

/**
 * Command to manage conversation flows
 */
export class FlowCommand extends BaseCommand {
  readonly name = 'flow'
  readonly description = 'Conversation flow management'
  
  private apiClient: ApiClient

  constructor() {
    super()
    this.apiClient = new ApiClient()
  }
  
  initialize(options: FlowOptions): void {
    super.initialize(options)
    this.apiClient.setBaseUrl(this.apiUrl)
  }

  async execute(options: FlowOptions): Promise<void> {
    const action = options.action

    switch (action) {
      case 'create':
        await this.createFlow(options)
        break
      case 'list':
        await this.listFlows()
        break
      case 'execute':
        await this.executeFlow(options)
        break
      default:
        this.showHelp()
    }
  }

  /**
   * Create a new conversation flow
   */
  private async createFlow(options: FlowOptions): Promise<void> {
    if (!options.file && !options.name) {
      throw new ValidationError('Either --file or --name is required for create action')
    }
    
    let flowData: FlowDefinition
    
    if (options.file) {
      try {
        this.logVerbose(`Reading flow definition from: ${options.file}`)
        const fileContent = fs.readFileSync(options.file, 'utf8')
        flowData = JSON.parse(fileContent)
      } catch (error: any) {
        throw new ValidationError(`Error reading flow file: ${error.message}`, 'file')
      }
    } else {
      // Create a sample flow
      flowData = {
        name: options.name!,
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
      this.startSpinner('Creating conversation flow')
      
      const flow = await this.apiClient.post<ConversationFlow>(ENDPOINTS.CONVERSATION_FLOWS, flowData)
      
      this.stopSpinner()
      this.logSuccess('Conversation flow created:')
      console.log(`🔄 ${flow.name} (${flow.id})`)
      console.log(`📝 ${flow.steps.length} steps`)
      
      if (flowData.trigger) {
        console.log(`🎯 Trigger: ${flowData.trigger.type} = "${flowData.trigger.value}"`)
      }
    } catch (error: any) {
      this.stopSpinner()
      this.handleError(error, 'creating conversation flow')
    }
  }

  /**
   * List all conversation flows
   */
  private async listFlows(): Promise<void> {
    try {
      this.startSpinner('Fetching conversation flows')
      
      const { flows } = await this.apiClient.get<ConversationFlowsResponse>(ENDPOINTS.CONVERSATION_FLOWS)
      
      this.stopSpinner()
      
      if (flows.length === 0) {
        console.log('🔄 No conversation flows found')
      } else {
        console.log(`🔄 Conversation Flows (${flows.length}):`)
        flows.forEach((flow: ConversationFlow) => {
          const status = flow.active ? '🟢' : '🔴'
          console.log(`  ${status} ${flow.name} (${flow.id}) - ${flow.steps.length} steps`)
          
          if (flow.trigger && this.verbose) {
            console.log(chalk.gray(`    📋 Trigger: ${flow.trigger.type} = "${flow.trigger.value}"`))
          }
          
          if (flow.description && this.verbose) {
            console.log(chalk.gray(`    📝 ${flow.description}`))
          }
        })
      }
    } catch (error: any) {
      this.stopSpinner()
      this.handleError(error, 'listing conversation flows')
    }
  }

  /**
   * Execute a conversation flow
   */
  private async executeFlow(options: FlowOptions): Promise<void> {
    if (!options.flowId) {
      throw new ValidationError('Flow ID is required for execute action', 'flowId')
    }

    try {
      this.startSpinner('Starting flow execution')
      
      const result = await this.apiClient.post<FlowExecutionResult>(`${ENDPOINTS.CONVERSATION_FLOWS}/${options.flowId}/execute`, {
        phone: options.phone,
        context: { user: 'CLI User' }
      })
      
      this.stopSpinner()
      this.logSuccess('Flow execution started:')
      console.log(`🚀 Execution ID: ${result.execution_id}`)
      
      if (options.phone) {
        console.log(`📱 Target: ${options.phone}`)
      }
      
      if (this.verbose) {
        this.logVerbose('Flow execution details available via WebSocket or status endpoint')
      }
    } catch (error: any) {
      this.stopSpinner()
      this.handleError(error, 'executing conversation flow')
    }
  }

  /**
   * Show help for flow commands
   */
  private showHelp(): void {
    console.log(chalk.blue('Conversation flow management commands:'))
    console.log('')
    console.log(chalk.yellow('Create flows:'))
    console.log('  sms-dev flow create --name "Welcome Flow"')
    console.log('  sms-dev flow create --file flow-definition.json')
    console.log('')
    console.log(chalk.yellow('Manage flows:'))
    console.log('  sms-dev flow list')
    console.log('  sms-dev flow execute --flow-id flow_123')
    console.log('  sms-dev flow execute --flow-id flow_123 --phone +1234567890')
    console.log('')
    console.log(chalk.yellow('Options:'))
    console.log('  --name <name>      Flow name (for simple flow creation)')
    console.log('  --file <file>      Flow definition file (JSON)')
    console.log('  --flow-id <id>     Flow ID for execution')
    console.log('  --phone <number>   Target phone number for execution (optional)')
    console.log('')
    console.log(chalk.yellow('Flow Definition Format (JSON):'))
    console.log(chalk.cyan(`{
  "name": "Welcome Flow",
  "description": "Greets new users",
  "trigger": {
    "type": "keyword",
    "value": "hello"
  },
  "steps": [
    {
      "type": "send",
      "message": "Hello! Welcome to our service.",
      "delay": 1000
    },
    {
      "type": "wait",
      "delay": 2000
    },
    {
      "type": "send", 
      "message": "How can we help you today?"
    }
  ]
}`))
  }
}
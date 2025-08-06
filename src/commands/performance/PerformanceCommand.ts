import chalk from 'chalk'
import { BaseCommand, CommandOptions } from '../base/BaseCommand.js'
import { ApiClient } from '../../services/ApiClient.js'
import { ValidationError } from '../../types/errors.js'
import { ENDPOINTS } from '../../constants.js'
import { PerformanceStats as ApiPerformanceStats, LoadTestResult } from '../../types/api.js'

/**
 * Options for the performance command
 */
interface PerformanceOptions extends CommandOptions {
  action?: string
  messages?: string
  users?: string
  duration?: string
}

/**
 * Local performance statistics interface (compatible with API version)
 */
interface PerformanceStats {
  uptime: number
  memory: {
    heapUsed: number
    heapTotal: number
    rss: number
    external?: number
    arrayBuffers?: number
  }
  api: {
    total_messages: number
    total_conversations: number
    active_flows: number
    mock_phones: number
  }
  system?: {
    cpu?: number
    loadAvg?: number[]
    platform?: string
    nodeVersion?: string
    pid?: number
  }
}

/**
 * Load test configuration interface
 */
interface LoadTestConfig {
  message_count: number
  concurrent_users: number
  duration_seconds: number
}

/**
 * Command for performance testing utilities
 */
export class PerformanceCommand extends BaseCommand {
  readonly name = 'perf'
  readonly description = 'Performance testing utilities'
  
  private apiClient: ApiClient

  constructor() {
    super()
    this.apiClient = new ApiClient()
  }
  
  initialize(options: PerformanceOptions): void {
    super.initialize(options)
    this.apiClient.setBaseUrl(this.apiUrl)
  }

  async execute(options: PerformanceOptions): Promise<void> {
    const action = options.action

    switch (action) {
      case 'stats':
        await this.showPerformanceStats()
        break
      case 'load-test':
        await this.runLoadTest(options)
        break
      default:
        this.showHelp()
    }
  }

  /**
   * Show current performance statistics
   */
  private async showPerformanceStats(): Promise<void> {
    try {
      this.startSpinner('Fetching performance statistics')
      
      const stats = await this.apiClient.get<PerformanceStats>(ENDPOINTS.PERFORMANCE_STATS)
      
      this.stopSpinner()
      
      console.log(chalk.blue('📊 Performance Statistics:'))
      console.log('')
      
      // Server uptime
      const uptimeMinutes = Math.floor(stats.uptime / 60)
      const uptimeSeconds = Math.floor(stats.uptime % 60)
      const uptimeHours = Math.floor(uptimeMinutes / 60)
      const displayMinutes = uptimeMinutes % 60
      
      if (uptimeHours > 0) {
        console.log(`⏱️  Uptime: ${uptimeHours}h ${displayMinutes}m ${uptimeSeconds}s`)
      } else if (uptimeMinutes > 0) {
        console.log(`⏱️  Uptime: ${displayMinutes}m ${uptimeSeconds}s`)
      } else {
        console.log(`⏱️  Uptime: ${uptimeSeconds}s`)
      }
      
      // Memory usage
      const heapUsedMB = Math.round(stats.memory.heapUsed / 1024 / 1024 * 100) / 100
      const heapTotalMB = Math.round(stats.memory.heapTotal / 1024 / 1024 * 100) / 100
      const rssMB = Math.round(stats.memory.rss / 1024 / 1024 * 100) / 100
      
      console.log(`💾 Memory Usage:`)
      console.log(`   Heap Used: ${heapUsedMB}MB`)
      console.log(`   Heap Total: ${heapTotalMB}MB`)
      console.log(`   RSS: ${rssMB}MB`)
      
      // API statistics
      console.log(`📊 API Statistics:`)
      console.log(`   📨 Messages: ${stats.api.total_messages.toLocaleString()}`)
      console.log(`   💬 Conversations: ${stats.api.total_conversations.toLocaleString()}`)
      console.log(`   🔄 Active Flows: ${stats.api.active_flows}`)
      console.log(`   📱 Mock Phones: ${stats.api.mock_phones}`)
      
      // System statistics (if available)
      if (stats.system) {
        console.log(`🖥️  System:`)
        console.log(`   CPU Usage: ${Math.round((stats.system.cpu || 0) * 100)}%`)
        if (stats.system.loadAvg && stats.system.loadAvg.length > 0) {
          console.log(`   Load Average: ${stats.system.loadAvg.map(l => l.toFixed(2)).join(', ')}`)
        }
      }
      
      // Performance insights
      console.log('')
      this.showPerformanceInsights(stats)
      
    } catch (error: any) {
      this.stopSpinner()
      this.handleError(error, 'fetching performance statistics')
    }
  }

  /**
   * Run a load test
   */
  private async runLoadTest(options: PerformanceOptions): Promise<void> {
    // Validate and parse parameters
    const messageCount = this.parseIntegerOption(options.messages, 'messages', 100, 1, 10000)
    const userCount = this.parseIntegerOption(options.users, 'users', 5, 1, 100)
    const duration = this.parseIntegerOption(options.duration, 'duration', 30, 1, 300)

    const config: LoadTestConfig = {
      message_count: messageCount,
      concurrent_users: userCount,
      duration_seconds: duration
    }

    console.log(chalk.blue('🚀 Starting load test...'))
    console.log(`📨 Messages: ${messageCount.toLocaleString()}`)
    console.log(`👥 Concurrent Users: ${userCount}`)
    console.log(`⏱️  Duration: ${duration}s`)
    console.log('')

    try {
      this.startSpinner('Initializing load test')
      
      const result = await this.apiClient.post<LoadTestResult>(ENDPOINTS.LOAD_TEST, config)
      
      this.stopSpinner()
      this.logSuccess(`Load test started: ${result.test_id}`)
      
      console.log('')
      console.log(chalk.yellow('📊 Test Configuration:'))
      console.log(`   Test ID: ${result.test_id}`)
      console.log(`   Messages per user: ${Math.ceil(messageCount / userCount)}`)
      console.log(`   Total target messages: ${messageCount.toLocaleString()}`)
      console.log(`   Estimated messages/sec: ${Math.ceil(messageCount / duration)}`)
      
      console.log('')
      console.log(chalk.blue('⏳ Test is running...'))
      console.log('Results will be available via:')
      console.log(`   • WebSocket connection to ${this.apiUrl}`)
      console.log(`   • Performance stats endpoint: sms-dev perf stats`)
      console.log(`   • UI dashboard: http://localhost:4000`)
      
      if (this.verbose) {
        console.log('')
        console.log(chalk.gray('Monitor the test progress with:'))
        console.log(chalk.gray('   watch -n 1 "sms-dev perf stats"'))
      }
      
    } catch (error: any) {
      this.stopSpinner()
      this.handleError(error, 'starting load test')
    }
  }

  /**
   * Parse and validate integer options
   */
  private parseIntegerOption(
    value: string | undefined, 
    name: string, 
    defaultValue: number,
    min?: number,
    max?: number
  ): number {
    if (!value) return defaultValue
    
    const parsed = parseInt(value, 10)
    
    if (isNaN(parsed)) {
      throw new ValidationError(`${name} must be a valid number`, name)
    }
    
    if (min !== undefined && parsed < min) {
      throw new ValidationError(`${name} must be at least ${min}`, name)
    }
    
    if (max !== undefined && parsed > max) {
      throw new ValidationError(`${name} must be at most ${max}`, name)
    }
    
    return parsed
  }

  /**
   * Show performance insights based on current statistics
   */
  private showPerformanceInsights(stats: PerformanceStats): void {
    const insights: string[] = []
    
    // Memory insights
    const heapUsagePercent = (stats.memory.heapUsed / stats.memory.heapTotal) * 100
    if (heapUsagePercent > 80) {
      insights.push('⚠️  High heap memory usage detected')
    } else if (heapUsagePercent < 20) {
      insights.push('✅ Healthy memory usage')
    }
    
    // Message throughput insights
    const messagesPerMinute = stats.uptime > 60 ? Math.round(stats.api.total_messages / (stats.uptime / 60)) : 0
    if (messagesPerMinute > 0) {
      insights.push(`📈 Average: ${messagesPerMinute} messages/minute`)
    }
    
    // Active components insights
    if (stats.api.active_flows > 10) {
      insights.push('🔄 High number of active flows')
    }
    
    if (stats.api.mock_phones === 0) {
      insights.push('📱 No mock phones configured - create some for testing')
    }
    
    // System insights
    if (stats.system?.cpu && stats.system.cpu > 0.8) {
      insights.push('⚠️  High CPU usage detected')
    }
    
    if (insights.length > 0) {
      console.log(chalk.yellow('💡 Insights:'))
      insights.forEach(insight => {
        console.log(`   ${insight}`)
      })
    } else {
      console.log(chalk.green('💡 System performance looks good!'))
    }
  }

  /**
   * Show help for performance commands
   */
  private showHelp(): void {
    console.log(chalk.blue('Performance testing utilities:'))
    console.log('')
    console.log(chalk.yellow('Statistics:'))
    console.log('  sms-dev perf stats                     # Show current performance statistics')
    console.log('')
    console.log(chalk.yellow('Load testing:'))
    console.log('  sms-dev perf load-test                 # Run default load test')
    console.log('  sms-dev perf load-test \\')
    console.log('    --messages 1000 \\')
    console.log('    --users 20 \\')
    console.log('    --duration 60')
    console.log('')
    console.log(chalk.yellow('Load test options:'))
    console.log('  --messages <count>     Number of messages to send (1-10,000, default: 100)')
    console.log('  --users <count>        Concurrent users (1-100, default: 5)')
    console.log('  --duration <seconds>   Test duration in seconds (1-300, default: 30)')
    console.log('')
    console.log(chalk.yellow('Examples:'))
    console.log('  # Quick test')
    console.log('  sms-dev perf load-test --messages 50 --users 3 --duration 10')
    console.log('')
    console.log('  # Stress test')
    console.log('  sms-dev perf load-test --messages 5000 --users 50 --duration 120')
    console.log('')
    console.log('  # Monitoring during test')
    console.log('  watch -n 1 "sms-dev perf stats"')
    console.log('')
    console.log(chalk.yellow('Notes:'))
    console.log('  • Load tests run asynchronously - monitor via stats or UI')
    console.log('  • Test results include response times, throughput, and error rates')
    console.log('  • WebSocket connections provide real-time test progress')
    console.log('  • Use --verbose for detailed logging during test execution')
  }
}
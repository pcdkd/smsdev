import { performance } from 'perf_hooks'
import { cpus, freemem, totalmem } from 'os'

export interface PerformanceMetrics {
  startup: {
    time: number
    memory: NodeJS.MemoryUsage
  }
  runtime: {
    uptime: number
    memory: NodeJS.MemoryUsage
    cpu: {
      count: number
      usage: number[]
    }
  }
  api: {
    totalRequests: number
    averageResponseTime: number
    errorRate: number
  }
}

export class PerformanceMonitor {
  private startTime: number
  private requestMetrics: { time: number; success: boolean }[] = []
  private memorySnapshots: NodeJS.MemoryUsage[] = []
  private startupMetrics: { time: number; memory: NodeJS.MemoryUsage }

  constructor() {
    this.startTime = performance.now()
    this.startupMetrics = {
      time: this.startTime,
      memory: process.memoryUsage()
    }
    
    // Take memory snapshots every 30 seconds
    setInterval(() => {
      this.memorySnapshots.push(process.memoryUsage())
      // Keep only last 10 snapshots
      if (this.memorySnapshots.length > 10) {
        this.memorySnapshots.shift()
      }
    }, 30000)
  }

  /**
   * Record API request metrics
   */
  recordRequest(responseTime: number, success: boolean = true): void {
    this.requestMetrics.push({
      time: responseTime,
      success
    })
    
    // Keep only last 1000 requests
    if (this.requestMetrics.length > 1000) {
      this.requestMetrics.shift()
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const currentTime = performance.now()
    const uptime = Math.round((currentTime - this.startTime) / 1000) // seconds
    
    // Calculate API metrics
    const totalRequests = this.requestMetrics.length
    const averageResponseTime = totalRequests > 0 
      ? this.requestMetrics.reduce((sum, req) => sum + req.time, 0) / totalRequests
      : 0
    const errorRate = totalRequests > 0
      ? (this.requestMetrics.filter(req => !req.success).length / totalRequests) * 100
      : 0

    // Get CPU usage (approximate)
    const cpuCount = cpus().length
    const cpuUsage = cpus().map(cpu => {
      const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0)
      const idle = cpu.times.idle
      return ((total - idle) / total) * 100
    })

    return {
      startup: this.startupMetrics,
      runtime: {
        uptime,
        memory: process.memoryUsage(),
        cpu: {
          count: cpuCount,
          usage: cpuUsage
        }
      },
      api: {
        totalRequests,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100
      }
    }
  }

  /**
   * Get memory usage trend
   */
  getMemoryTrend(): NodeJS.MemoryUsage[] {
    return [...this.memorySnapshots]
  }

  /**
   * Check if performance is degraded
   */
  checkPerformanceHealth(): {
    healthy: boolean
    issues: string[]
    recommendations: string[]
  } {
    const metrics = this.getMetrics()
    const issues: string[] = []
    const recommendations: string[] = []
    
    // Check memory usage
    const memoryUsage = metrics.runtime.memory
    const totalSystemMemory = totalmem()
    const freeSystemMemory = freemem()
    const processMemoryMB = memoryUsage.rss / 1024 / 1024
    
    if (processMemoryMB > 100) {
      issues.push(`High memory usage: ${Math.round(processMemoryMB)}MB`)
      recommendations.push('Consider restarting the service or reducing concurrent operations')
    }
    
    if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.8) {
      issues.push('Heap usage is above 80%')
      recommendations.push('Memory leak possible - monitor garbage collection')
    }
    
    // Check API performance
    if (metrics.api.averageResponseTime > 1000) {
      issues.push(`Slow API responses: ${metrics.api.averageResponseTime}ms average`)
      recommendations.push('Consider optimizing database queries or adding caching')
    }
    
    if (metrics.api.errorRate > 5) {
      issues.push(`High error rate: ${metrics.api.errorRate}%`)
      recommendations.push('Check logs for recurring errors and fix underlying issues')
    }
    
    // Check system resources
    if (freeSystemMemory / totalSystemMemory < 0.1) {
      issues.push('System memory is low')
      recommendations.push('Consider upgrading system memory or reducing other processes')
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    }
  }

  /**
   * Format metrics for CLI display
   */
  formatMetrics(): string {
    const metrics = this.getMetrics()
    const health = this.checkPerformanceHealth()
    
    const lines = [
      '📊 Performance Metrics',
      '===================',
      '',
      '🚀 Startup:',
      `   Time: ${Math.round(metrics.startup.time)}ms`,
      `   Memory: ${Math.round(metrics.startup.memory.rss / 1024 / 1024)}MB`,
      '',
      '⏱️  Runtime:',
      `   Uptime: ${this.formatUptime(metrics.runtime.uptime)}`,
      `   Memory: ${Math.round(metrics.runtime.memory.rss / 1024 / 1024)}MB`,
      `   Heap: ${Math.round(metrics.runtime.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(metrics.runtime.memory.heapTotal / 1024 / 1024)}MB`,
      `   CPU: ${metrics.runtime.cpu.count} cores`,
      '',
      '🌐 API:',
      `   Requests: ${metrics.api.totalRequests}`,
      `   Avg Response: ${metrics.api.averageResponseTime}ms`,
      `   Error Rate: ${metrics.api.errorRate}%`,
      ''
    ]
    
    if (!health.healthy) {
      lines.push('⚠️  Performance Issues:')
      health.issues.forEach(issue => lines.push(`   • ${issue}`))
      lines.push('')
      lines.push('💡 Recommendations:')
      health.recommendations.forEach(rec => lines.push(`   • ${rec}`))
    } else {
      lines.push('✅ Performance is healthy')
    }
    
    return lines.join('\n')
  }

  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Middleware to track API request performance
 */
export function createPerformanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = performance.now()
    
    res.on('finish', () => {
      const endTime = performance.now()
      const responseTime = endTime - startTime
      const success = res.statusCode < 400
      
      performanceMonitor.recordRequest(responseTime, success)
    })
    
    next()
  }
}

/**
 * Benchmark a function execution
 */
export async function benchmark<T>(
  name: string, 
  fn: () => T | Promise<T>
): Promise<{ result: T; time: number }> {
  const startTime = performance.now()
  const result = await fn()
  const endTime = performance.now()
  const time = endTime - startTime
  
  console.log(`⏱️  ${name}: ${Math.round(time * 100) / 100}ms`)
  
  return { result, time }
} 
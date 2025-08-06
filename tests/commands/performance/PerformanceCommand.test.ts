import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { PerformanceCommand } from '../../../src/commands/performance/PerformanceCommand.js'
import { MockApiClient } from '../../helpers/MockApiClient.js'
import { MOCK_PERFORMANCE_STATS } from '../../fixtures/testConfig.js'
import { ValidationError, ApiError } from '../../../src/types/errors.js'
import { ENDPOINTS } from '../../../src/constants.js'

describe('PerformanceCommand', () => {
  let command: PerformanceCommand
  let mockApiClient: MockApiClient
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    command = new PerformanceCommand()
    mockApiClient = new MockApiClient()
    
    // Replace the real API client with our mock
    ;(command as any).apiClient = mockApiClient
    
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    // Reset mocks
    jest.clearAllMocks()
    mockApiClient.reset()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('perf')
      expect(command.description).toBe('Performance testing utilities')
    })
  })

  describe('initialize()', () => {
    it('should set API client base URL', () => {
      const options = { apiUrl: 'http://custom:8080' }
      const setBaseUrlSpy = jest.spyOn(mockApiClient, 'setBaseUrl')
      
      command.initialize(options)
      
      expect(setBaseUrlSpy).toHaveBeenCalledWith('http://custom:8080')
    })

    it('should handle default API URL', () => {
      const setBaseUrlSpy = jest.spyOn(mockApiClient, 'setBaseUrl')
      
      command.initialize({})
      
      expect(setBaseUrlSpy).toHaveBeenCalledWith('http://localhost:4001')
    })
  })

  describe('execute() - Stats Action', () => {
    it('should successfully display performance statistics', async () => {
      const mockStats = {
        uptime: 3661, // 1h 1m 1s
        memory: {
          heapUsed: 52428800, // ~50MB
          heapTotal: 104857600, // ~100MB
          rss: 157286400, // ~150MB
          external: 1024000,
          arrayBuffers: 512000
        },
        api: {
          total_messages: 1250,
          total_conversations: 150,
          active_flows: 5,
          mock_phones: 10
        },
        system: {
          cpu: 0.75, // 75%
          loadAvg: [0.5, 0.3, 0.1],
          platform: 'darwin',
          nodeVersion: '18.19.0',
          pid: 12345
        }
      }
      mockApiClient.get.mockResolvedValue(mockStats)
      
      const options = { action: 'stats' }

      await command.execute(options)

      expect(mockApiClient.get).toHaveBeenCalledWith(ENDPOINTS.PERFORMANCE_STATS)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Performance Statistics:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1h 1m 1s'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('50MB'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1,250'))
    })

    it('should display uptime in different formats', async () => {
      // Test minutes only
      let mockStats = { ...MOCK_PERFORMANCE_STATS, uptime: 125 } // 2m 5s
      mockApiClient.get.mockResolvedValue(mockStats)
      
      await command.execute({ action: 'stats' })
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2m 5s'))
      
      // Test seconds only
      consoleSpy.mockClear()
      mockStats = { ...MOCK_PERFORMANCE_STATS, uptime: 45 } // 45s
      mockApiClient.get.mockResolvedValue(mockStats)
      
      await command.execute({ action: 'stats' })
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('45s'))
    })

    it('should display system information when available', async () => {
      const mockStats = {
        ...MOCK_PERFORMANCE_STATS,
        system: {
          cpu: 0.25,
          loadAvg: [0.8, 0.6, 0.4],
          platform: 'linux',
          nodeVersion: '20.0.0',
          pid: 9999
        }
      }
      mockApiClient.get.mockResolvedValue(mockStats)

      await command.execute({ action: 'stats' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('System:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CPU Usage: 25%'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Load Average: 0.80, 0.60, 0.40'))
    })

    it('should show performance insights', async () => {
      // High memory usage scenario
      const highMemoryStats = {
        ...MOCK_PERFORMANCE_STATS,
        memory: {
          heapUsed: 85 * 1024 * 1024, // 85MB
          heapTotal: 100 * 1024 * 1024, // 100MB (85% usage)
          rss: 120 * 1024 * 1024
        }
      }
      mockApiClient.get.mockResolvedValue(highMemoryStats)

      await command.execute({ action: 'stats' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('High heap memory usage detected'))
    })

    it('should show healthy memory insight', async () => {
      const healthyMemoryStats = {
        ...MOCK_PERFORMANCE_STATS,
        memory: {
          heapUsed: 10 * 1024 * 1024, // 10MB
          heapTotal: 100 * 1024 * 1024, // 100MB (10% usage)
          rss: 50 * 1024 * 1024
        }
      }
      mockApiClient.get.mockResolvedValue(healthyMemoryStats)

      await command.execute({ action: 'stats' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Healthy memory usage'))
    })

    it('should calculate and display message throughput', async () => {
      const statsWithThroughput = {
        ...MOCK_PERFORMANCE_STATS,
        uptime: 120, // 2 minutes
        api: { ...MOCK_PERFORMANCE_STATS.api, total_messages: 60 } // 30 messages/minute
      }
      mockApiClient.get.mockResolvedValue(statsWithThroughput)

      await command.execute({ action: 'stats' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('30 messages/minute'))
    })

    it('should show insights for no mock phones', async () => {
      const noPhoneStats = {
        ...MOCK_PERFORMANCE_STATS,
        api: { ...MOCK_PERFORMANCE_STATS.api, mock_phones: 0 }
      }
      mockApiClient.get.mockResolvedValue(noPhoneStats)

      await command.execute({ action: 'stats' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No mock phones configured'))
    })

    it('should handle API errors during stats fetch', async () => {
      mockApiClient.get.mockRejectedValue(new ApiError('Service unavailable', 503, ENDPOINTS.PERFORMANCE_STATS))
      
      await expect(command.execute({ action: 'stats' })).rejects.toThrow('Service unavailable')
    })
  })

  describe('execute() - Load Test Action', () => {
    it('should successfully start a load test with default values', async () => {
      const mockResult = {
        test_id: 'test_123',
        status: 'started' as const,
        config: {
          message_count: 100,
          concurrent_users: 5,
          duration_seconds: 30
        },
        startedAt: '2024-01-01T12:00:00Z'
      }
      mockApiClient.post.mockResolvedValue(mockResult)
      
      const options = { action: 'load-test' }

      await command.execute(options)

      expect(mockApiClient.post).toHaveBeenCalledWith(ENDPOINTS.LOAD_TEST, {
        message_count: 100,
        concurrent_users: 5,
        duration_seconds: 30
      })
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Starting load test'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Messages: 100'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Concurrent Users: 5'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Duration: 30s'))
    })

    it('should start load test with custom parameters', async () => {
      const mockResult = {
        test_id: 'test_456',
        status: 'started' as const,
        config: {
          message_count: 1000,
          concurrent_users: 20,
          duration_seconds: 60
        },
        startedAt: '2024-01-01T12:00:00Z'
      }
      mockApiClient.post.mockResolvedValue(mockResult)
      
      const options = {
        action: 'load-test',
        messages: '1000',
        users: '20',
        duration: '60'
      }

      await command.execute(options)

      expect(mockApiClient.post).toHaveBeenCalledWith(ENDPOINTS.LOAD_TEST, {
        message_count: 1000,
        concurrent_users: 20,
        duration_seconds: 60
      })
    })

    it('should display test configuration details', async () => {
      const mockResult = {
        test_id: 'test_789',
        status: 'started' as const,
        config: {
          message_count: 500,
          concurrent_users: 10,
          duration_seconds: 45
        },
        startedAt: '2024-01-01T12:00:00Z'
      }
      mockApiClient.post.mockResolvedValue(mockResult)

      await command.execute({
        action: 'load-test',
        messages: '500',
        users: '10',
        duration: '45'
      })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test Configuration:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test ID: test_789'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Messages per user: 50'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total target messages: 500'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Estimated messages/sec: 12'))
    })

    it('should show verbose monitoring instructions', async () => {
      const mockResult = {
        test_id: 'test_verbose',
        status: 'started' as const,
        config: { message_count: 100, concurrent_users: 5, duration_seconds: 30 },
        startedAt: '2024-01-01T12:00:00Z'
      }
      mockApiClient.post.mockResolvedValue(mockResult)
      command.initialize({ verbose: true })

      await command.execute({ action: 'load-test' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Monitor the test progress with'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('watch -n 1'))
    })

    it('should validate message count parameter', async () => {
      const options = { action: 'load-test', messages: 'invalid' }
      
      await expect(command.execute(options)).rejects.toThrow('messages must be a valid number')
    })

    it('should validate message count range', async () => {
      const options = { action: 'load-test', messages: '15000' } // Above max
      
      await expect(command.execute(options)).rejects.toThrow('messages must be at most 10000')
    })

    it('should validate users parameter range', async () => {
      const options = { action: 'load-test', users: '0' } // Below min
      
      await expect(command.execute(options)).rejects.toThrow('users must be at least 1')
    })

    it('should validate duration parameter range', async () => {
      const options = { action: 'load-test', duration: '500' } // Above max
      
      await expect(command.execute(options)).rejects.toThrow('duration must be at most 300')
    })

    it('should handle API errors during load test start', async () => {
      mockApiClient.post.mockRejectedValue(new ApiError('Load test limit exceeded', 429, ENDPOINTS.LOAD_TEST))
      
      await expect(command.execute({ action: 'load-test' })).rejects.toThrow('Load test limit exceeded')
    })
  })

  describe('execute() - Help Action', () => {
    it('should show help when no action provided', async () => {
      const options = {}

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Performance testing utilities'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('sms-dev perf stats'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('sms-dev perf load-test'))
    })

    it('should show detailed help with examples', async () => {
      const options = {}

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Load test options:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Examples:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Quick test'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Stress test'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Notes:'))
    })

    it('should show help for invalid action', async () => {
      const options = { action: 'invalid' }

      await command.execute(options)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Performance testing utilities'))
    })
  })

  describe('Spinner Behavior', () => {
    it('should show spinner during stats operation', async () => {
      mockApiClient.get.mockResolvedValue(MOCK_PERFORMANCE_STATS)
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')
      
      await command.execute({ action: 'stats' })

      expect(startSpinnerSpy).toHaveBeenCalledWith('Fetching performance statistics')
      expect(stopSpinnerSpy).toHaveBeenCalled()
    })

    it('should show spinner during load test operation', async () => {
      const mockResult = {
        test_id: 'test_123',
        status: 'started' as const,
        config: { message_count: 100, concurrent_users: 5, duration_seconds: 30 },
        startedAt: '2024-01-01T12:00:00Z'
      }
      mockApiClient.post.mockResolvedValue(mockResult)
      
      const startSpinnerSpy = jest.spyOn(command as any, 'startSpinner')
      const stopSpinnerSpy = jest.spyOn(command as any, 'stopSpinner')
      
      await command.execute({ action: 'load-test' })

      expect(startSpinnerSpy).toHaveBeenCalledWith('Initializing load test')
      expect(stopSpinnerSpy).toHaveBeenCalled()
    })
  })

  describe('Parameter Parsing', () => {
    it('should return default values when parameters are not provided', () => {
      const parseIntegerOption = (command as any).parseIntegerOption.bind(command)
      
      expect(parseIntegerOption(undefined, 'test', 42)).toBe(42)
    })

    it('should parse valid integer strings', () => {
      const parseIntegerOption = (command as any).parseIntegerOption.bind(command)
      
      expect(parseIntegerOption('123', 'test', 42)).toBe(123)
    })

    it('should validate minimum values', () => {
      const parseIntegerOption = (command as any).parseIntegerOption.bind(command)
      
      expect(() => {
        parseIntegerOption('5', 'test', 10, 10, 100)
      }).toThrow(ValidationError)
    })

    it('should validate maximum values', () => {
      const parseIntegerOption = (command as any).parseIntegerOption.bind(command)
      
      expect(() => {
        parseIntegerOption('150', 'test', 10, 1, 100)
      }).toThrow(ValidationError)
    })
  })

  describe('Performance Insights', () => {
    it('should show insights for high CPU usage', async () => {
      const highCpuStats = {
        ...MOCK_PERFORMANCE_STATS,
        system: { cpu: 0.9, loadAvg: [2.5, 2.0, 1.8] }
      }
      mockApiClient.get.mockResolvedValue(highCpuStats)

      await command.execute({ action: 'stats' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('High CPU usage detected'))
    })

    it('should show insights for many active flows', async () => {
      const manyFlowsStats = {
        ...MOCK_PERFORMANCE_STATS,
        api: { ...MOCK_PERFORMANCE_STATS.api, active_flows: 15 }
      }
      mockApiClient.get.mockResolvedValue(manyFlowsStats)

      await command.execute({ action: 'stats' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('High number of active flows'))
    })

    it('should show good performance message when no issues', async () => {
      const goodStats = {
        ...MOCK_PERFORMANCE_STATS,
        memory: {
          heapUsed: 25 * 1024 * 1024, // 25MB
          heapTotal: 100 * 1024 * 1024, // 100MB (25% usage)
          rss: 50 * 1024 * 1024
        },
        api: { ...MOCK_PERFORMANCE_STATS.api, mock_phones: 5 },
        system: { cpu: 0.3, loadAvg: [0.2, 0.3, 0.4] }
      }
      mockApiClient.get.mockResolvedValue(goodStats)

      await command.execute({ action: 'stats' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('System performance looks good'))
    })
  })

  describe('Error Context', () => {
    it('should provide proper error context for stats', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'))
      
      await expect(command.execute({ action: 'stats' })).rejects.toThrow('Network error')
    })

    it('should provide proper error context for load test', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Network error'))
      
      await expect(command.execute({ action: 'load-test' })).rejects.toThrow('Network error')
    })
  })

  describe('Integration with BaseCommand', () => {
    it('should inherit from BaseCommand correctly', () => {
      expect(command).toHaveProperty('name')
      expect(command).toHaveProperty('description')
      expect(command).toHaveProperty('execute')
      expect(command).toHaveProperty('initialize')
    })

    it('should have access to BaseCommand methods', () => {
      expect(command['handleError']).toBeDefined()
      expect(command['startSpinner']).toBeDefined()
      expect(command['stopSpinner']).toBeDefined()
      expect(command['logSuccess']).toBeDefined()
    })
  })
})
/**
 * End-to-end integration tests for CLI workflows
 * Tests complete user journeys through the CLI application
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import http from 'http'
import net from 'net'
import { fileURLToPath } from 'url'

const sleep = promisify(setTimeout)

// Get directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// CLI executable path
const CLI_PATH = path.join(__dirname, '../../dist/cli.js')
const TEST_DATA_DIR = path.join(__dirname, 'test-data')

// Helper to check if port is in use
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(true))
    server.once('listening', () => {
      server.close()
      resolve(false)
    })
    server.listen(port)
  })
}

// Helper to wait for server to be ready
async function waitForServer(port: number, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortInUse(port)) {
      return
    }
    await sleep(1000)
  }
  throw new Error(`Server did not start on port ${port} within ${maxAttempts} seconds`)
}

// Helper to make HTTP requests to the API
async function apiRequest(
  path: string,
  options: http.RequestOptions = {}
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 4001,
        path,
        method: 'GET',
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode || 0,
              data: data ? JSON.parse(data) : null
            })
          } catch (error) {
            resolve({ status: res.statusCode || 0, data })
          }
        })
      }
    )

    req.on('error', reject)
    
    if (options.method === 'POST' || options.method === 'PUT') {
      req.write(JSON.stringify(options.body || {}))
    }
    
    req.end()
  })
}

describe('CLI Workflow Integration Tests', () => {
  let serverProcess: ChildProcess | null = null

  beforeEach(async () => {
    // Create test data directory
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
    }

    // Ensure ports are free
    if (await isPortInUse(4001)) {
      throw new Error('Port 4001 is already in use')
    }
    if (await isPortInUse(4000)) {
      throw new Error('Port 4000 is already in use')
    }
  })

  afterEach(async () => {
    // Stop server if running
    if (serverProcess) {
      serverProcess.kill('SIGTERM')
      await sleep(2000) // Wait for graceful shutdown
      
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL')
      }
      serverProcess = null
    }

    // Clean up test data
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
    }
  })

  describe('Server Lifecycle Workflow', () => {
    it('should start server with default configuration', async () => {
      // Start server
      serverProcess = spawn('node', [CLI_PATH, 'start'], {
        env: { ...process.env, SMS_DEV_NO_UI: 'true' } // API only for testing
      })

      // Wait for server to start
      await waitForServer(4001)

      // Verify API is responding
      const response = await apiRequest('/health')
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('status', 'ok')
    })

    it('should start server with custom ports', async () => {
      // Start server with custom ports
      serverProcess = spawn('node', [
        CLI_PATH,
        'start',
        '--api-port', '5001',
        '--ui-port', '5000',
        '--no-ui'
      ])

      // Wait for custom port
      await waitForServer(5001)

      // Make request to custom port
      const response = await apiRequest('/health', { port: 5001 })
      expect(response.status).toBe(200)
    })

    it('should handle configuration file', async () => {
      // Create config file
      const configPath = path.join(TEST_DATA_DIR, 'sms-dev.config.js')
      const configContent = `
        module.exports = {
          apiPort: 6001,
          uiPort: 6000,
          logging: {
            level: 'debug',
            enabled: true
          }
        }
      `
      fs.writeFileSync(configPath, configContent)

      // Start server with config
      serverProcess = spawn('node', [
        CLI_PATH,
        'start',
        '--config', configPath,
        '--no-ui'
      ])

      // Wait for configured port
      await waitForServer(6001)

      // Verify config was loaded
      const response = await apiRequest('/health', { port: 6001 })
      expect(response.status).toBe(200)
    })

    it('should validate invalid configuration', async () => {
      // Create invalid config file
      const configPath = path.join(TEST_DATA_DIR, 'invalid.config.js')
      const invalidConfig = `
        module.exports = {
          apiPort: 80, // Invalid: requires root
          uiPort: 'not-a-number'
        }
      `
      fs.writeFileSync(configPath, invalidConfig)

      // Start server with invalid config
      const result = await new Promise<{ code: number; stderr: string }>((resolve) => {
        let stderr = ''
        const proc = spawn('node', [CLI_PATH, 'start', '--config', configPath])
        
        proc.stderr.on('data', (data) => {
          stderr += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 1, stderr })
        })
      })

      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain('Configuration validation failed')
      expect(result.stderr).toContain('apiPort:')
      expect(result.stderr).toContain('uiPort:')
    })
  })

  describe('Mock Phone Management Workflow', () => {
    beforeEach(async () => {
      // Start server for mock phone tests
      serverProcess = spawn('node', [CLI_PATH, 'start', '--no-ui'])
      await waitForServer(4001)
    })

    it('should create, list, and delete mock phones', async () => {
      // Create mock phone
      const createResult = await new Promise<{ stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [
          CLI_PATH,
          'mock-phone',
          'create',
          '--phone', '+1-234-567-8900',
          '--name', 'Test User'
        ])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', () => {
          resolve({ stdout })
        })
      })

      expect(createResult.stdout).toContain('Mock phone created')
      expect(createResult.stdout).toContain('+12345678900') // Sanitized

      // List mock phones
      const listResult = await new Promise<{ stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [CLI_PATH, 'mock-phone', 'list'])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', () => {
          resolve({ stdout })
        })
      })

      expect(listResult.stdout).toContain('Mock Phones')
      expect(listResult.stdout).toContain('+12345678900')
      expect(listResult.stdout).toContain('Test User')

      // Delete mock phone
      const deleteResult = await new Promise<{ stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [
          CLI_PATH,
          'mock-phone',
          'delete',
          '--phone', '+12345678900'
        ])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', () => {
          resolve({ stdout })
        })
      })

      expect(deleteResult.stdout).toContain('Mock phone +12345678900 deleted')
    })

    it('should validate phone number formats', async () => {
      const result = await new Promise<{ code: number; stderr: string }>((resolve) => {
        let stderr = ''
        const proc = spawn('node', [
          CLI_PATH,
          'mock-phone',
          'create',
          '--phone', 'invalid-phone'
        ])
        
        proc.stderr.on('data', (data) => {
          stderr += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 1, stderr })
        })
      })

      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain('phone:')
      expect(result.stderr).toContain('Invalid phone number format')
      expect(result.stderr).toContain('Suggestions:')
    })
  })

  describe('Message Export Workflow', () => {
    beforeEach(async () => {
      // Start server
      serverProcess = spawn('node', [CLI_PATH, 'start', '--no-ui'])
      await waitForServer(4001)

      // Create test data
      await apiRequest('/mock-phones', {
        method: 'POST',
        body: { phone: '+12345678900', name: 'Test User' }
      })

      // Send test messages
      await apiRequest('/messages/send', {
        method: 'POST',
        body: {
          from: '+10000000000',
          to: '+12345678900',
          body: 'Test message 1'
        }
      })

      await apiRequest('/messages/send', {
        method: 'POST',
        body: {
          from: '+12345678900',
          to: '+10000000000',
          body: 'Test reply'
        }
      })
    })

    it('should export messages to JSON', async () => {
      const outputPath = path.join(TEST_DATA_DIR, 'messages.json')
      
      const result = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [
          CLI_PATH,
          'export',
          '--type', 'messages',
          '--format', 'json',
          '--output', outputPath
        ])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Export completed')
      expect(fs.existsSync(outputPath)).toBe(true)

      const exportedData = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
      expect(exportedData).toHaveProperty('messages')
      expect(exportedData.messages).toHaveLength(2)
    })

    it('should export conversations to CSV', async () => {
      const outputPath = path.join(TEST_DATA_DIR, 'conversations.csv')
      
      const result = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [
          CLI_PATH,
          'export',
          '--type', 'conversations',
          '--format', 'csv',
          '--output', outputPath
        ])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(result.code).toBe(0)
      expect(fs.existsSync(outputPath)).toBe(true)

      const csvContent = fs.readFileSync(outputPath, 'utf8')
      expect(csvContent).toContain('id,participants,messageCount')
      expect(csvContent.split('\n').length).toBeGreaterThan(1)
    })

    it('should filter exports by date range', async () => {
      const outputPath = path.join(TEST_DATA_DIR, 'filtered.json')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const result = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [
          CLI_PATH,
          'export',
          '--from-date', tomorrow.toISOString(), // Future date
          '--output', outputPath
        ])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(result.code).toBe(0)
      
      const exportedData = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
      expect(exportedData.messages).toHaveLength(0) // No future messages
    })
  })

  describe('Flow Execution Workflow', () => {
    beforeEach(async () => {
      // Start server
      serverProcess = spawn('node', [CLI_PATH, 'start', '--no-ui'])
      await waitForServer(4001)
    })

    it('should create and execute conversation flows', async () => {
      // Create flow definition
      const flowPath = path.join(TEST_DATA_DIR, 'welcome-flow.json')
      const flowDefinition = {
        name: 'Welcome Flow',
        triggers: [
          { type: 'keyword', value: 'hello' }
        ],
        steps: [
          { type: 'message', content: 'Welcome! How can I help you?' },
          { type: 'delay', duration: 1000 },
          { type: 'message', content: 'Reply with "help" for assistance.' }
        ]
      }
      fs.writeFileSync(flowPath, JSON.stringify(flowDefinition, null, 2))

      // Create flow
      const createResult = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [
          CLI_PATH,
          'flow',
          'create',
          '--file', flowPath
        ])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(createResult.code).toBe(0)
      expect(createResult.stdout).toContain('Flow created successfully')

      // Extract flow ID from output
      const flowIdMatch = createResult.stdout.match(/ID: ([\w-]+)/)
      const flowId = flowIdMatch ? flowIdMatch[1] : 'unknown'

      // Execute flow
      const executeResult = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [
          CLI_PATH,
          'flow',
          'execute',
          '--flow-id', flowId,
          '--phone', '+12345678900'
        ])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(executeResult.code).toBe(0)
      expect(executeResult.stdout).toContain('Flow execution started')
    })

    it('should validate flow JSON structure', async () => {
      // Create invalid flow
      const flowPath = path.join(TEST_DATA_DIR, 'invalid-flow.json')
      const invalidFlow = {
        name: 'Invalid Flow'
        // Missing required triggers and steps
      }
      fs.writeFileSync(flowPath, JSON.stringify(invalidFlow))

      const result = await new Promise<{ code: number; stderr: string }>((resolve) => {
        let stderr = ''
        const proc = spawn('node', [
          CLI_PATH,
          'flow',
          'create',
          '--file', flowPath
        ])
        
        proc.stderr.on('data', (data) => {
          stderr += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 1, stderr })
        })
      })

      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain('missing required properties')
      expect(result.stderr).toContain('triggers')
      expect(result.stderr).toContain('steps')
    })
  })

  describe('Performance Testing Workflow', () => {
    beforeEach(async () => {
      // Start server
      serverProcess = spawn('node', [CLI_PATH, 'start', '--no-ui'])
      await waitForServer(4001)
    })

    it('should run performance tests', async () => {
      const result = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [
          CLI_PATH,
          'performance',
          'test',
          '--messages', '10',
          '--users', '2',
          '--duration', '5'
        ])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Performance test started')
      expect(result.stdout).toContain('Messages:')
      expect(result.stdout).toContain('Sent:')
    }, 10000) // Extended timeout for performance test

    it('should validate performance test parameters', async () => {
      const result = await new Promise<{ code: number; stderr: string }>((resolve) => {
        let stderr = ''
        const proc = spawn('node', [
          CLI_PATH,
          'performance',
          'test',
          '--messages', '20000', // Exceeds max 10000
          '--users', '200'        // Exceeds max 100
        ])
        
        proc.stderr.on('data', (data) => {
          stderr += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 1, stderr })
        })
      })

      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain('messages:')
      expect(result.stderr).toContain('maximum: 10000')
      expect(result.stderr).toContain('users:')
      expect(result.stderr).toContain('maximum: 100')
    })
  })

  describe('Configuration Management Workflow', () => {
    it('should initialize configuration file', async () => {
      const result = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [CLI_PATH, 'init'], {
          cwd: TEST_DATA_DIR
        })
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Configuration file created')
      
      const configPath = path.join(TEST_DATA_DIR, 'sms-dev.config.js')
      expect(fs.existsSync(configPath)).toBe(true)
      
      const configContent = fs.readFileSync(configPath, 'utf8')
      expect(configContent).toContain('module.exports')
      expect(configContent).toContain('apiPort: 4001')
    })

    it('should display current configuration', async () => {
      // Create config file
      const configPath = path.join(TEST_DATA_DIR, 'test.config.js')
      fs.writeFileSync(configPath, `
        module.exports = {
          apiPort: 7001,
          uiPort: 7000,
          webhookUrl: 'https://test.example.com/webhook'
        }
      `)

      const result = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [
          CLI_PATH,
          'config',
          '--config', configPath
        ])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Current Configuration:')
      expect(result.stdout).toContain('API Port: 7001')
      expect(result.stdout).toContain('UI Port: 7000')
      expect(result.stdout).toContain('Webhook URL: https://test.example.com/webhook')
    })
  })

  describe('Error Recovery Workflow', () => {
    it('should handle port conflicts gracefully', async () => {
      // Start first server
      serverProcess = spawn('node', [CLI_PATH, 'start', '--no-ui'])
      await waitForServer(4001)

      // Try to start second server on same port
      const result = await new Promise<{ code: number; stderr: string }>((resolve) => {
        let stderr = ''
        const proc = spawn('node', [CLI_PATH, 'start', '--no-ui'])
        
        proc.stderr.on('data', (data) => {
          stderr += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 1, stderr })
        })
      })

      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain('Port 4001 is already in use')
    })

    it('should handle invalid webhook URLs', async () => {
      const result = await new Promise<{ code: number; stderr: string }>((resolve) => {
        let stderr = ''
        const proc = spawn('node', [
          CLI_PATH,
          'start',
          '--webhook-url', 'not-a-url',
          '--no-ui'
        ])
        
        proc.stderr.on('data', (data) => {
          stderr += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 1, stderr })
        })
      })

      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain('webhookUrl:')
      expect(result.stderr).toContain('Invalid URL format')
    })

    it('should handle missing required arguments', async () => {
      const result = await new Promise<{ code: number; stderr: string }>((resolve) => {
        let stderr = ''
        const proc = spawn('node', [
          CLI_PATH,
          'mock-phone',
          'create'
          // Missing required --phone argument
        ])
        
        proc.stderr.on('data', (data) => {
          stderr += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 1, stderr })
        })
      })

      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain('Phone number is required')
    })
  })

  describe('Help and Documentation Workflow', () => {
    it('should display general help', async () => {
      const result = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [CLI_PATH, '--help'])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Usage: sms-dev [options] [command]')
      expect(result.stdout).toContain('Commands:')
      expect(result.stdout).toContain('start')
      expect(result.stdout).toContain('mock-phone')
      expect(result.stdout).toContain('export')
    })

    it('should display command-specific help', async () => {
      const result = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [CLI_PATH, 'mock-phone', '--help'])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Usage: sms-dev mock-phone')
      expect(result.stdout).toContain('--phone')
      expect(result.stdout).toContain('--name')
    })

    it('should display version information', async () => {
      const result = await new Promise<{ code: number; stdout: string }>((resolve) => {
        let stdout = ''
        const proc = spawn('node', [CLI_PATH, '--version'])
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        proc.on('exit', (code) => {
          resolve({ code: code || 0, stdout })
        })
      })

      expect(result.code).toBe(0)
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/) // Semantic version
    })
  })
})
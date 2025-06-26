import { spawn, ChildProcess } from 'child_process'
import detectPort from 'detect-port'
import { createApiServer } from '@relay-works/sms-dev-api'
import path from 'path'
import { fileURLToPath } from 'url'

interface StartOptions {
  apiPort: number
  uiPort: number
  startUI: boolean
  webhookUrl?: string
  verbose: boolean
}

let apiServerInstance: any = null
let uiProcess: ChildProcess | null = null

export async function startSmsDevServer(options: StartOptions): Promise<void> {
  // Check if ports are available
  const availableApiPort = await detectPort(options.apiPort)
  const availableUiPort = await detectPort(options.uiPort)

  if (availableApiPort !== options.apiPort) {
    throw new Error(`Port ${options.apiPort} is already in use. Try port ${availableApiPort}`)
  }

  if (options.startUI && availableUiPort !== options.uiPort) {
    throw new Error(`Port ${options.uiPort} is already in use. Try port ${availableUiPort}`)
  }

  // Start API server
  apiServerInstance = createApiServer({
    port: options.apiPort,
    cors: true,
    logging: options.verbose,
    webhookUrl: options.webhookUrl
  })

  await apiServerInstance.start()

  // Start UI server if requested
  if (options.startUI) {
    await startUiServer(options.uiPort, options.apiPort, options.verbose)
  }
}

async function startUiServer(uiPort: number, apiPort: number, verbose: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    // Get the path to the UI package
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const uiPackagePath = path.resolve(__dirname, '../../../../packages/sms-dev-ui')
    
    // Set environment variables for the UI server
    const env = {
      ...process.env,
      PORT: uiPort.toString(),
      NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}`,
      NODE_ENV: 'development'
    }

    if (verbose) {
      console.log(`📱 Starting UI server at ${uiPackagePath}`)
    }

    // Start the Next.js UI server
    uiProcess = spawn('npm', ['run', 'dev'], {
      cwd: uiPackagePath,
      env,
      stdio: verbose ? 'inherit' : 'pipe',
      shell: true
    })

    let resolved = false

    uiProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      if (verbose) {
        console.log('UI:', output)
      }
      // Resolve as soon as we see Next.js output - it's starting successfully
      if (output.includes('Next.js') || output.includes('Local:') || output.includes('Starting...')) {
        if (!resolved) {
          resolved = true
          resolve()
        }
      }
    })

    uiProcess.stderr?.on('data', (data) => {
      const output = data.toString()
      if (verbose) {
        console.error('UI Error:', output)
      }
      // Don't reject on stderr as Next.js often logs warnings there
    })

    uiProcess.on('error', (error) => {
      if (!resolved) {
        reject(new Error(`Failed to start UI server: ${error.message}`))
      }
    })

    uiProcess.on('exit', (code) => {
      if (code !== 0 && !resolved) {
        reject(new Error(`UI server exited with code ${code}`))
      }
    })

    // Timeout after 15 seconds - if it hasn't resolved by then, assume it's working
    setTimeout(() => {
      if (!resolved) {
        console.log('⚠️  UI server detection timed out, but process appears to be running')
        resolved = true
        resolve()
      }
    }, 15000)
  })
}

export async function stopSmsDevServer(): Promise<void> {
  const promises: Promise<void>[] = []

  // Stop API server
  if (apiServerInstance) {
    promises.push(apiServerInstance.stop())
    apiServerInstance = null
  }

  // Stop UI server
  if (uiProcess) {
    promises.push(new Promise((resolve) => {
      uiProcess!.kill('SIGTERM')
      uiProcess!.on('exit', () => {
        uiProcess = null
        resolve()
      })
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (uiProcess) {
          uiProcess.kill('SIGKILL')
          uiProcess = null
        }
        resolve()
      }, 5000)
    }))
  }

  await Promise.all(promises)
} 
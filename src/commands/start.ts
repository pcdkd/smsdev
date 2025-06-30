import { spawn, ChildProcess } from 'child_process'
import detectPort from 'detect-port'
import { createApiServer } from '@relay-works/sms-dev-api'
import path from 'path'
import { fileURLToPath } from 'url'
import { UIServer } from '../utils/uiServer.js'

interface StartOptions {
  apiPort: number
  uiPort: number
  startUI: boolean
  webhookUrl?: string
  verbose: boolean
}

let apiServerInstance: any = null
let uiServerInstance: UIServer | null = null

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
  if (verbose) {
    console.log(`📱 Starting bundled UI server on port ${uiPort}`)
  }

  uiServerInstance = new UIServer({
    port: uiPort,
    apiPort: apiPort,
    verbose: verbose
  })

  await uiServerInstance.start()
}

export async function stopSmsDevServer(): Promise<void> {
  const promises: Promise<void>[] = []

  // Stop API server
  if (apiServerInstance) {
    promises.push(apiServerInstance.stop())
    apiServerInstance = null
  }

  // Stop UI server
  if (uiServerInstance) {
    promises.push(uiServerInstance.stop())
    uiServerInstance = null
  }

  await Promise.all(promises)
} 
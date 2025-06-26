import { stopSmsDevServer as stopServer } from './start.js'

export async function stopSmsDevServer(): Promise<void> {
  await stopServer()
} 
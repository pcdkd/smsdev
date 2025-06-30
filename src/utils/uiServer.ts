import { createServer, IncomingMessage, ServerResponse } from 'http'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function dirname(filePath: string): string {
  return filePath.substring(0, filePath.lastIndexOf('/'))
}

interface UIServerOptions {
  port: number
  apiPort: number
  verbose?: boolean
}

export class UIServer {
  private server: any = null
  private options: UIServerOptions

  constructor(options: UIServerOptions) {
    this.options = options
  }

  private getContentType(filePath: string): string {
    const ext = extname(filePath).toLowerCase()
    const contentTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    }
    return contentTypes[ext] || 'text/plain'
  }

  private async serveFile(filePath: string, res: ServerResponse): Promise<void> {
    try {
      if (!existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
        return
      }

      const stats = statSync(filePath)
      if (stats.isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
        return
      }

      const content = readFileSync(filePath)
      const contentType = this.getContentType(filePath)
      
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Cache-Control': 'public, max-age=3600'
      })
      res.end(content)
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Internal Server Error')
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    const url = req.url || '/'
    const uiAssetsPath = join(__dirname, '../../ui-assets')

    // Handle API proxy
    if (url.startsWith('/v1/') || url.startsWith('/api/')) {
      // Proxy to API server
      res.writeHead(302, { 
        'Location': `http://localhost:${this.options.apiPort}${url}` 
      })
      res.end()
      return
    }

    // Handle Next.js static files
    if (url.startsWith('/_next/')) {
      // Remove /_next prefix and look in the right location
      const relativePath = url.substring(7) // Remove '/_next/' (7 characters)
      const filePath = join(uiAssetsPath, relativePath)
      await this.serveFile(filePath, res)
      return
    }

    // Handle other static assets
    if (url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      // Try to find the file in static directory first
      let filePath = join(uiAssetsPath, 'static', url.substring(1))
      if (!existsSync(filePath)) {
        // Try root of assets
        filePath = join(uiAssetsPath, url.substring(1))
      }
      if (existsSync(filePath)) {
        await this.serveFile(filePath, res)
        return
      }
    }

    // Handle root and other routes - serve the main HTML
    const indexPath = join(uiAssetsPath, 'server', 'app', 'index.html')
    if (existsSync(indexPath)) {
      await this.serveFile(indexPath, res)
    } else {
      // Fallback: try to find any HTML file
      const serverPath = join(uiAssetsPath, 'server', 'app')
      try {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>sms-dev - Virtual Phone</title>
    <style>
        body { 
            font-family: system-ui, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 2rem; 
            background: #0a0a0a; 
            color: #fff; 
        }
        .status { 
            padding: 1rem; 
            background: #1a1a1a; 
            border-radius: 8px; 
            border: 1px solid #333; 
        }
        .success { border-color: #22c55e; }
        .api-link { 
            color: #60a5fa; 
            text-decoration: none; 
        }
        .api-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="status success">
        <h1>📱 sms-dev Virtual Phone</h1>
        <p>SMS development environment is running!</p>
        <p><strong>API Server:</strong> <a href="http://localhost:${this.options.apiPort}" class="api-link">http://localhost:${this.options.apiPort}</a></p>
        <p><strong>UI Server:</strong> http://localhost:${this.options.port}</p>
        
        <h3>🚀 Quick Start:</h3>
        <ol>
            <li>Point your SDK to: <code>http://localhost:${this.options.apiPort}</code></li>
            <li>Send test messages via the API</li>
            <li>View messages in this interface</li>
        </ol>
        
        <p><em>The full UI is loading. If you don't see the virtual phone interface, the Next.js assets may still be initializing.</em></p>
    </div>

    <script>
        // Simple status check and auto-refresh if needed
        setInterval(() => {
            fetch('/v1/dev/status')
                .then(r => r.json())
                .then(data => console.log('API Status:', data))
                .catch(e => console.log('API not ready yet'))
        }, 5000)
    </script>
</body>
</html>`

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(htmlContent)
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('UI Server Error')
      }
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch(error => {
          if (this.options.verbose) {
            console.error('UI Server Error:', error)
          }
        })
      })

      this.server.listen(this.options.port, () => {
        if (this.options.verbose) {
          console.log(`📱 UI Server running on http://localhost:${this.options.port}`)
        }
        resolve()
      })

      this.server.on('error', (error: Error) => {
        reject(error)
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
} 
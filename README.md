# 📱 sms-dev

> **Local SMS development environment - the Mailtrap for SMS**

Test SMS applications without costs, phone numbers, or external dependencies. A complete local development tool that simulates SMS functionality with a beautiful web interface.

[![npm version](https://badge.fury.io/js/%40relay-works%2Fsms-dev.svg)](https://badge.fury.io/js/%40relay-works%2Fsms-dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

## ✨ Features

- 🚀 **Zero Setup** - Works instantly without configuration
- 📱 **Virtual Phone UI** - Beautiful dark mode interface for testing
- 🔄 **Real-time Updates** - WebSocket connections for live message flow
- 🪝 **Webhook Testing** - Forward messages to your application
- 🔍 **Message Search** - Find conversations and messages instantly
- 📊 **Performance Testing** - Load testing with configurable parameters
- 🤖 **Conversation Flows** - Automated message sequences with conditions
- 📤 **Export Data** - Export conversations as JSON or CSV
- ⚙️ **Flexible Config** - File, environment, or CLI configuration
- 🎨 **Developer First** - Designed for modern development workflows

## 🚀 Quick Start

### Global Installation

```bash
# Install globally via npm
npm install -g @relay-works/sms-dev

# Start the development environment
sms-dev start

# Open in browser
# API: http://localhost:4001
# UI: http://localhost:4000
```

### Local Installation

```bash
# Install locally in your project
npm install --save-dev @relay-works/sms-dev

# Add to package.json scripts
{
  "scripts": {
    "sms-dev": "sms-dev start"
  }
}

# Run in your project
npm run sms-dev
```

## 📖 Usage Examples

### Basic SMS Testing

```javascript
// Your application code
const response = await fetch('http://localhost:4001/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: '+1234567890',
    body: 'Hello from my app!'
  })
})

const message = await response.json()
console.log('Message sent:', message.id)
```

### Webhook Testing

```bash
# Start with webhook forwarding
sms-dev start --webhook-url http://localhost:3000/webhook/sms

# Your app will receive webhooks for all messages
```

### Configuration File

```javascript
// sms-dev.config.js
module.exports = {
  apiPort: 4001,
  uiPort: 4000,
  webhookUrl: 'http://localhost:3000/webhook/sms',
  cors: {
    enabled: true,
    origins: ['http://localhost:3000']
  }
}
```

## 🛠️ CLI Commands

### Core Commands

```bash
sms-dev start              # Start API and UI servers
sms-dev start --no-ui      # Start API only
sms-dev stop               # Stop all servers
sms-dev status             # Check server status
sms-dev config             # Show current configuration
```

### Configuration

```bash
sms-dev init               # Generate config file
sms-dev init --json        # Generate JSON config
sms-dev config --config custom.js  # Use custom config
```

### Testing Utilities

```bash
# Mock phone management
sms-dev mock-phone create --phone +1234567890 --name "Test User"
sms-dev mock-phone list
sms-dev mock-phone delete --phone +1234567890

# Conversation flows
sms-dev flow create --name "Welcome Flow"
sms-dev flow list
sms-dev flow execute --flow-id flow_123 --phone +1234567890

# Data export
sms-dev export messages --format json --output messages.json
sms-dev export conversations --format csv

# Performance testing
sms-dev perf stats
sms-dev perf load-test --messages 1000 --users 10 --duration 60
```

## 🔧 Configuration Options

### CLI Options

```bash
sms-dev start [options]

Options:
  -p, --port <port>         API server port (default: 4001)
  --ui-port <port>          UI server port (default: 4000)
  -w, --webhook-url <url>   Webhook URL for forwarding
  --cors-origins <origins>  CORS allowed origins
  --no-ui                   Disable UI server
  -v, --verbose             Enable verbose logging
  -c, --config <file>       Configuration file path
```

### Environment Variables

```bash
SMS_DEV_API_PORT=4001         # API server port
SMS_DEV_UI_PORT=4000          # UI server port
SMS_DEV_WEBHOOK_URL=...       # Webhook URL
SMS_DEV_CORS_ORIGINS=...      # CORS origins (comma-separated)
SMS_DEV_VERBOSE=true          # Enable verbose logging
SMS_DEV_NO_UI=true            # Disable UI server
```

### Configuration File

```javascript
// sms-dev.config.js
module.exports = {
  // Server configuration
  apiPort: 4001,
  uiPort: 4000,
  
  // Webhook testing
  webhookUrl: 'http://localhost:3000/webhook/sms',
  
  // CORS configuration
  cors: {
    enabled: true,
    origins: ['*'] // Allow all origins in development
  },
  
  // Logging
  logging: {
    enabled: true,
    level: 'info' // 'debug' | 'info' | 'warn' | 'error'
  }
}
```

## 🔌 API Documentation

### Send Message

```http
POST /v1/messages
Content-Type: application/json

{
  "to": "+1234567890",
  "from": "+15551234567",
  "body": "Hello world!"
}
```

### List Messages

```http
GET /v1/messages?limit=20&offset=0&search=hello&status=delivered
```

### Export Messages

```http
GET /v1/messages/export?format=json&phone=1234567890&from_date=2024-01-01
```

### Performance Stats

```http
GET /v1/dev/performance/stats
```

[View Full API Documentation →](https://smsdev.app/docs/api)

## 🎯 Framework Integration

### Express.js

```javascript
import express from 'express'

const app = express()

// Webhook endpoint for sms-dev
app.post('/webhook/sms', express.json(), (req, res) => {
  const { id, to, from, body, status } = req.body
  console.log('SMS received:', { id, to, from, body, status })
  
  // Process your SMS logic here
  
  res.json({ success: true })
})

app.listen(3000)

// Start sms-dev with webhook
// sms-dev start --webhook-url http://localhost:3000/webhook/sms
```

### Next.js

```javascript
// pages/api/webhook/sms.js
export default function handler(req, res) {
  if (req.method === 'POST') {
    const { id, to, from, body, status } = req.body
    console.log('SMS received:', { id, to, from, body, status })
    
    // Process your SMS logic here
    
    res.status(200).json({ success: true })
  } else {
    res.setHeader('Allow', ['POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
```

### React Testing

```javascript
// hooks/useSMSTesting.js
import { useState } from 'react'

export function useSMSTesting() {
  const [messages, setMessages] = useState([])
  
  const sendTestMessage = async (to, body) => {
    const response = await fetch('http://localhost:4001/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body })
    })
    
    const message = await response.json()
    setMessages(prev => [...prev, message])
    return message
  }
  
  return { messages, sendTestMessage }
}
```

## 🔍 Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :4001

# Use different ports
sms-dev start --port 4002 --ui-port 4003
```

### Permission Issues

```bash
# Install with correct permissions
sudo npm install -g @relay-works/sms-dev

# Or use npx without global install
npx @relay-works/sms-dev start
```

### Configuration Issues

```bash
# Debug configuration
sms-dev config
sms-dev start --show-config

# Reset configuration
rm sms-dev.config.js
sms-dev init
```

## 📦 Monorepo Development

If you're working with the sms-dev source code:

```bash
# Clone repository
git clone https://github.com/pcdkd/smsdev.git
cd smsdev

# Install dependencies
npm install

# Build packages
npm run build

# Run local development
./apps/sms-dev/dist/cli.js start
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/smsdev.git
cd smsdev

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

## 📄 License

MIT © [Relay](https://relay.works)

## 🔗 Links

- **Documentation**: [smsdev.app](https://smsdev.app)
- **GitHub**: [github.com/pcdkd/smsdev](https://github.com/pcdkd/smsdev)
- **npm**: [npmjs.com/package/@relay-works/sms-dev](https://www.npmjs.com/package/@relay-works/sms-dev)
- **Relay Platform**: [relay.works](https://relay.works)

---

<p align="center">
  Made with ❤️ by the <a href="https://relay.works">Relay</a> team
</p> # Test automation - Sun Jun 30 10:47:30 EDT 2025

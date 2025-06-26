import express from 'express'

const app = express()
const port = 3000

// Middleware
app.use(express.json())

// Simple SMS sending endpoint
app.post('/send-sms', async (req, res) => {
  const { to, body } = req.body

  try {
    // Send via sms-dev (running on localhost:4001)
    const response = await fetch('http://localhost:4001/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        body,
        from: '+15551234567' // Default from number
      })
    })

    const message = await response.json()
    res.json({ success: true, messageId: message.id })
  } catch (error) {
    res.status(500).json({ error: 'Failed to send SMS' })
  }
})

// Webhook endpoint to receive messages from sms-dev
app.post('/webhook/sms', (req, res) => {
  const { id, to, from, body, status, created_at } = req.body
  
  console.log('📱 SMS Webhook received:', {
    id,
    to,
    from,
    body,
    status,
    created_at
  })

  // Process your SMS logic here
  // - Update database
  // - Send notifications
  // - Trigger other workflows

  res.json({ success: true })
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(port, () => {
  console.log(`🚀 Express app running on http://localhost:${port}`)
  console.log('')
  console.log('📱 Start sms-dev with webhook:')
  console.log(`   sms-dev start --webhook-url http://localhost:${port}/webhook/sms`)
  console.log('')
  console.log('✨ Test SMS sending:')
  console.log(`   curl -X POST http://localhost:${port}/send-sms \\`)
  console.log(`     -H "Content-Type: application/json" \\`)
  console.log(`     -d '{"to": "+1234567890", "body": "Hello from Express!"}'`)
}) 
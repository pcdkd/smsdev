// pages/api/send-sms.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  const { to, body } = req.body

  if (!to || !body) {
    return res.status(400).json({ 
      error: 'Missing required fields: to, body' 
    })
  }

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

    if (!response.ok) {
      throw new Error(`SMS API error: ${response.status}`)
    }

    const message = await response.json()
    res.status(200).json({ success: true, messageId: message.id })
  } catch (error) {
    console.error('SMS sending error:', error)
    res.status(500).json({ error: 'Failed to send SMS' })
  }
}

// pages/api/webhook/sms.js
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  const { id, to, from, body, status, created_at } = req.body
  
  console.log('📱 SMS Webhook received:', {
    id,
    to,
    from,
    body,
    status,
    created_at,
    timestamp: new Date().toISOString()
  })

  // Process your SMS logic here
  // - Update database (Prisma, MongoDB, etc.)
  // - Send push notifications
  // - Update user profiles
  // - Trigger email notifications
  // - Log analytics events

  // Example: Update user's SMS history
  // await updateUserSMSHistory(to, { id, from, body, status, created_at })

  // Example: Send real-time update to frontend
  // pusher.trigger('sms-channel', 'new-message', { id, to, from, body })

  res.status(200).json({ success: true })
}

// pages/api/conversations.js - Get conversation history
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    // Get conversations from sms-dev
    const response = await fetch('http://localhost:4001/v1/dev/conversations')
    const data = await response.json()
    
    res.status(200).json(data)
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
}

// pages/sms-dashboard.js - React component for SMS testing
import { useState, useEffect } from 'react'

export default function SMSDashboard() {
  const [conversations, setConversations] = useState([])
  const [messageText, setMessageText] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [sending, setSending] = useState(false)

  // Load conversations
  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => setConversations(data.conversations || []))
      .catch(console.error)
  }, [])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!phoneNumber || !messageText) return

    setSending(true)
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneNumber,
          body: messageText
        })
      })

      if (response.ok) {
        setMessageText('')
        alert('SMS sent successfully!')
        // Refresh conversations
        const convResponse = await fetch('/api/conversations')
        const convData = await convResponse.json()
        setConversations(convData.conversations || [])
      } else {
        alert('Failed to send SMS')
      }
    } catch (error) {
      console.error('Error sending SMS:', error)
      alert('Error sending SMS')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">SMS Testing Dashboard</h1>
      
      {/* Send SMS Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Send Test SMS</h2>
        <form onSubmit={sendMessage} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Message
            </label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Enter your message..."
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send SMS'}
          </button>
        </form>
      </div>

      {/* Conversations List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Conversations</h2>
        {conversations.length === 0 ? (
          <p className="text-gray-500">No conversations yet</p>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <div key={conv.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{conv.phoneNumber}</h3>
                    <p className="text-sm text-gray-600">{conv.last_message}</p>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(conv.lastActivity).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 
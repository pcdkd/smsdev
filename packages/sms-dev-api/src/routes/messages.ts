import { Router, Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { v4 as uuidv4 } from 'uuid'
import { 
  SendMessageRequest, 
  SendMessageResponse, 
  GetMessageResponse, 
  ListMessagesResponse,
  Message 
} from '@relay-works/sms-dev-types'

const router = Router()

// In-memory storage for development
const messages: Map<string, Message> = new Map()

// POST /v1/messages - Send a message
router.post('/', [
  body('to').isString().notEmpty().withMessage('to is required'),
  body('from').optional().isString(),
  body('body').isString().notEmpty().withMessage('body is required')
], async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: errors.array(),
      timestamp: new Date().toISOString()
    })
  }

  const { to, from, body: messageBody }: SendMessageRequest = req.body
  const messageId = `msg_${uuidv4().replace(/-/g, '')}`
  
  const message: Message = {
    id: messageId,
    to,
    from: from || '+15551234567', // Default from number for dev
    body: messageBody,
    status: 'queued',
    created_at: new Date().toISOString(),
    cost: 0.01 // Mock cost
  }

  // Store message
  messages.set(messageId, message)

  // Simulate async processing - update status after short delay
  setTimeout(() => {
    const storedMessage = messages.get(messageId)
    if (storedMessage) {
      storedMessage.status = 'sent'
      messages.set(messageId, storedMessage)
      
      // Emit real-time update via WebSocket
      const io = (req as any).io
      if (io) {
        io.emit('message:updated', storedMessage)
      }

      // Simulate delivery after another delay
      setTimeout(() => {
        const deliveredMessage = messages.get(messageId)
        if (deliveredMessage) {
          deliveredMessage.status = 'delivered'
          deliveredMessage.delivered_at = new Date().toISOString()
          messages.set(messageId, deliveredMessage)
          
          if (io) {
            io.emit('message:updated', deliveredMessage)
          }
        }
      }, 1000)
    }
  }, 500)

  // Return immediate response (like production API)
  const response: SendMessageResponse = {
    id: message.id,
    to: message.to,
    from: message.from,
    body: message.body,
    status: 'queued',
    created_at: message.created_at,
    cost: message.cost!
  }

  res.status(201).json(response)
})

// GET /v1/messages/:id - Get a specific message
router.get('/:id', [
  param('id').isString().notEmpty().withMessage('Message ID is required')
], (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid message ID',
      timestamp: new Date().toISOString()
    })
  }

  const messageId = req.params.id!
  const message = messages.get(messageId)

  if (!message) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Message not found',
      timestamp: new Date().toISOString()
    })
  }

  const response: GetMessageResponse = message
  res.json(response)
})

// GET /v1/messages - List messages with pagination and search/filtering
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('status').optional().isIn(['queued', 'sent', 'delivered', 'failed']).withMessage('Invalid status'),
  query('phone').optional().isString().withMessage('Phone must be a string'),
  query('from_date').optional().isISO8601().withMessage('from_date must be ISO 8601 format'),
  query('to_date').optional().isISO8601().withMessage('to_date must be ISO 8601 format')
], (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid query parameters',
      details: errors.array(),
      timestamp: new Date().toISOString()
    })
  }

  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0
  const search = req.query.search as string
  const status = req.query.status as string
  const phone = req.query.phone as string
  const fromDate = req.query.from_date as string
  const toDate = req.query.to_date as string

  let filteredMessages = Array.from(messages.values())

  // Apply search filter (searches in message body, to, and from fields)
  if (search) {
    const searchLower = search.toLowerCase()
    filteredMessages = filteredMessages.filter(message =>
      message.body.toLowerCase().includes(searchLower) ||
      message.to.toLowerCase().includes(searchLower) ||
      message.from.toLowerCase().includes(searchLower)
    )
  }

  // Apply status filter
  if (status) {
    filteredMessages = filteredMessages.filter(message => message.status === status)
  }

  // Apply phone number filter (matches both to and from)
  if (phone) {
    const phoneLower = phone.toLowerCase()
    filteredMessages = filteredMessages.filter(message =>
      message.to.toLowerCase().includes(phoneLower) ||
      message.from.toLowerCase().includes(phoneLower)
    )
  }

  // Apply date range filters
  if (fromDate) {
    const fromTimestamp = new Date(fromDate).getTime()
    filteredMessages = filteredMessages.filter(message =>
      new Date(message.created_at).getTime() >= fromTimestamp
    )
  }

  if (toDate) {
    const toTimestamp = new Date(toDate).getTime()
    filteredMessages = filteredMessages.filter(message =>
      new Date(message.created_at).getTime() <= toTimestamp
    )
  }

  // Sort by creation date (newest first)
  filteredMessages.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const total = filteredMessages.length
  const paginatedMessages = filteredMessages.slice(offset, offset + limit)

  const response: ListMessagesResponse = {
    messages: paginatedMessages,
    pagination: {
      limit,
      offset,
      total,
      has_more: offset + limit < total
    }
  }

  res.json(response)
})

// GET /v1/messages/export - Export messages as JSON or CSV
router.get('/export', [
  query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv'),
  query('phone').optional().isString().withMessage('Phone must be a string'),
  query('from_date').optional().isISO8601().withMessage('from_date must be ISO 8601 format'),
  query('to_date').optional().isISO8601().withMessage('to_date must be ISO 8601 format')
], (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid query parameters',
      details: errors.array(),
      timestamp: new Date().toISOString()
    })
  }

  const format = req.query.format as string || 'json'
  const phone = req.query.phone as string
  const fromDate = req.query.from_date as string
  const toDate = req.query.to_date as string

  let exportMessages = Array.from(messages.values())

  // Apply filters
  if (phone) {
    const phoneLower = phone.toLowerCase()
    exportMessages = exportMessages.filter(message =>
      message.to.toLowerCase().includes(phoneLower) ||
      message.from.toLowerCase().includes(phoneLower)
    )
  }

  if (fromDate) {
    const fromTimestamp = new Date(fromDate).getTime()
    exportMessages = exportMessages.filter(message =>
      new Date(message.created_at).getTime() >= fromTimestamp
    )
  }

  if (toDate) {
    const toTimestamp = new Date(toDate).getTime()
    exportMessages = exportMessages.filter(message =>
      new Date(message.created_at).getTime() <= toTimestamp
    )
  }

  // Sort by creation date (oldest first for export)
  exportMessages.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  if (format === 'csv') {
    // Generate CSV content
    const csvHeaders = ['ID', 'To', 'From', 'Body', 'Status', 'Created At', 'Delivered At', 'Cost']
    const csvRows = exportMessages.map(msg => [
      msg.id,
      msg.to,
      msg.from,
      `"${msg.body.replace(/"/g, '""')}"`, // Escape quotes in CSV
      msg.status,
      msg.created_at,
      msg.delivered_at || '',
      msg.cost || ''
    ])

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.join(','))
      .join('\n')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `sms-dev-messages-${timestamp}.csv`

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csvContent)
  } else {
    // Generate JSON content
    const jsonData = {
      export_info: {
        timestamp: new Date().toISOString(),
        total_messages: exportMessages.length,
        filters: {
          ...(phone && { phone }),
          ...(fromDate && { from_date: fromDate }),
          ...(toDate && { to_date: toDate })
        }
      },
      messages: exportMessages
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `sms-dev-messages-${timestamp}.json`

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.json(jsonData)
  }
})

// GET /v1/conversations/export - Export conversations as JSON or CSV
router.get('/conversations/export', [
  query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv')
], (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid query parameters',
      details: errors.array(),
      timestamp: new Date().toISOString()
    })
  }

  const format = req.query.format as string || 'json'

  // Group messages by conversation (phone number pairs)
  const conversationMap = new Map<string, Message[]>()
  
  Array.from(messages.values()).forEach(message => {
    // Create conversation key from sorted phone numbers
    const phones = [message.to, message.from].sort()
    const conversationKey = phones.join('|')
    
    if (!conversationMap.has(conversationKey)) {
      conversationMap.set(conversationKey, [])
    }
    conversationMap.get(conversationKey)!.push(message)
  })

  // Convert to conversation format
  const conversations = Array.from(conversationMap.entries()).map(([key, msgs]) => {
    const sortedMessages = msgs.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    
    const [phone1, phone2] = key.split('|')
    
    return {
      id: key,
      participants: [phone1, phone2],
      message_count: msgs.length,
      first_message: sortedMessages[0]?.created_at,
      last_message: sortedMessages[sortedMessages.length - 1]?.created_at,
      messages: sortedMessages
    }
  })

  if (format === 'csv') {
    // Generate CSV for conversations summary
    const csvHeaders = ['Conversation ID', 'Participants', 'Message Count', 'First Message', 'Last Message']
    const csvRows = conversations.map(conv => [
      conv.id,
      conv.participants.join(' ↔ '),
      conv.message_count,
      conv.first_message || '',
      conv.last_message || ''
    ])

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.join(','))
      .join('\n')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `sms-dev-conversations-${timestamp}.csv`

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csvContent)
  } else {
    // Generate JSON content
    const jsonData = {
      export_info: {
        timestamp: new Date().toISOString(),
        total_conversations: conversations.length,
        total_messages: Array.from(messages.values()).length
      },
      conversations
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `sms-dev-conversations-${timestamp}.json`

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.json(jsonData)
  }
})

export { router as messagesRouter } 
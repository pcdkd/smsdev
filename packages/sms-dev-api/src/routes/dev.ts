import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { body, param, query, validationResult } from 'express-validator'

const router = Router()

// Mock phone number storage
interface MockPhone {
  id: string
  phone: string
  name?: string
  type: 'business' | 'personal' | 'test'
  created_at: string
  capabilities: {
    sms: boolean
    voice?: boolean
    mms?: boolean
  }
  metadata?: Record<string, any>
}

const mockPhones: Map<string, MockPhone> = new Map()

// Automated conversation flow storage
interface ConversationFlow {
  id: string
  name: string
  description?: string
  trigger: {
    type: 'keyword' | 'phone' | 'time'
    value: string
  }
  steps: Array<{
    id: string
    type: 'send' | 'wait' | 'condition'
    delay?: number // milliseconds
    message?: string
    condition?: string
    from?: string
    to?: string
  }>
  active: boolean
  created_at: string
}

const conversationFlows: Map<string, ConversationFlow> = new Map()

// GET /v1/dev/conversations - List conversations (existing)
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    // Get messages from the messages storage
    const messagesResponse = await fetch('http://localhost:4001/v1/messages')
    const messagesData = await messagesResponse.json()
    const messages = messagesData.messages || []

    // Group messages by conversation (phone number pairs)
    const conversationMap = new Map()
    
    messages.forEach((message: any) => {
      // Determine the conversation key (other party's phone number)
      const conversationKey = message.to.startsWith('+1555') ? message.from : message.to
      
      if (!conversationMap.has(conversationKey)) {
        conversationMap.set(conversationKey, {
          phoneNumber: conversationKey,
          messages: [],
          lastActivity: message.created_at,
          unreadCount: 0
        })
      }
      
      const conversation = conversationMap.get(conversationKey)
      conversation.messages.push(message)
      
      // Update last activity if this message is newer
      if (new Date(message.created_at) > new Date(conversation.lastActivity)) {
        conversation.lastActivity = message.created_at
      }
    })

    // Convert to array and sort by last activity
    const conversations = Array.from(conversationMap.values()).sort((a, b) => 
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    )

    res.json({
      conversations,
      total: conversations.length
    })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    // Fallback to empty conversations if there's an error
    res.json({
      conversations: [],
      total: 0
    })
  }
})

// POST /v1/dev/mock-phones - Create a mock phone number
router.post('/mock-phones', [
  body('phone').isString().notEmpty().withMessage('Phone number is required'),
  body('name').optional().isString().withMessage('Name must be a string'),
  body('type').optional().isIn(['business', 'personal', 'test']).withMessage('Type must be business, personal, or test'),
  body('capabilities.sms').optional().isBoolean().withMessage('SMS capability must be boolean'),
  body('capabilities.voice').optional().isBoolean().withMessage('Voice capability must be boolean'),
  body('capabilities.mms').optional().isBoolean().withMessage('MMS capability must be boolean')
], (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: errors.array(),
      timestamp: new Date().toISOString()
    })
  }

  const { phone, name, type = 'test', capabilities = { sms: true }, metadata = {} } = req.body

  // Check if phone already exists
  const existingPhone = Array.from(mockPhones.values()).find(p => p.phone === phone)
  if (existingPhone) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Phone number already exists',
      timestamp: new Date().toISOString()
    })
  }

  const mockPhone: MockPhone = {
    id: `mock_${uuidv4().replace(/-/g, '')}`,
    phone,
    name,
    type,
    created_at: new Date().toISOString(),
    capabilities,
    metadata
  }

  mockPhones.set(mockPhone.id, mockPhone)

  res.status(201).json(mockPhone)
})

// GET /v1/dev/mock-phones - List mock phone numbers
router.get('/mock-phones', [
  query('type').optional().isIn(['business', 'personal', 'test']).withMessage('Invalid type filter'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
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

  const type = req.query.type as string
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0

  let phones = Array.from(mockPhones.values())

  // Apply type filter
  if (type) {
    phones = phones.filter(phone => phone.type === type)
  }

  // Sort by creation date
  phones.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const total = phones.length
  const paginatedPhones = phones.slice(offset, offset + limit)

  res.json({
    phones: paginatedPhones,
    pagination: {
      limit,
      offset,
      total,
      has_more: offset + limit < total
    }
  })
})

// DELETE /v1/dev/mock-phones/:id - Delete a mock phone number
router.delete('/mock-phones/:id', [
  param('id').isString().notEmpty().withMessage('Phone ID is required')
], (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid phone ID',
      timestamp: new Date().toISOString()
    })
  }

  const phoneId = req.params.id!
  const phone = mockPhones.get(phoneId)

  if (!phone) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Mock phone number not found',
      timestamp: new Date().toISOString()
    })
  }

  mockPhones.delete(phoneId)

  res.status(204).send()
})

// POST /v1/dev/conversation-flows - Create automated conversation flow
router.post('/conversation-flows', [
  body('name').isString().notEmpty().withMessage('Flow name is required'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('trigger.type').isIn(['keyword', 'phone', 'time']).withMessage('Trigger type must be keyword, phone, or time'),
  body('trigger.value').isString().notEmpty().withMessage('Trigger value is required'),
  body('steps').isArray({ min: 1 }).withMessage('At least one step is required'),
  body('steps.*.type').isIn(['send', 'wait', 'condition']).withMessage('Step type must be send, wait, or condition')
], (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: errors.array(),
      timestamp: new Date().toISOString()
    })
  }

  const { name, description, trigger, steps } = req.body

  const flow: ConversationFlow = {
    id: `flow_${uuidv4().replace(/-/g, '')}`,
    name,
    description,
    trigger,
    steps: steps.map((step: any, index: number) => ({
      id: `step_${index + 1}`,
      ...step
    })),
    active: true,
    created_at: new Date().toISOString()
  }

  conversationFlows.set(flow.id, flow)

  res.status(201).json(flow)
})

// GET /v1/dev/conversation-flows - List conversation flows
router.get('/conversation-flows', [
  query('active').optional().isBoolean().withMessage('Active filter must be boolean'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
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

  const activeFilter = req.query.active
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0

  let flows = Array.from(conversationFlows.values())

  // Apply active filter
  if (activeFilter !== undefined) {
    flows = flows.filter(flow => flow.active === (activeFilter === 'true'))
  }

  // Sort by creation date
  flows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const total = flows.length
  const paginatedFlows = flows.slice(offset, offset + limit)

  res.json({
    flows: paginatedFlows,
    pagination: {
      limit,
      offset,
      total,
      has_more: offset + limit < total
    }
  })
})

// POST /v1/dev/conversation-flows/:id/execute - Execute conversation flow
router.post('/conversation-flows/:id/execute', [
  param('id').isString().notEmpty().withMessage('Flow ID is required'),
  body('phone').optional().isString().withMessage('Phone number must be a string'),
  body('context').optional().isObject().withMessage('Context must be an object')
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

  const flowId = req.params.id!
  const { phone, context = {} } = req.body
  
  const flow = conversationFlows.get(flowId)
  if (!flow) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Conversation flow not found',
      timestamp: new Date().toISOString()
    })
  }

  if (!flow.active) {
    return res.status(400).json({
      error: 'Flow Inactive',
      message: 'Conversation flow is not active',
      timestamp: new Date().toISOString()
    })
  }

  const executionId = `exec_${uuidv4().replace(/-/g, '')}`
  
  // Execute flow steps asynchronously
  executeFlowSteps(flow, phone, context, executionId, req)

  res.status(202).json({
    execution_id: executionId,
    flow_id: flow.id,
    status: 'started',
    message: 'Conversation flow execution started'
  })
})

// Helper function to execute flow steps
async function executeFlowSteps(
  flow: ConversationFlow, 
  targetPhone: string | undefined,
  context: Record<string, any>,
  executionId: string,
  req: Request
) {
  const io = (req as any).io
  
  for (const step of flow.steps) {
    try {
      switch (step.type) {
        case 'wait':
          if (step.delay) {
            await new Promise(resolve => setTimeout(resolve, step.delay))
          }
          break
          
        case 'send':
          if (step.message && targetPhone) {
            // Simulate sending a message via the messages API
            const messageData = {
              to: targetPhone,
              from: step.from || '+15551234567',
              body: interpolateMessage(step.message, context)
            }
            
            // Emit message via WebSocket if available
            if (io) {
              io.emit('flow:message', {
                execution_id: executionId,
                flow_id: flow.id,
                step_id: step.id,
                message: messageData
              })
            }
          }
          break
          
        case 'condition':
          // Simple condition evaluation (can be expanded)
          if (step.condition && !evaluateCondition(step.condition, context)) {
            // Skip remaining steps if condition fails
            break
          }
          break
      }
      
      // Add small delay between steps
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (error) {
      console.error(`Error executing step ${step.id} in flow ${flow.id}:`, error)
      
      if (io) {
        io.emit('flow:error', {
          execution_id: executionId,
          flow_id: flow.id,
          step_id: step.id,
          error: 'Step execution failed'
        })
      }
      break
    }
  }
  
  if (io) {
    io.emit('flow:completed', {
      execution_id: executionId,
      flow_id: flow.id,
      status: 'completed'
    })
  }
}

// Helper function to interpolate message templates
function interpolateMessage(message: string, context: Record<string, any>): string {
  return message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return context[key] || match
  })
}

// Helper function to evaluate simple conditions
function evaluateCondition(condition: string, context: Record<string, any>): boolean {
  // Simple condition evaluation - can be expanded with proper parser
  try {
    // Replace template variables
    const interpolated = condition.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = context[key]
      return typeof value === 'string' ? `"${value}"` : String(value)
    })
    
    // Very basic evaluation (in production, use a safe expression evaluator)
    return eval(interpolated)
  } catch {
    return false
  }
}

// GET /v1/dev/performance/stats - Get performance statistics
router.get('/performance/stats', (req: Request, res: Response) => {
  const stats = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    api: {
      total_messages: mockPhones.size, // Using mockPhones as proxy for message count
      total_conversations: Math.ceil(mockPhones.size / 2),
      active_flows: Array.from(conversationFlows.values()).filter(f => f.active).length,
      mock_phones: mockPhones.size
    },
    system: {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  }

  res.json(stats)
})

// POST /v1/dev/performance/load-test - Run load test
router.post('/performance/load-test', [
  body('message_count').optional().isInt({ min: 1, max: 1000 }).withMessage('Message count must be between 1 and 1000'),
  body('concurrent_users').optional().isInt({ min: 1, max: 50 }).withMessage('Concurrent users must be between 1 and 50'),
  body('duration_seconds').optional().isInt({ min: 1, max: 300 }).withMessage('Duration must be between 1 and 300 seconds')
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

  const messageCount = req.body.message_count || 100
  const concurrentUsers = req.body.concurrent_users || 5
  const durationSeconds = req.body.duration_seconds || 30

  const testId = `load_${uuidv4().replace(/-/g, '')}`
  const startTime = Date.now()

  // Start load test asynchronously
  runLoadTest(testId, messageCount, concurrentUsers, durationSeconds, req)

  res.status(202).json({
    test_id: testId,
    status: 'started',
    parameters: {
      message_count: messageCount,
      concurrent_users: concurrentUsers,
      duration_seconds: durationSeconds
    },
    message: 'Load test started'
  })
})

// Helper function to run load test
async function runLoadTest(
  testId: string,
  messageCount: number,
  concurrentUsers: number,
  durationSeconds: number,
  req: Request
) {
  const io = (req as any).io
  const startTime = Date.now()
  let completedRequests = 0
  let errors = 0

  const sendMessage = async () => {
    try {
      // Simulate API call latency
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
      completedRequests++
    } catch {
      errors++
    }
  }

  // Run concurrent load
  const promises: Promise<void>[] = []
  const messagesPerUser = Math.ceil(messageCount / concurrentUsers)

  for (let user = 0; user < concurrentUsers; user++) {
    const userPromise = async () => {
      for (let msg = 0; msg < messagesPerUser && completedRequests < messageCount; msg++) {
        await sendMessage()
        
        // Check if duration exceeded
        if (Date.now() - startTime > durationSeconds * 1000) {
          break
        }
      }
    }
    promises.push(userPromise())
  }

  await Promise.all(promises)

  const endTime = Date.now()
  const actualDuration = (endTime - startTime) / 1000

  const results = {
    test_id: testId,
    status: 'completed',
    results: {
      total_requests: completedRequests,
      failed_requests: errors,
      success_rate: ((completedRequests - errors) / completedRequests * 100).toFixed(2),
      duration_seconds: actualDuration,
      requests_per_second: (completedRequests / actualDuration).toFixed(2),
      average_response_time: (actualDuration * 1000 / completedRequests).toFixed(2)
    },
    completed_at: new Date().toISOString()
  }

  if (io) {
    io.emit('load-test:completed', results)
  }
}

export { router as devRouter } 
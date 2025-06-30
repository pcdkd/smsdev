import { Server as SocketIOServer } from 'socket.io'
import { SocketEvents } from '@relay-works/sms-dev-types'
import { WebhookService } from './webhookService.js'

export function setupSocketHandlers(io: SocketIOServer, webhookService: WebhookService) {
  io.on('connection', (socket) => {
    console.log(`📱 Client connected: ${socket.id}`)

    // Handle conversation joining
    socket.on('conversation:join', (data: SocketEvents['conversation:join']) => {
      const room = `conversation:${data.phoneNumber}`
      socket.join(room)
      console.log(`📞 Client ${socket.id} joined conversation: ${data.phoneNumber}`)
    })

    // Handle conversation leaving
    socket.on('conversation:leave', (data: SocketEvents['conversation:leave']) => {
      const room = `conversation:${data.phoneNumber}`
      socket.leave(room)
      console.log(`📴 Client ${socket.id} left conversation: ${data.phoneNumber}`)
    })

    // Handle reply sending (from virtual phone UI)
    socket.on('reply:send', async (data: SocketEvents['reply:send']) => {
      console.log(`💬 Reply from ${data.from} to ${data.to}: ${data.body}`)
      
      // Create message object for the inbound reply
      const inboundMessage = {
        id: generateId(),
        to: data.to,
        from: data.from,
        body: data.body,
        status: 'delivered' as const,
        created_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        cost: 0.01
      }

      // Broadcast to all clients in this conversation
      const room = `conversation:${data.to}`
      socket.to(room).emit('message:new', inboundMessage)

      // Send webhook for inbound message (simulate real SMS reply)
      try {
        await webhookService.sendInboundMessageWebhook(inboundMessage)
      } catch (error) {
        console.error('Failed to send webhook:', error)
      }
    })

    socket.on('disconnect', () => {
      console.log(`📴 Client disconnected: ${socket.id}`)
    })
  })
}

// Utility function to generate message IDs
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
} 
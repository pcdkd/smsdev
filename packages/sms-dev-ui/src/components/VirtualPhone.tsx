'use client'

import React, { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { Message, Conversation } from '@relay-works/sms-dev-types'
import ConversationList from './ConversationList'
import ChatInterface from './ChatInterface'

export default function VirtualPhone() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  // Initialize socket connection
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const socketInstance = io(apiUrl)

    socketInstance.on('connect', () => {
      console.log('📡 Connected to sms-dev API')
      setConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('📴 Disconnected from sms-dev API')
      setConnected(false)
    })

    // Listen for new messages
    socketInstance.on('message:new', (message: Message) => {
      console.log('📨 New message received:', message)
      updateConversationWithMessage(message)
    })

    // Listen for message updates
    socketInstance.on('message:updated', (message: Message) => {
      console.log('📝 Message updated:', message)
      updateConversationWithMessage(message)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  // Load initial conversations
  useEffect(() => {
    if (connected) {
      loadConversations()
    }
  }, [connected])

  const loadConversations = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
      const response = await fetch(`${apiUrl}/v1/dev/conversations`)
      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const updateConversationWithMessage = (message: Message) => {
    setConversations(prev => {
      const updated = [...prev]
      const conversationIndex = updated.findIndex(c => 
        c.phoneNumber === message.to || c.phoneNumber === message.from
      )

      const phoneNumber = message.to.startsWith('+1555') ? message.from : message.to

      if (conversationIndex >= 0) {
        // Update existing conversation
        const conversation = updated[conversationIndex]
        if (conversation) {
          const messageExists = conversation.messages.some(m => m.id === message.id)
          
          if (!messageExists) {
            conversation.messages.push(message)
          } else {
            // Update existing message
            const msgIndex = conversation.messages.findIndex(m => m.id === message.id)
            if (msgIndex >= 0) {
              conversation.messages[msgIndex] = message
            }
          }
          
          conversation.lastActivity = message.created_at
          conversation.messages.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        }
      } else {
        // Create new conversation
        updated.push({
          phoneNumber,
          messages: [message],
          lastActivity: message.created_at,
          unreadCount: message.from !== phoneNumber ? 1 : 0
        })
      }

      return updated.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      )
    })
  }

  const sendReply = (to: string, body: string) => {
    if (socket && activeConversation) {
      socket.emit('reply:send', {
        to,
        from: activeConversation,
        body
      })
    }
  }

  const selectConversation = (phoneNumber: string) => {
    setActiveConversation(phoneNumber)
    
    // Join the conversation room for real-time updates
    if (socket) {
      socket.emit('conversation:join', { phoneNumber })
    }

    // Mark as read
    setConversations(prev => 
      prev.map(c => 
        c.phoneNumber === phoneNumber 
          ? { ...c, unreadCount: 0 }
          : c
      )
    )
  }

  const activeConversationData = conversations.find(c => c.phoneNumber === activeConversation)

  return (
    <div className="h-full flex bg-background">
      {/* Sidebar - Conversation List */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Conversations</h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              connected ? 'bg-green-500 status-indicator' : 'bg-muted-foreground'
            }`}></div>
            {connected ? 'Ready to receive messages' : 'Connecting...'}
          </p>
        </div>
        <ConversationList
          conversations={conversations}
          activeConversation={activeConversation}
          onSelectConversation={selectConversation}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        {activeConversationData ? (
          <ChatInterface
            conversation={activeConversationData}
            onSendReply={sendReply}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No conversation selected
              </h3>
              <p className="text-muted-foreground max-w-sm">
                Send a message via the API to start a conversation, then select it from the sidebar
              </p>
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground border border-dashed">
                <code className="text-xs">curl -X POST http://localhost:4001/v1/messages</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 
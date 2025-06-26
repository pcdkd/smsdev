import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Conversation, Message } from '@relay-works/sms-dev-types'

interface ChatInterfaceProps {
  conversation: Conversation
  onSendReply: (to: string, body: string) => void
}

export default function ChatInterface({ conversation, onSendReply }: ChatInterfaceProps) {
  const [replyText, setReplyText] = useState('')
  const [messageSearch, setMessageSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Filter messages based on search term
  const filteredMessages = useMemo(() => {
    if (!messageSearch.trim()) return conversation.messages
    
    const searchLower = messageSearch.toLowerCase()
    return conversation.messages.filter(message =>
      message.body.toLowerCase().includes(searchLower)
    )
  }, [conversation.messages, messageSearch])

  // Auto-scroll to bottom when new messages arrive (only if not searching)
  useEffect(() => {
    if (!messageSearch.trim()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversation.messages, messageSearch])

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault()
    if (replyText.trim()) {
      onSendReply(conversation.phoneNumber, replyText.trim())
      setReplyText('')
    }
  }

  const isOutgoing = (message: Message) => {
    return message.from === conversation.phoneNumber
  }

  const clearMessageSearch = () => {
    setMessageSearch('')
    setShowSearch(false)
  }

  // Highlight search term in message text
  const highlightMessageText = (text: string, term: string) => {
    if (!term.trim()) return text
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded">$1</mark>')
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {conversation.phoneNumber}
            </h3>
            <p className="text-sm text-muted-foreground">
              {messageSearch.trim() 
                ? `${filteredMessages.length} of ${conversation.messages.length} messages matching "${messageSearch}"`
                : `${conversation.messages.length} message${conversation.messages.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Search Toggle Button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-md transition-colors ${
                showSearch ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title="Search messages"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </button>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>Virtual Phone</span>
              <div className="w-2 h-2 bg-green-500 rounded-full status-indicator"></div>
            </div>
          </div>
        </div>

        {/* Message Search Bar */}
        {showSearch && (
          <div className="mt-3 relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <input
              type="text"
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
              placeholder="Search in this conversation..."
              className="w-full pl-10 pr-8 py-2 text-sm bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus-ring"
              autoFocus
            />
            {messageSearch && (
              <button
                onClick={clearMessageSearch}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No messages found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try a different search term
              </p>
            </div>
          </div>
        ) : (
          filteredMessages.map((message) => (
            <div
              key={message.id}
              className={`flex message-bubble ${isOutgoing(message) ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg border shadow-sm ${
                  isOutgoing(message)
                    ? 'bg-primary text-primary-foreground border-primary/20'
                    : 'bg-card text-card-foreground border-border'
                }`}
              >
                <p 
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: highlightMessageText(message.body, messageSearch)
                  }}
                />
                <div className="flex items-center justify-between mt-2 space-x-2">
                  <span className={`text-xs ${
                    isOutgoing(message) ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}>
                    {formatMessageTime(message.created_at)}
                  </span>
                  <div className="flex items-center space-x-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      message.status === 'delivered' ? 'bg-green-500' :
                      message.status === 'sent' ? 'bg-blue-500' :
                      message.status === 'failed' ? 'bg-red-500' :
                      isOutgoing(message) ? 'bg-primary-foreground/50' : 'bg-muted-foreground'
                    }`}></div>
                    {isOutgoing(message) && (
                      <span className={`text-xs ${
                        isOutgoing(message) ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        {message.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Input */}
      <div className="bg-card/50 backdrop-blur-sm border-t border-border p-4">
        <form onSubmit={handleSendReply} className="flex space-x-3">
          <div className="flex-1">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${conversation.phoneNumber}...`}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus-ring"
            />
          </div>
          <button
            type="submit"
            disabled={!replyText.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Send
          </button>
        </form>
        <div className="flex items-center mt-2 text-xs text-muted-foreground">
          <span className="mr-1">💡</span>
          <span>This reply will be sent from the virtual phone back to your application</span>
        </div>
      </div>
    </div>
  )
}

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
} 
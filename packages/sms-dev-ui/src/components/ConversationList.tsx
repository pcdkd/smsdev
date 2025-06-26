import React, { useState, useMemo } from 'react'
import { Conversation } from '@relay-works/sms-dev-types'

interface ConversationListProps {
  conversations: Conversation[]
  activeConversation: string | null
  onSelectConversation: (phoneNumber: string) => void
}

export default function ConversationList({
  conversations,
  activeConversation,
  onSelectConversation
}: ConversationListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Filter conversations based on search term and status
  const filteredConversations = useMemo(() => {
    let filtered = conversations

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(conversation => {
        // Search in phone number
        if (conversation.phoneNumber.toLowerCase().includes(searchLower)) {
          return true
        }
        
        // Search in message content
        return conversation.messages.some(message =>
          message.body.toLowerCase().includes(searchLower)
        )
      })
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(conversation => {
        if (statusFilter === 'unread') {
          return conversation.unreadCount > 0
        } else if (statusFilter === 'recent') {
          const oneDayAgo = new Date()
          oneDayAgo.setDate(oneDayAgo.getDate() - 1)
          return new Date(conversation.lastActivity) > oneDayAgo
        }
        return true
      })
    }

    return filtered
  }, [conversations, searchTerm, statusFilter])

  const clearSearch = () => {
    setSearchTerm('')
    setStatusFilter('all')
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-lg">📭</span>
          </div>
          <p className="text-sm text-muted-foreground">No conversations yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Send a message via API to start
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Search and Filter Section */}
      <div className="p-3 border-b border-border space-y-3">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-8 py-2 text-sm bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus-ring"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="flex space-x-1">
          {[
            { key: 'all', label: 'All', count: conversations.length },
            { key: 'unread', label: 'Unread', count: conversations.filter(c => c.unreadCount > 0).length },
            { key: 'recent', label: 'Recent', count: conversations.filter(c => {
              const oneDayAgo = new Date()
              oneDayAgo.setDate(oneDayAgo.getDate() - 1)
              return new Date(c.lastActivity) > oneDayAgo
            }).length }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                statusFilter === filter.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {filter.label}
              {filter.count > 0 && (
                <span className="ml-1 opacity-70">({filter.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search Results Info */}
        {(searchTerm || statusFilter !== 'all') && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filteredConversations.length} of {conversations.length} conversations
            </span>
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={clearSearch}
                className="text-primary hover:text-primary/80 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No matching conversations</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const isActive = activeConversation === conversation.phoneNumber
            const lastMessage = conversation.messages && conversation.messages.length > 0 
              ? conversation.messages[conversation.messages.length - 1] 
              : null
            const hasUnread = conversation.unreadCount > 0

            // Highlight search term in phone number and message
            const highlightText = (text: string, term: string) => {
              if (!term.trim()) return text
              const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
              return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded">$1</mark>')
            }

            return (
              <div
                key={conversation.phoneNumber}
                onClick={() => onSelectConversation(conversation.phoneNumber)}
                className={`p-4 border-b border-border cursor-pointer transition-colors hover:bg-accent/50 ${
                  isActive ? 'bg-accent border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 
                        className={`text-sm font-medium truncate ${
                          isActive ? 'text-foreground' : 'text-foreground'
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: highlightText(conversation.phoneNumber, searchTerm)
                        }}
                      />
                      {hasUnread && (
                        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                    {lastMessage && (
                      <div 
                        className={`text-xs mt-1 truncate ${
                          isActive ? 'text-muted-foreground' : 'text-muted-foreground'
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: highlightText(lastMessage.body, searchTerm)
                        }}
                      />
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        {formatLastActivity(conversation.lastActivity)}
                      </p>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <span>{conversation.messages?.length || 0} msg{(conversation.messages?.length || 0) !== 1 ? 's' : ''}</span>
                        {lastMessage && (
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            lastMessage.status === 'delivered' ? 'bg-green-500' :
                            lastMessage.status === 'sent' ? 'bg-blue-500' :
                            lastMessage.status === 'failed' ? 'bg-red-500' :
                            'bg-muted-foreground'
                          }`}></div>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasUnread && (
                    <div className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-2">
                      {conversation.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function formatLastActivity(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) {
    return 'Just now'
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
} 
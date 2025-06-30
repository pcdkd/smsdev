import React from 'react'
import './globals.css'

export const metadata = {
  title: 'sms-dev - Virtual Phone',
  description: 'Local SMS development and testing interface',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-card/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                    <span className="text-primary-foreground font-bold text-sm">📱</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold">sms-dev</h1>
                    <p className="text-sm text-muted-foreground">Virtual Phone Interface</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full status-indicator"></div>
                  <span className="text-sm text-muted-foreground">Connected</span>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
} 
import { jest } from '@jest/globals'

export class MockApiClient {
  get = jest.fn()
  post = jest.fn() 
  put = jest.fn()
  delete = jest.fn()
  
  constructor(public baseUrl: string = 'http://localhost:4001') {}
  
  reset() {
    this.get.mockReset()
    this.post.mockReset()
    this.put.mockReset()
    this.delete.mockReset()
  }
  
  // Helper methods for common mock responses
  mockSuccessResponse(data: any) {
    this.post.mockResolvedValue(data)
    this.get.mockResolvedValue(data)
    this.put.mockResolvedValue(data)
    this.delete.mockResolvedValue(data)
  }
  
  mockErrorResponse(status: number, message: string) {
    const error = new Error(message) as any
    error.status = status
    error.statusCode = status
    
    this.post.mockRejectedValue(error)
    this.get.mockRejectedValue(error)
    this.put.mockRejectedValue(error)
    this.delete.mockRejectedValue(error)
  }
  
  mockTimeoutResponse() {
    const timeoutError = new Error('Request timeout') as any
    timeoutError.name = 'AbortError'
    
    this.post.mockRejectedValue(timeoutError)
    this.get.mockRejectedValue(timeoutError)
    this.put.mockRejectedValue(timeoutError)
    this.delete.mockRejectedValue(timeoutError)
  }
}

// Global mock fetch for testing
export function mockFetch() {
  const mockFetch = jest.fn()
  global.fetch = mockFetch as any
  
  return {
    mockFetch,
    mockJsonResponse: (data: any, status: number = 200) => {
      mockFetch.mockResolvedValueOnce({
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(data),
        headers: new Headers()
      })
    },
    mockTextResponse: (text: string, status: number = 200) => {
      mockFetch.mockResolvedValueOnce({
        ok: status >= 200 && status < 300,
        status,
        text: jest.fn().mockResolvedValue(text),
        headers: new Headers()
      })
    },
    mockError: (error: Error) => {
      mockFetch.mockRejectedValueOnce(error)
    }
  }
}
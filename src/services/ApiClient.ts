import { ApiError, TimeoutError } from '../types/errors.js'
import { TIMEOUTS } from '../constants.js'

/**
 * Configuration options for the API client
 */
export interface ApiClientOptions {
  baseUrl?: string
  timeout?: number
  retries?: number
  retryDelay?: number
}

/**
 * HTTP method types
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * Request options for API calls
 */
interface RequestOptions {
  method: HttpMethod
  headers?: Record<string, string>
  body?: any
  timeout?: number
}

/**
 * API client with timeout, retry logic, and error handling
 */
export class ApiClient {
  private baseUrl: string
  private timeout: number
  private retries: number
  private retryDelay: number
  
  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:4001'
    this.timeout = options.timeout || TIMEOUTS.API_REQUEST
    this.retries = options.retries || 3
    this.retryDelay = options.retryDelay || 1000
  }
  
  /**
   * Make a GET request
   */
  async get<T>(endpoint: string, params?: URLSearchParams): Promise<T> {
    const url = params 
      ? `${this.buildUrl(endpoint)}?${params.toString()}`
      : this.buildUrl(endpoint)
      
    return this.request<T>({
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, url)
  }
  
  /**
   * Make a POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: data
    }, this.buildUrl(endpoint))
  }
  
  /**
   * Make a PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: data
    }, this.buildUrl(endpoint))
  }
  
  /**
   * Make a DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      headers: { 'Accept': 'application/json' }
    }, this.buildUrl(endpoint))
  }
  
  /**
   * Make a request with timeout and retry logic
   */
  private async request<T>(options: RequestOptions, url: string): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        return await this.makeRequest<T>(options, url)
      } catch (error: any) {
        lastError = error as Error
        
        // Don't retry on client errors (4xx) or validation errors
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error
        }
        
        // Don't retry on the last attempt
        if (attempt === this.retries) {
          break
        }
        
        // Wait before retrying (exponential backoff)
        await this.delay(this.retryDelay * attempt)
      }
    }
    
    throw lastError!
  }
  
  /**
   * Make a single HTTP request with timeout
   */
  private async makeRequest<T>(options: RequestOptions, url: string): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    
    try {
      const requestInit: RequestInit = {
        method: options.method,
        headers: options.headers,
        signal: controller.signal
      }
      
      if (options.body) {
        requestInit.body = JSON.stringify(options.body)
      }
      
      const response = await fetch(url, requestInit)
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status} ${response.statusText}`
        
        try {
          const errorBody = await response.json()
          if (errorBody.message) {
            errorMessage = errorBody.message
          }
        } catch {
          // If we can't parse error body, use status text
        }
        
        throw new ApiError(errorMessage, response.status, this.getEndpointFromUrl(url))
      }
      
      // Handle empty responses
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        return '' as unknown as T
      }
      
      return await response.json()
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new TimeoutError(`Request timed out after ${this.timeout}ms`, this.timeout)
      }
      
      if (error instanceof ApiError || error instanceof TimeoutError) {
        throw error
      }
      
      // Network or other errors
      throw new ApiError(
        `Network error: ${error.message || 'Unknown error'}`,
        0,
        this.getEndpointFromUrl(url)
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }
  
  /**
   * Build full URL from endpoint
   */
  private buildUrl(endpoint: string): string {
    const baseUrl = this.baseUrl.replace(/\/$/, '')
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${baseUrl}${cleanEndpoint}`
  }
  
  /**
   * Extract endpoint from full URL for error reporting
   */
  private getEndpointFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.pathname
    } catch {
      return url
    }
  }
  
  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Check if the API is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/v1/health')
      return true
    } catch {
      return false
    }
  }
  
  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl
  }
  
  /**
   * Update base URL
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl
  }
}
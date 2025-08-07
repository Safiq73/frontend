// API configuration and base client
import { BASE_URL } from '../config/api'

const API_BASE_URL = BASE_URL

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
  errors?: string[]
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  has_more: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  has_more: boolean
}

class ApiClient {
  private baseURL: string
  private token: string | null = null
  private isRefreshing = false
  private failedQueue: Array<{ resolve: Function; reject: Function }> = []

  constructor(baseURL: string) {
    this.baseURL = baseURL
    // Initialize token from localStorage (using the same key as authManager)
    this.token = localStorage.getItem('civic_access_token')
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      localStorage.setItem('civic_access_token', token)
    } else {
      localStorage.removeItem('civic_access_token')
    }
  }

  private processQueue(error: Error | null, token: string | null = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error)
      } else {
        resolve(token)
      }
    })
    
    this.failedQueue = []
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    }

    // Add request timeout for development
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    config.signal = controller.signal

    let lastError: Error | null = null
    const maxRetries = 2
    const retryDelay = 1000

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, config)
        clearTimeout(timeoutId)
        
        // Handle token refresh for 401 errors
        if (response.status === 401 && this.token && !endpoint.includes('/auth/')) {
          if (this.isRefreshing) {
            // Wait for the current refresh to complete
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject })
            }).then(() => {
              return this.request(endpoint, options)
            })
          }

          this.isRefreshing = true
          
          try {
            const newToken = await this.refreshTokenIfAvailable()
            if (newToken) {
              this.setToken(newToken)
              this.processQueue(null, newToken)
              config.headers = {
                ...config.headers,
                Authorization: `Bearer ${newToken}`
              }
              this.isRefreshing = false
              continue // Retry with new token
            }
          } catch (refreshError) {
            this.processQueue(refreshError as Error, null)
            this.isRefreshing = false
            throw refreshError
          }
        }
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          
          // Log detailed error for development, especially for 422 validation errors
          if (import.meta.env.DEV && response.status === 422) {
            console.error(`🔍 422 Validation Error Details:`, {
              status: response.status,
              endpoint,
              method: config.method,
              requestData: config.body ? JSON.parse(config.body as string) : null,
              errorData
            })
          }
          
          // Handle backend APIResponse error format
          const errorMessage = errorData.message || errorData.detail || errorData.error || `HTTP ${response.status}: ${response.statusText}`
          
          // Handle specific error types for development
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After')
            throw new Error(`Rate limit exceeded. Try again in ${retryAfter || '60'} seconds.`)
          }

          if (response.status === 404) {
            throw new Error(`Resource not found: ${endpoint}`)
          }

          if (response.status === 403) {
            throw new Error(`Access forbidden: ${errorMessage}`)
          }
          
          if (response.status >= 500 && attempt < maxRetries - 1) {
            lastError = new Error(`Server error: ${errorMessage}`)
            if (import.meta.env.DEV) {
              console.warn(`Server error on attempt ${attempt + 1}, retrying in ${retryDelay * (attempt + 1)}ms...`)
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
            continue // Retry on server errors
          }
          
          throw new Error(errorMessage)
        }

        const data = await response.json()
        
        // Log successful requests in development
        if (import.meta.env.DEV) {
          console.log(`✅ ${config.method || 'GET'} ${endpoint}`, { data })
        }

        return data
      } catch (error) {
        clearTimeout(timeoutId)
        lastError = error as Error
        
        if (lastError.name === 'AbortError') {
          throw new Error('Request timeout - please check your connection')
        }
        
        // Log errors in development
        if (import.meta.env.DEV) {
          console.error(`❌ ${config.method || 'GET'} ${endpoint}`, lastError)
        }
        
        // Don't retry on client errors (4xx) except 401
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          const statusMatch = error.message.match(/HTTP (\d+)/)
          if (statusMatch && parseInt(statusMatch[1]) !== 401) {
            throw error
          }
        }
        
        // Retry on network errors
        if (attempt < maxRetries - 1) {
          if (import.meta.env.DEV) {
            console.log(`Request failed, retrying... (${attempt + 1}/${maxRetries})`)
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
        }
      }
    }
    
    if (import.meta.env.DEV) {
      console.error('API Request failed after retries:', lastError)
    }
    throw lastError || new Error('Request failed after multiple attempts')
  }

  private async refreshTokenIfAvailable(): Promise<string | null> {
    const refreshToken = localStorage.getItem('civic_refresh_token')
    if (!refreshToken) return null

    try {
      if (import.meta.env.DEV) {
        console.log('Attempting token refresh...')
      }
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (response.ok) {
        const data = await response.json()
        if (import.meta.env.DEV) {
          console.log('Token refresh successful')
        }
        this.setToken(data.access_token)
        localStorage.setItem('civic_refresh_token', data.refresh_token)
        return data.access_token
      } else {
        if (import.meta.env.DEV) {
          console.log('Token refresh failed with status:', response.status)
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Token refresh failed:', error)
      }
    }

    // If refresh fails, clear tokens
    if (import.meta.env.DEV) {
      console.log('Clearing tokens due to refresh failure')
    }
    this.setToken(null)
    localStorage.removeItem('civic_refresh_token')
    
    // Dispatch a custom event to notify the app about logout
    window.dispatchEvent(new CustomEvent('token-expired'))
    
    return null
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const config: RequestInit = {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData - let browser set it with boundary
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
      body: formData,
    }

    // Add request timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    config.signal = controller.signal

    try {
      const response = await fetch(url, config)
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || errorData.detail || errorData.error || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(errorMessage)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)

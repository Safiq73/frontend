import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authManager, User, LoginRequest, RegisterRequest } from '../services/authManager'
import { userService } from '../services/users'

interface UserContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (userData: RegisterData) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  username: string
  display_name?: string
  bio?: string
  avatar_url?: string
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  login: async () => { throw new Error('UserContext not initialized') },
  register: async () => { throw new Error('UserContext not initialized') },
  logout: async () => {},
  refreshUser: async () => {}
})

export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize user from storage
  useEffect(() => {
    const initializeUser = async () => {
      console.log('🔄 Initializing user from storage...')
      
      try {
        // First check if we have a valid token
        const hasValidToken = authManager.isAuthenticated()
        console.log('📊 Token status:', { hasValidToken })
        
        if (hasValidToken) {
          const storedUser = authManager.getStoredUser()
          console.log('🔍 AuthManager stored user:', storedUser)
          console.log('🔍 AuthManager stored user avatar_url:', storedUser?.avatar_url)
          
          if (storedUser) {
            if (import.meta.env.DEV) {
              console.log('✅ Found stored user:', storedUser.username)
            }
            setUser(storedUser)
            
            // Check if token needs refresh
            if (authManager.shouldRefreshToken()) {
              if (import.meta.env.DEV) {
                console.log('🔄 Token needs refresh, attempting refresh...')
              }
              
              // First check if refresh token is still valid
              if (!authManager.isRefreshTokenExpired()) {
                const newToken = await authManager.refreshAccessToken()
                if (newToken && import.meta.env.DEV) {
                  console.log('✅ Token refreshed successfully')
                } else if (import.meta.env.DEV) {
                  console.log('❌ Token refresh failed, logging out')
                  await authManager.logout()
                  setUser(null)
                }
              } else {
                console.log('❌ Refresh token expired, logging out')
                await authManager.logout()
                setUser(null)
              }
            }
          } else {
            console.log('⚠️ Have token but no stored user, clearing auth')
            await authManager.logout()
            setUser(null)
          }
        } else {
          console.log('❌ No valid token found')
          setUser(null)
        }
      } catch (error) {
        console.error('❌ Error during user initialization:', error)
        setUser(null)
      }
      
      setLoading(false)
    }

    initializeUser()
  }, [])

  // Listen for authentication state changes (from auth manager)
  useEffect(() => {
    const handleAuthChange = (event: any) => {
      const { type, user: eventUser } = event.detail
      
      console.log(`🔔 Auth state change: ${type}`)
      
      if (type === 'login' && eventUser) {
        setUser(eventUser)
      } else if (type === 'logout') {
        setUser(null)
      }
    }

    // Listen for storage events (logout from other tabs)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'civic_access_token' && !event.newValue) {
        console.log('🔔 Token removed from storage (possibly from another tab)')
        setUser(null)
      }
    }

    window.addEventListener('auth-state-change', handleAuthChange)
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('auth-state-change', handleAuthChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Auto-refresh token if needed
  useEffect(() => {
    if (user && authManager.shouldRefreshToken()) {
      console.log('🔄 Auto-refreshing token...')
      authManager.refreshAccessToken()
    }
  }, [user])

  const login = async (email: string, password: string): Promise<User> => {
    try {
      setLoading(true)
      console.log('🔐 UserContext: Attempting login...')
      
      const credentials: LoginRequest = { email, password }
      const authData = await authManager.login(credentials)
      
      setUser(authData.user)
      console.log('✅ UserContext: Login successful')
      
      return authData.user
    } catch (error) {
      console.error('❌ UserContext: Login failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const register = async (userData: RegisterData): Promise<User> => {
    try {
      setLoading(true)
      console.log('📝 UserContext: Attempting registration...')
      
      const registerData: RegisterRequest = {
        email: userData.email,
        password: userData.password,
        username: userData.username,
        display_name: userData.display_name,
        bio: userData.bio,
        avatar_url: userData.avatar_url
      }
      
      const authData = await authManager.register(registerData)
      
      setUser(authData.user)
      console.log('✅ UserContext: Registration successful')
      
      return authData.user
    } catch (error) {
      console.error('❌ UserContext: Registration failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async (): Promise<void> => {
    try {
      console.log('🚪 UserContext: Logging out...')
      await authManager.logout()
      setUser(null)
      console.log('✅ UserContext: Logout successful')
    } catch (error) {
      console.error('❌ UserContext: Logout error:', error)
      // Still clear user state even if logout API fails
      setUser(null)
    }
  }

  const refreshUser = async (): Promise<void> => {
    try {
      console.log('🔄 UserContext: Refreshing user...')
      
      if (authManager.isAuthenticated()) {
        // Fetch fresh user data from API
        const freshUser = await userService.getCurrentUser()
        console.log('🔍 UserContext: Fresh user data from API:', freshUser)
        console.log('🔍 UserContext: Fresh user avatar_url:', freshUser.avatar_url)
        console.log('🔍 UserContext: About to call setUser with fresh data')
        setUser(freshUser as unknown as User)
        console.log('✅ UserContext: setUser called with fresh data')
        console.log('🔍 UserContext: Current user state after setUser:', user)
      } else {
        setUser(null)
        console.log('❌ UserContext: Not authenticated, cleared user')
      }
    } catch (error) {
      console.error('❌ UserContext: Failed to refresh user:', error)
      // Fallback to stored user if API fails
      if (authManager.isAuthenticated()) {
        const storedUser = authManager.getStoredUser()
        if (storedUser) {
          setUser(storedUser)
          console.log('⚠️ UserContext: API failed, using stored user')
        } else {
          await authManager.logout()
          setUser(null)
        }
      } else {
        setUser(null)
      }
    }
  }

  const value: UserContextType = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

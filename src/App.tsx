import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from './components/Layout'
import Home from './pages/Home'
import Post from './pages/Post'
import Activity from './pages/Activity'
import Explore from './pages/Explore'
import Profile from './pages/Profile'
import UserProfile from './pages/UserProfile'
import Settings from './pages/Settings'
import SearchPage from './pages/SearchPage'
import RepresentativePage from './pages/RepresentativePage'
import WebSocketTestPage from './pages/WebSocketTestPage'
import StatusDemo from './pages/StatusDemo'
import CommentsPage from './pages/CommentsPage'
import { PostProvider } from './contexts/PostContext'
import { UserProvider } from './contexts/UserContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ErrorBoundary, NetworkStatus } from './components/ErrorBoundary'
import { authManager } from './services/authManager'
import { useEffect, Suspense } from 'react'
import DevUtils from './utils/devUtils'

// Loading component for Suspense
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
}

function App() {
  useEffect(() => {
    // Simple initialization without dev utils for now
    const initializeApp = async () => {
      try {
        console.log('🔄 Initializing app...')
        
        // Initialize authentication
        const accessToken = authManager.getAccessToken()
        const refreshToken = authManager.getRefreshToken()
        
        console.log('Auth tokens status:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken
        })
        
        if (accessToken && authManager.isTokenExpired()) {
          if (import.meta.env.DEV) {
            console.log('Access token is expired, attempting refresh...')
          }
          
          if (refreshToken && !authManager.isRefreshTokenExpired()) {
            const newToken = await authManager.refreshAccessToken()
            if (newToken && import.meta.env.DEV) {
              console.log('Token refreshed successfully')
            } else if (import.meta.env.DEV) {
              console.log('Token refresh failed')
            }
          } else {
            if (import.meta.env.DEV) {
              console.log('Refresh token unavailable or expired, clearing auth')
            }
            await authManager.logout()
          }
        }
      } catch (error) {
        console.warn('Failed to initialize app:', error)
      }
    }

    initializeApp()
  }, [])

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App Error:', error, errorInfo)
      }}
    >
      <UserProvider>
        <PostProvider>
          <NotificationProvider>
            <Router>
              <Suspense fallback={<LoadingSpinner />}>
                <AnimatePresence mode="wait">
                  <Layout>
                    <NetworkStatus />
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/post" element={<Post />} />
                      <Route path="/post/:postId" element={<Post />} />
                      <Route path="/post/:postId/comments" element={<CommentsPage />} />
                      <Route path="/activity" element={<Activity />} />
                      <Route path="/explore" element={<Explore />} />
                      <Route path="/search" element={<SearchPage />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/profile/:userId" element={<UserProfile />} />
                      <Route path="/representative/:representativeId" element={<RepresentativePage />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/websocket-test" element={<WebSocketTestPage />} />
                      <Route path="/status-demo" element={<StatusDemo />} />
                    </Routes>
                  </Layout>
                </AnimatePresence>
              </Suspense>
            </Router>
          </NotificationProvider>
        </PostProvider>
      </UserProvider>
    </ErrorBoundary>
  )
}

export default App

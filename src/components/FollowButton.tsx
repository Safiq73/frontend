import { useState, useEffect } from 'react'
import { followService } from '../services/follows'
import { useUser } from '../contexts/UserContext'
import { UserPlus, UserMinus, Loader2 } from 'lucide-react'

interface FollowButtonProps {
  userId: string
  className?: string
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline'
  initialFollowStatus?: boolean | null  // NEW: If provided, skip API call
  context?: 'feed' | 'profile' // New prop to determine behavior
  onFollowChange?: (isFollowing: boolean, mutual: boolean) => void
}

export default function FollowButton({
  userId,
  className = '',
  showIcon = true,
  size = 'md',
  variant = 'primary',
  initialFollowStatus,  // NEW: Use this to skip API call
  context = 'profile', // Default to profile behavior for backward compatibility
  onFollowChange
}: FollowButtonProps) {
  const { user: currentUser } = useUser()
  const [isFollowing, setIsFollowing] = useState(false)
  const [isMutual, setIsMutual] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [wasInitiallyFollowing, setWasInitiallyFollowing] = useState(false) // Track initial state

  // Don't show follow button for own profile
  if (!currentUser || currentUser.id === userId) {
    return null
  }

  // Check initial follow status
  useEffect(() => {
    // If initialFollowStatus is provided, use it directly
    if (initialFollowStatus !== undefined) {
      setIsFollowing(initialFollowStatus === true)
      setIsMutual(false)  // We don't get mutual status from posts API yet
      setIsCheckingStatus(false)
      return
    }

    // Otherwise, make API call (fallback for compatibility)
    const checkFollowStatus = async () => {
      try {
        setIsCheckingStatus(true)
        const status = await followService.getFollowStatus(userId)
        setIsFollowing(status.is_following)
        setIsMutual(status.mutual)
        setWasInitiallyFollowing(status.is_following) // Remember initial state
      } catch (error) {
        console.error('Failed to check follow status:', error)
      } finally {
        setIsCheckingStatus(false)
      }
    }

    checkFollowStatus()
  }, [userId, initialFollowStatus])

  const handleFollowToggle = async () => {
    if (isLoading) return

    try {
      setIsLoading(true)
      
      if (isFollowing) {
        // Unfollow user
        await followService.unfollowUser(userId)
        setIsFollowing(false)
        setIsMutual(false)
        
        // Notify parent component of the change
        onFollowChange?.(false, false)
      } else {
        // Follow user
        const response = await followService.followUser(userId)
        setIsFollowing(true)
        setIsMutual(response.mutual)
        
        // Notify parent component of the change
        onFollowChange?.(true, response.mutual || false)
      }
      
    } catch (error) {
      console.error('Failed to toggle follow status:', error)
      // You might want to show a toast notification here
    } finally {
      setIsLoading(false)
    }
  }

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  // Variant classes
  const getVariantClasses = () => {
    if (isFollowing) {
      // When following, show as secondary style
      switch (variant) {
        case 'primary':
          return 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
        case 'secondary':
          return 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
        case 'outline':
          return 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
        default:
          return 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
      }
    } else {
      // When not following, show as primary style
      switch (variant) {
        case 'primary':
          return 'bg-blue-500 text-white border border-blue-500 hover:bg-blue-600'
        case 'secondary':
          return 'bg-gray-500 text-white border border-gray-500 hover:bg-gray-600'
        case 'outline':
          return 'bg-white text-blue-500 border border-blue-500 hover:bg-blue-50'
        default:
          return 'bg-blue-500 text-white border border-blue-500 hover:bg-blue-600'
      }
    }
  }

  // Loading state
  if (isCheckingStatus) {
    return (
      <div className={`inline-flex items-center justify-center rounded-lg ${sizeClasses[size]} bg-gray-100 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      </div>
    )
  }

  // For profile context: Always show button (both follow and unfollow)
  // For feed context: Hide button if already following when page loads
  if (context === 'feed' && wasInitiallyFollowing) {
    return null
  }

  const buttonText = isFollowing ? 'Following' : 'Follow'
  const Icon = isFollowing ? UserMinus : UserPlus

  return (
    <button
      onClick={handleFollowToggle}
      disabled={isLoading} // Only disable when loading
      className={`
        inline-flex items-center justify-center space-x-2 rounded-lg font-medium
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]} ${getVariantClasses()} ${className}
      `}
      title={isFollowing ? 'Click to unfollow' : 'Follow'}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {showIcon && <Icon className="w-4 h-4" />}
          <span>{buttonText}</span>
        </>
      )}
    </button>
  )
}

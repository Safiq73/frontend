import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext'
import { usePosts } from '../contexts/PostContext'
import { userService, UserStats } from '../services/users'
import { postsService } from '../services/posts'
import { CivicPost, RepresentativeAccount } from '../types'
import { Edit, Bookmark, MessageCircle, TrendingUp, Calendar, MapPin, Eye, Heart, Share2, Filter, Grid, List, MoreHorizontal, Camera, ChevronRight, LogIn, UserCheck } from 'lucide-react'
import { Crown, Settings } from '../components/Icons'
import Avatar from '../components/Avatar'
import FeedCard from '../components/FeedCard'
import ProfileFeedCard from '../components/Posts/ProfileFeedCard'
import AuthModal from '../components/AuthModal'
import RepresentativeAccountTags from '../components/RepresentativeAccountTags'
import FollowStats from '../components/FollowStats'
import FollowModal from '../components/FollowModal'
import { TicketStatus } from '../components/UI/TicketStatus'

export default function Profile() {
  const { user, loading, refreshUser } = useUser()
  const { posts } = usePosts()
  const navigate = useNavigate()
  const [userPosts, setUserPosts] = useState<CivicPost[]>([])
  const [userPostsLoading, setUserPostsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'assigned' | 'posts' | 'saved'>('posts')
  const [assignedPosts, setAssignedPosts] = useState<CivicPost[]>([])
  const [assignedPostsLoading, setAssignedPostsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [showCoverModal, setShowCoverModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showFollowModal, setShowFollowModal] = useState(false)
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [avatarCacheBuster, setAvatarCacheBuster] = useState(0)
  const [freshUserData, setFreshUserData] = useState<any>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [userStatsLoading, setUserStatsLoading] = useState(false)
  const avatarFileInputRef = useRef<HTMLInputElement>(null)
  const coverFileInputRef = useRef<HTMLInputElement>(null)

  const loadUserStats = async () => {
    if (!user) return
    
    try {
      setUserStatsLoading(true)
      const stats = await userService.getUserStats(user.id)
      setUserStats(stats)
    } catch (error) {
      console.error('❌ Failed to load user statistics:', error)
      // Fallback to calculating from userPosts if API fails
      setUserStats({
        posts_count: userPosts.length,
        comments_received: userPosts.reduce((sum, post) => sum + post.comment_count, 0),
        upvotes_received: userPosts.reduce((sum, post) => sum + post.upvotes, 0),
        total_views: userPosts.length * 127 // Mock view count
      })
    } finally {
      setUserStatsLoading(false)
    }
  }

  useEffect(() => {
    loadUserPosts()
    loadUserStats()
  }, [user])

  useEffect(() => {
    if (userPosts.length > 0) {
      loadUserStats() // Refresh stats when posts are loaded
    }
  }, [userPosts])

  // Load fresh user data including rep_accounts
  useEffect(() => {
    const loadFreshUserData = async () => {
      if (user) {
        try {
          const freshUser = await userService.getCurrentUser()
          setFreshUserData(freshUser)
          console.log('🔍 rep_accounts value:', freshUser.rep_accounts)
        } catch (error) {
          console.error('❌ Failed to load fresh user data:', error)
        }
      }
    }
    
    loadFreshUserData()
  }, [user])

  // Debug effect to monitor freshUserData changes and set default tab
  useEffect(() => {
    if (freshUserData?.rep_accounts) {
      console.log('🎯 freshUserData.rep_accounts:', freshUserData.rep_accounts)
      // If user has rep_accounts, default to 'assigned', otherwise 'posts'
      if (freshUserData.rep_accounts.length > 0) {
        setActiveTab('assigned')
      }
    }
  }, [freshUserData])

  const loadUserPosts = async () => {
    if (!user) return
    
    try {
      setUserPostsLoading(true)
      
      // Always try API first for fresh data
      const response = await userService.getCurrentUserPosts()
      setUserPosts(response.posts)
      
    } catch (error) {
      console.error('❌ Failed to load user posts:', error)
      
      // Fallback to filtering from general posts if API fails
      const existingUserPosts = posts.filter(post => post.author.id === user.id)
      setUserPosts(existingUserPosts)
    } finally {
      setUserPostsLoading(false)
    }
  }

  const loadAssignedPosts = async () => {
    if (!user || !freshUserData?.rep_accounts || freshUserData.rep_accounts.length === 0) return
    
    try {
      setAssignedPostsLoading(true)
      
      // Get all representative IDs from user's rep_accounts
      const representativeIds = freshUserData.rep_accounts.map((account: RepresentativeAccount) => account.id)
      
      // Call the API to get posts assigned to these representatives
      const response = await postsService.getAssignedPosts(representativeIds, {
        sort_by: 'timestamp',
        order: 'desc'
      })
      
      setAssignedPosts(response.items)
      
    } catch (error) {
      console.error('❌ Failed to load assigned posts:', error)
      setAssignedPosts([])
    } finally {
      setAssignedPostsLoading(false)
    }
  }

  // Handle status updates for posts
  const handleStatusUpdate = (postId: string, newStatus: TicketStatus) => {
    // Update userPosts if the post is in there
    setUserPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId ? { ...post, status: newStatus } : post
      )
    )
    
    // Update assignedPosts if the post is in there
    setAssignedPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId ? { ...post, status: newStatus } : post
      )
    )
  }

  // Load user posts when user is available or when tab changes
  useEffect(() => {
    if (user && activeTab === 'posts') {
      // Clear existing posts and reload fresh data
      setUserPosts([])
      loadUserPosts()
    } else if (user && activeTab === 'assigned') {
      // Clear existing assigned posts and reload fresh data
      setAssignedPosts([])
      loadAssignedPosts()
    }
  }, [user?.id, activeTab, posts, freshUserData?.rep_accounts]) // Added posts dependency since fallback uses it

  // Show auth modal if user is not logged in
  if (!user && !loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to view your profile</h2>
          <p className="text-gray-600 mb-6">
            Access your posts, saved content, and manage your civic engagement.
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        </div>
        
        <AuthModal 
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  // Debug: Log current avatar URL
  console.log('🔍 Profile render - user.avatar_url:', user.avatar_url)
  console.log('🔍 Profile render - avatarCacheBuster:', avatarCacheBuster)

  const savedPosts = posts.filter(post => post.is_saved)
  // Calculate statistics from API data or fallback to client-side calculation
  const totalUpvotes = userStats?.upvotes_received ?? userPosts.reduce((sum, post) => sum + post.upvotes, 0)
  const totalComments = userStats?.comments_received ?? userPosts.reduce((sum, post) => sum + post.comment_count, 0)
  const totalViews = userStats?.total_views ?? (userPosts.length * 127) // Mock view count as fallback
  const joinDate = new Date(2024, 0, 15) // Mock join date
  
  const formatJoinDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
    return num.toString()
  }

  // File upload utility functions
  const handleFileUpload = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file'))
        return
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('File size should be less than 5MB'))
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        resolve(result)
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const handleAvatarFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingAvatar(true)
      
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file')
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('File size should be less than 5MB')
      }

      // Use the existing uploadAvatar service method
      const result = await userService.uploadAvatar(file)
      console.log('🔍 Upload result:', result)
      
      // Close the modal first
      setShowAvatarModal(false)
      console.log('✅ Avatar uploaded successfully')
      
      // Refresh user context to get updated data
      console.log('🔄 Profile: About to call refreshUser...')
      await refreshUser()
      console.log('✅ Profile: refreshUser completed')
      console.log('🔍 Profile: User state after refresh:', user)
      
      // Force image cache refresh
      setAvatarCacheBuster(Date.now())
      
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setIsUploadingAvatar(false)
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = ''
      }
    }
  }

  const handleCoverFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingCover(true)
      const imageUrl = await handleFileUpload(file)
      handleCoverChange(imageUrl)
    } catch (error) {
      console.error('Error uploading cover photo:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setIsUploadingCover(false)
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = ''
      }
    }
  }

  const handleAvatarChange = async (newAvatarUrl: string) => {
    try {
      if (!user) {
        throw new Error('User not found')
      }

      // Only send the field that's actually changing to avoid validation conflicts
      const updateData = {
        avatar_url: newAvatarUrl
      }

      // Update the user profile via API
      const updatedUser = await userService.updateProfile(updateData)
      
      // Close the modal first
      setShowAvatarModal(false)
      
      console.log('✅ Avatar updated successfully')
      
      // Force a page reload to show the updated profile picture
      window.location.reload()
      
    } catch (error) {
      console.error('❌ Failed to update avatar:', error)
      alert('Failed to update profile picture. Please try again.')
    }
  }

  const handleEditProfile = () => {
    // TODO: Navigate to edit profile page or open edit modal
  }

  const handleSettings = () => {
    navigate('/settings')
  }

  const handleShareProfile = () => {
    if (navigator.share) {
      navigator.share({
        title: `${user.display_name || user.username}'s Profile - CivicPulse`,
        text: `Check out ${user.display_name || user.username}'s civic contributions on CivicPulse`,
        url: window.location.href
      }).catch(console.error)
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Profile link copied to clipboard!')
      }).catch(console.error)
    }
  }

  const handleMoreOptions = () => {
    // TODO: Show more options menu
  }

  const handleCustomAvatarUpload = () => {
    avatarFileInputRef.current?.click()
  }

  const handleCustomCoverUpload = () => {
    coverFileInputRef.current?.click()
  }

  const handleCoverChange = async (newCoverUrl: string) => {
    try {
      if (!user) {
        throw new Error('User not found')
      }

      // Include required fields to avoid validation errors
      const updateData = {
        cover_photo: newCoverUrl,
        username: user.username,
        display_name: user.display_name || user.username,
        bio: user.bio
      }

      // Update the user profile via API
      const updatedUser = await userService.updateProfile(updateData)
      
      // Close the modal first
      setShowCoverModal(false)
      
      console.log('✅ Cover photo updated successfully')
      
      // Force a page reload to show the updated cover photo
      window.location.reload()
      
    } catch (error) {
      console.error('❌ Failed to update cover photo:', error)
      alert('Failed to update cover photo. Please try again.')
    }
  }

  // Predefined avatar options
  const avatarOptions = [
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    'https://images.unsplash.com/photo-1494790108755-2616b332d2f1?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
  ]

  // Predefined cover photo options
  const coverOptions = [
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&h=400&q=80',
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&h=400&q=80',
    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&h=400&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&h=400&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&h=400&q=80',
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&h=400&q=80'
  ]

  return (
    <div className="max-w-lg mx-auto">
      {/* Hidden file inputs */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarFileSelect}
        className="hidden"
      />
      <input
        ref={coverFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverFileSelect}
        className="hidden"
      />

      {/* Enhanced Profile Header */}
      <div className="relative">
        {/* Cover Photo */}
        <div 
          className="h-32 rounded-t-lg relative overflow-hidden cursor-pointer group"
          onClick={() => setShowCoverModal(true)}
          style={{            backgroundImage: user.cover_photo
              ? `url(${user.cover_photo})`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-40 transition-all duration-300"></div>
          <button 
            onClick={(e) => {
              e.stopPropagation()
              setShowCoverModal(true)
            }}
            className="absolute top-4 right-4 p-2 bg-black bg-opacity-30 hover:bg-opacity-50 rounded-full transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            <Camera className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Profile Info */}
        <div className="bg-white rounded-b-lg shadow-sm border border-gray-100 pt-0 pb-4 px-4 relative">
          {/* Avatar */}
          <div className="relative -mt-12 mb-3">
            <div className="relative inline-block">
              <div 
                onClick={() => setShowAvatarModal(true)}
                className="cursor-pointer group"
              >
                <Avatar
                  src={user.avatar_url ? `${user.avatar_url}${avatarCacheBuster ? `?t=${avatarCacheBuster}` : ''}` : undefined}
                  alt={user.display_name || user.username}
                  size="2xl"
                  className="border-2 border-white shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-full transition-all duration-300 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </div>
            </div>
          </div>

          {/* User Details */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{user.display_name || user.username}</h1>
              {user.verified && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
              <span className="flex items-center space-x-1 capitalize">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Citizen</span>
              </span>
              <span className="flex items-center space-x-1">
                <MapPin className="w-3 h-3" />
                <span>{user.bio || 'No bio provided'}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>Joined {formatJoinDate(joinDate)}</span>
              </span>
            </div>
            
            {/* Representative Account Tags */}
            {freshUserData?.rep_accounts && freshUserData.rep_accounts.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Representative Accounts</h4>
                  <span className="text-xs text-gray-500">({freshUserData.rep_accounts.length})</span>
                </div>
                <RepresentativeAccountTags 
                  repAccounts={freshUserData.rep_accounts}
                  maxDisplay={2}
                  size="md"
                  showJurisdiction={true}
                  variant="default"
                />
              </div>
            )}
            
            <p className="text-gray-700 text-sm">
              {user.bio || "Passionate about making our community better. Let's work together to solve local issues and create positive change! 🏘️✨"}
            </p>

            {/* Follow Stats */}
            <div className="mt-3">
              {user?.id && (
                <FollowStats
                  userId={user.id}
                  onClick={(type) => {
                    setFollowModalTab(type)
                    setShowFollowModal(true)
                  }}
                  className="justify-center"
                  size="md"
                />
              )}
            </div>
          </div>

          {/* Enhanced Stats Grid */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="text-center p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
              <div className="text-xl font-bold text-blue-700">{userPosts.length}</div>
              <div className="text-xs text-blue-600 font-medium">Posts</div>
            </div>
            <div className="text-center p-2 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
              <div className="text-xl font-bold text-green-700">{formatNumber(totalUpvotes)}</div>
              <div className="text-xs text-green-600 font-medium">Upvotes</div>
            </div>
            <div className="text-center p-2 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
              <div className="text-xl font-bold text-purple-700">{totalComments}</div>
              <div className="text-xs text-purple-600 font-medium">Comments</div>
            </div>
            <div className="text-center p-2 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
              <div className="text-xl font-bold text-orange-700">{formatNumber(totalViews)}</div>
              <div className="text-xs text-orange-600 font-medium">Views</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button 
              onClick={handleEditProfile}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-3 rounded-xl transition-colors flex items-center justify-center space-x-2 shadow-sm"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
            <button 
              onClick={handleSettings}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-3 rounded-xl transition-colors flex items-center justify-center space-x-2"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={handleShareProfile}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-3 rounded-xl transition-colors flex items-center justify-center"
              title="Share Profile"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button 
              onClick={handleMoreOptions}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-3 rounded-xl transition-colors flex items-center justify-center"
              title="More Options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Tab Navigation */}
        <div className="p-4 pb-3">
          <div className="flex space-x-2 mb-4 bg-gray-50 rounded-lg p-1">
            {/* Conditionally show Assigned tab if user has rep_accounts */}
            {freshUserData?.rep_accounts && freshUserData.rep_accounts.length > 0 && (
              <button
                onClick={() => {
                  setActiveTab('assigned')
                  if (activeTab !== 'assigned') {
                    loadAssignedPosts()
                  }
                }}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'assigned'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Assigned</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  activeTab === 'assigned' 
                    ? 'bg-gray-100 text-gray-700' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {assignedPosts.length}
                </span>
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab('posts')
                if (activeTab !== 'posts') {
                  loadUserPosts()
                }
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'posts'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>{freshUserData?.rep_accounts && freshUserData.rep_accounts.length > 0 ? 'Posts' : 'My Posts'}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                activeTab === 'posts' 
                  ? 'bg-gray-100 text-gray-700' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {userPosts.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'saved'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Saved</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                activeTab === 'saved' 
                  ? 'bg-gray-100 text-gray-700' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {savedPosts.length}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 pb-4">
          {activeTab === 'posts' && (
            <div>
              {/* Posts Content */}
              {userPostsLoading ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600 mx-auto"></div>
                  <p className="mt-3 text-gray-600">Loading your posts...</p>
                </div>
              ) : userPosts.length > 0 ? (
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-4' : 'space-y-4'}>
                  {userPosts.map((post) => (
                    viewMode === 'list' ? (
                      <div key={post.id}>
                        <ProfileFeedCard 
                          post={post} 
                          onStatusUpdate={handleStatusUpdate}
                          showStatusUpdate={true}
                        />
                      </div>
                    ) : (
                      <div key={post.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow group">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{post.title}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-medium ml-2 ${
                            post.post_type === 'issue' ? 'bg-red-100 text-red-800' :
                            post.post_type === 'announcement' ? 'bg-blue-100 text-blue-800' :
                            post.post_type === 'news' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {post.post_type}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center space-x-4">
                            <span className="flex items-center space-x-1">
                              <Heart className="w-3.5 h-3.5" />
                              <span className="font-medium">{post.upvotes}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span className="font-medium">{post.comment_count}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Eye className="w-3.5 h-3.5" />
                              <span className="font-medium">{Math.floor(Math.random() * 200) + 50}</span>
                            </span>
                          </div>
                          <span className="bg-gray-100 px-2 py-1 rounded-md font-medium">{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Edit className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
                  <p className="text-gray-600 mb-3 max-w-sm mx-auto">Ready to make your voice heard? Share your first community update.</p>
                  <button
                    onClick={() => window.location.href = '/post'}
                    className="bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-md transition-colors"
                  >
                    Create Your First Post
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assigned' && (
            <div>
              {assignedPostsLoading ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600 mx-auto"></div>
                  <p className="mt-3 text-gray-600">Loading assigned issues...</p>
                </div>
              ) : assignedPosts.length > 0 ? (
                <div className="space-y-4">
                  {assignedPosts.map((post) => (
                    <div key={post.id}>
                      <ProfileFeedCard 
                        post={post} 
                        onStatusUpdate={handleStatusUpdate}
                        showStatusUpdate={true}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <UserCheck className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No assigned issues</h3>
                  <p className="text-gray-600 max-w-sm mx-auto">Issues assigned to your representative accounts will appear here when available.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'saved' && (
            <div>
              {savedPosts.length > 0 ? (
                <div className="space-y-2">
                  {savedPosts.map((post) => (
                    <div key={post.id} className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow group">
                      <div className="p-2 bg-gray-100 rounded-md">
                        <Bookmark className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{post.title}</h4>
                        <p className="text-sm text-gray-600">Saved • {new Date(post.created_at).toLocaleDateString()}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Bookmark className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved posts</h3>
                  <p className="text-gray-600 max-w-sm mx-auto">Posts you bookmark will appear here for easy access later.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Avatar Selection Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-96 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Change Profile Picture</h3>
                <button 
                  onClick={() => setShowAvatarModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <span className="text-gray-500 text-xl">×</span>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">Choose a new profile picture:</p>
              
              {/* Avatar Options Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {avatarOptions.map((avatarUrl, index) => (
                  <button
                    key={index}
                    onClick={() => handleAvatarChange(avatarUrl)}
                    className={`relative group transition-all duration-200 ${
                      user?.avatar_url === avatarUrl 
                        ? 'ring-4 ring-gray-400 ring-offset-2' 
                        : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1'
                    }`}
                  >
                    <Avatar
                      src={avatarUrl}
                      alt={`Avatar option ${index + 1}`}
                      size="xl"
                      className="w-full"
                    />
                    {user?.avatar_url === avatarUrl && (
                      <div className="absolute inset-0 bg-gray-600 bg-opacity-20 rounded-full flex items-center justify-center">
                        <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Upload Option */}
              <div className="border-t border-gray-100 pt-4">
                <button 
                  onClick={handleCustomAvatarUpload}
                  disabled={isUploadingAvatar}
                  className="w-full flex items-center justify-center space-x-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {isUploadingAvatar ? 'Uploading...' : 'Upload Custom Photo'}
                  </span>
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  JPG, PNG, GIF up to 5MB
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cover Photo Selection Modal */}
      {showCoverModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-96 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Change Cover Photo</h3>
                <button 
                  onClick={() => setShowCoverModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <span className="text-gray-500 text-xl">×</span>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">Choose a new cover photo:</p>
              
              {/* Cover Options Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {coverOptions.map((coverUrl, index) => (
                  <button
                    key={index}
                    onClick={() => handleCoverChange(coverUrl)}
                    className={`relative group transition-all duration-200 rounded-lg overflow-hidden ${
                      user?.cover_photo === coverUrl 
                        ? 'ring-4 ring-gray-400 ring-offset-2' 
                        : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1'
                    }`}
                  >
                    <div 
                      className="w-full h-20 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${coverUrl})`,
                      }}
                    />
                    {user?.cover_photo === coverUrl && (
                      <div className="absolute inset-0 bg-gray-600 bg-opacity-20 flex items-center justify-center">
                        <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Upload Option */}
              <div className="border-t border-gray-100 pt-4">
                <button 
                  onClick={handleCustomCoverUpload}
                  disabled={isUploadingCover}
                  className="w-full flex items-center justify-center space-x-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {isUploadingCover ? 'Uploading...' : 'Upload Custom Cover'}
                  </span>
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  JPG, PNG, GIF up to 5MB
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow Modal */}
      {user && (
        <FollowModal
          isOpen={showFollowModal}
          onClose={() => setShowFollowModal(false)}
          userId={user?.id || ''}
          initialTab={followModalTab}
          userName={user?.display_name || user?.username || ''}
        />
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CivicPost } from '../types'
import { StatusBadge, TicketStatus } from './UI/TicketStatus'
import { MapPin, MessageCircle, ArrowUp, ArrowDown, Bookmark, Share, ChevronDown, ExternalLink, Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, Info, Calendar, User, MapIcon, Phone, Mail, Building, CheckCircle, Loader2, UserPlus } from 'lucide-react'
import { usePosts } from '../contexts/PostContext'
import { useUser } from '../contexts/UserContext'
import Avatar from './Avatar'
import FollowButton from './FollowButton'
import AssigneeSelection from './AssigneeSelection'

interface FeedCardProps {
  post: CivicPost
  customStatusComponent?: React.ReactNode
  customDetailsStatusComponent?: React.ReactNode
}

// Throttle function to prevent rapid API calls
const throttle = (func: Function, delay: number) => {
  let timeoutId: number | null = null
  let lastExecTime = 0
  return (...args: any[]) => {
    const currentTime = Date.now()
    
    if (currentTime - lastExecTime > delay) {
      func.apply(null, args)
      lastExecTime = currentTime
    } else {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        func.apply(null, args)
        lastExecTime = Date.now()
      }, delay - (currentTime - lastExecTime))
    }
  }
}

export default function FeedCard({ post, customStatusComponent, customDetailsStatusComponent }: FeedCardProps) {
  const navigate = useNavigate()
  const { toggleUpvote, toggleDownvote, toggleSave, updateAssignee } = usePosts()
  const { user: currentUser } = useUser()
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showAssigneeModal, setShowAssigneeModal] = useState(false)
  const [assigneeLoading, setAssigneeLoading] = useState(false)
  
  // Remove assignee-related state since we now get it from post.assignee_info
  // const [assigneeDetails, setAssigneeDetails] = useState<AssigneeDetails | null>(null)
  // const [loadingAssignee, setLoadingAssignee] = useState(false)
  // const [assigneeError, setAssigneeError] = useState<string | null>(null)
  
  // Throttled versions of the action functions
  const throttledUpvote = useRef(throttle(() => toggleUpvote(post.id), 1000))
  const throttledDownvote = useRef(throttle(() => toggleDownvote(post.id), 1000))
  const throttledSave = useRef(throttle(() => toggleSave(post.id), 1000))
  
  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [videoError, setVideoError] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true) // Start playing by default
  const [isMuted, setIsMuted] = useState(true) // Start muted for better UX
  const [showControls, setShowControls] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [buffered, setBuffered] = useState(0)
  const [wasManuallyPaused, setWasManuallyPaused] = useState(false) // Track manual pause state
  
  // Auto-hide controls timer
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  
  // Auto-hide controls function
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    setShowControls(true)
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }
  
  // Video event listeners setup
  useEffect(() => {
    const video = videoRef.current
    const videoContainer = videoContainerRef.current
    if (!video || !post.video || !videoContainer) return

    const updateTime = () => setCurrentTime(video.currentTime)
    const updateDuration = () => setDuration(video.duration)
    const updateProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered((video.buffered.end(0) / video.duration) * 100)
      }
    }
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    // Auto-play video when loaded
    const handleCanPlay = () => {
      setVideoLoading(false)
      if (video && isPlaying) {
        video.play().catch(() => {
          // If autoplay fails, set to paused state
          setIsPlaying(false)
        })
      }
    }

    // Intersection Observer to pause video when out of viewport
    const observerOptions = {
      root: null, // Use viewport as root
      rootMargin: '-50px', // Trigger when 50px of video is out of view
      threshold: 0.5 // Video must be at least 50% visible
    }

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting && isPlaying) {
          // Video is out of viewport and playing - pause it (but don't mark as manually paused)
          video.pause()
        } else if (entry.isIntersecting && !isPlaying && !wasManuallyPaused && !videoError) {
          // Video is back in viewport, wasn't manually paused, and had no errors - resume it
          video.play().catch(() => {
            setIsPlaying(false)
          })
        }
      })
    }

    const observer = new IntersectionObserver(handleIntersection, observerOptions)
    observer.observe(videoContainer)

    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('loadedmetadata', updateDuration)
    video.addEventListener('progress', updateProgress)
    video.addEventListener('canplay', handleCanPlay)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    // Keyboard shortcuts
    const handleKeyPress = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return
      
      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlayPause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seekRelative(-10)
          break
        case 'ArrowRight':
          e.preventDefault()
          seekRelative(10)
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
      }
    }

    document.addEventListener('keydown', handleKeyPress)

    return () => {
      observer.disconnect()
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('loadedmetadata', updateDuration)
      video.removeEventListener('progress', updateProgress)
      video.removeEventListener('canplay', handleCanPlay)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('keydown', handleKeyPress)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [post.video, isPlaying, wasManuallyPaused, videoError])

  // Check if content needs truncation (roughly 100 characters for 2 lines)
  const getContentToDisplay = () => {
    // For news articles, use description if available, otherwise use content
    if ((post.source === 'news' || post.post_type === 'news') && post.description) {
      return post.description
    }
    return post.content || ''
  }

  const contentToDisplay = getContentToDisplay()
  const needsTruncation = contentToDisplay.length > 100
  
  // Get truncated text for 2-line display (roughly 100 characters)
  const getDisplayContent = () => {
    if (!needsTruncation || isExpanded) return contentToDisplay
    const truncated = contentToDisplay.slice(0, 100)
    const lastSpaceIndex = truncated.lastIndexOf(' ')
    return lastSpaceIndex > 80 ? truncated.slice(0, lastSpaceIndex) : truncated
  }

  const handleUserClick = () => {
    navigate(`/profile/${post.author.id}`)
  }

  // Video control handlers
  const togglePlayPause = () => {
    const video = videoRef.current
    if (video) {
      if (isPlaying) {
        video.pause()
        setWasManuallyPaused(true) // Mark as manually paused
      } else {
        video.play().catch(() => {
          // Handle play promise rejection
          console.log('Video play was prevented')
        })
        setWasManuallyPaused(false) // Reset manual pause flag when playing
      }
      resetControlsTimeout()
    }
  }

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    const video = videoRef.current
    if (video) {
      video.muted = !isMuted
      setIsMuted(!isMuted)
      resetControlsTimeout()
    }
  }

  const toggleFullscreen = () => {
    const video = videoRef.current
    if (video) {
      if (!isFullscreen) {
        if (video.requestFullscreen) {
          video.requestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen()
        }
      }
      resetControlsTimeout()
    }
  }

  const seekRelative = (seconds: number) => {
    const video = videoRef.current
    if (video) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds))
      resetControlsTimeout()
    }
  }

  const seekToTime = (time: number) => {
    const video = videoRef.current
    if (video) {
      video.currentTime = time
      resetControlsTimeout()
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = progressBarRef.current
    if (progressBar && duration > 0) {
      const rect = progressBar.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickTime = (clickX / rect.width) * duration
      seekToTime(clickTime)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleVideoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    togglePlayPause()
  }

  const handleMouseMove = () => {
    resetControlsTimeout()
  }

  const getPostTypeColor = (type: string) => {
    switch (type) {
      case 'issue': return 'bg-red-100 text-red-800 border border-red-200'
      case 'announcement': return 'bg-blue-100 text-blue-800 border border-blue-200'
      case 'news': return 'bg-green-100 text-green-800 border border-green-200'
      case 'accomplishment': return 'bg-purple-100 text-purple-800 border border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border border-gray-200'
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      case 'in-progress': return 'bg-blue-100 text-blue-800 border border-blue-200'
      case 'resolved': return 'bg-green-100 text-green-800 border border-green-200'
      default: return ''
    }
  }

  const getPostIcon = (type: string) => {
    switch (type) {
      case 'issue': return '🚨'
      case 'announcement': return '📢'
      case 'news': return '📰'
      case 'accomplishment': return '🎉'
      default: return '📝'
    }
  }

  // Function removed - now using post.assignee_info directly
  
  // Handle show details toggle
  const handleShowDetailsToggle = () => {
    const newShowDetails = !showDetails
    setShowDetails(newShowDetails)
  }

  // Handle assignee operations
  const handleAssignClick = () => {
    setShowAssigneeModal(true)
  }

  const handleAssigneeUpdate = async (assigneeId: string | null) => {
    if (!currentUser) return
    
    setAssigneeLoading(true)
    try {
      await updateAssignee(post.id, assigneeId)
      setShowAssigneeModal(false)
    } catch (error) {
      console.error('Failed to update assignee:', error)
      // TODO: Show error message to user
    } finally {
      setAssigneeLoading(false)
    }
  }

  const handleShare = async () => {
    try {
      const isNewsArticle = post.source === 'news' || post.post_type === 'news'
      const shareData = {
        title: isNewsArticle ? (post.title || 'News Article') : post.title,
        text: isNewsArticle ? (post.description || post.content) : post.content,
        url: isNewsArticle && post.external_url ? post.external_url : window.location.href
      }
      
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareData.url)
      }
    } catch (error) {
      console.error('Error sharing:', error)
    }
  }

  // Debug: Log post author data
  console.log('🔍 FeedCard - post.author:', post.author);
  console.log('🔍 FeedCard - post.author.avatar_url:', post.author.avatar_url);

  return (
    <div className="feed-card fade-in hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 overflow-visible">
      {/* Header */}
      <div className="p-4 border-b border-gray-50">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar
              src={post.author.avatar_url}
              alt={post.author.display_name || post.author.username}
              size="lg"
              onClick={handleUserClick}
              className="hover:scale-105 transition-transform cursor-pointer"
            />
            <div>
              <div className="flex items-center space-x-2">
                <button onClick={handleUserClick}>
                  <h3 className="font-medium text-gray-900 hover:text-primary-600 transition-colors cursor-pointer">
                    {post.author.display_name || post.author.username}
                  </h3>
                </button>
                {post.author.verified && (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center animate-pulse-dot">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
              {/* Hide role and location for news articles */}
              {!(post.source === 'news' || post.post_type === 'news') && (
                <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                  <span className="text-xs text-gray-500 capitalize px-2 py-1 bg-gray-100 rounded-full flex items-center space-x-1">
                    {/* Use rep_accounts info first, fallback to role_name/abbreviation */}
                    {(() => {
                      // Debug logging to see what data we have
                      
                      if (post.author.rep_accounts && post.author.rep_accounts.length > 0) {
                        const repAccount = post.author.rep_accounts[0];
                        return (
                          <>
                            {repAccount.title.abbreviation && (
                              <span className="font-semibold text-primary-600">{repAccount.title.abbreviation}</span>
                            )}
                            <span className="text-primary-600">•</span>
                            <span className="text-primary-600">{repAccount.jurisdiction.name}</span>
                          </>
                        );
                      } else if (post.author.role_name) {
                        console.log('Using role_name:', post.author.role_name);
                        return (
                          <>
                            {post.author.abbreviation && (
                              <span className="font-semibold text-primary-600">{post.author.abbreviation}</span>
                            )}
                            <span className="hidden sm:inline">{post.author.role_name}</span>
                          </>
                        );
                      } else {
                        console.log('Falling back to Citizen');
                        return <span>Citizen</span>;
                      }
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Follow Button - only show for other users */}
            {currentUser && currentUser.id !== post.author.id && (
              <FollowButton
                userId={post.author.id}
                size="sm"
                variant="outline"
                showIcon={false}
                context="feed"
                className="text-xs"
                initialFollowStatus={post.author.follow_status}
              />
            )}
            
            {/* Show News tag for news articles, hide other post type tags */}
            {(post.source === 'news' || post.post_type === 'news') ? (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPostTypeColor('news')} flex items-center space-x-1`}>
                <span>{getPostIcon('news')}</span>
                <span className="capitalize">News</span>
              </span>
            ) : (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPostTypeColor(post.post_type)} flex items-center space-x-1`}>
                <span>{getPostIcon(post.post_type)}</span>
                <span className="capitalize">{post.post_type}</span>
              </span>
            )}
            {/* Remove status badge from header - now only shown in details */}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-2 pt-4">
        <h2 className="font-semibold text-gray-900 mb-3 leading-tight text-lg">
          {post.title}
        </h2>
        
        {/* Media Display - Image or Video */}
        {/* Handle both regular post images and NewsAPI images */}
        {((post.image || post.url_to_image || (post.media_urls && post.media_urls.length > 0)) && !imageError) && (
          <div className="relative overflow-hidden rounded-xl mb-2">
            {imageLoading && (
              <div className="skeleton w-full h-48 bg-gray-200 animate-pulse rounded-xl"></div>
            )}
            <img
              src={post.url_to_image || post.image || (post.media_urls && post.media_urls[0]) || ''}
              alt={post.source === 'news' ? 'News article image' : 'Post image'}
              className={`w-full h-48 object-cover rounded-xl transition-opacity duration-300 ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true)
                setImageLoading(false)
              }}
            />
            {/* External badge for news */}
            {(post.source === 'news' || post.post_type === 'news') && (
              <div className="absolute top-3 right-3">
                <div className="bg-black bg-opacity-70 text-white px-2 py-1 rounded-lg text-xs flex items-center space-x-1">
                  <ExternalLink className="w-3 h-3" />
                  <span>External</span>
                </div>
              </div>
            )}
            {/* Read Full Article button for news */}
            {(post.source === 'news' || post.post_type === 'news') && post.external_url && (
              <div className="absolute bottom-3 right-3">
                <a
                  href={post.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Read Full</span>
                </a>
              </div>
            )}
          </div>
        )}
        
        {post.video && !videoError && (
          <div 
            ref={videoContainerRef}
            className="relative overflow-hidden rounded-xl mb-2 group cursor-pointer video-player"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
            onMouseMove={handleMouseMove}
            onClick={handleVideoClick}
          >
            {/* Loading skeleton */}
            {videoLoading && (
              <div className="absolute inset-0 skeleton w-full h-48 bg-gray-200 animate-pulse rounded-xl flex items-center justify-center z-10">
                <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
              </div>
            )}
            
            {/* Video element */}
            <video
              ref={videoRef}
              src={post.video}
              className={`w-full h-48 object-cover rounded-xl transition-opacity duration-300 ${
                videoLoading ? 'opacity-0' : 'opacity-100'
              }`}
              preload="metadata"
              playsInline
              muted={isMuted}
              loop
              autoPlay
              onLoadStart={() => setVideoLoading(true)}
              onCanPlay={() => {
                setVideoLoading(false)
                // Auto-start playing
                const video = videoRef.current
                if (video && !isPlaying) {
                  video.play().catch(() => {
                    setIsPlaying(false)
                  })
                }
              }}
              onError={() => {
                setVideoError(true)
                setVideoLoading(false)
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              Your browser does not support the video tag.
            </video>
            
            {/* Enhanced video controls overlay */}
            <div className={`absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-300 ${
              showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}>
              
              {/* Main play/pause button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePlayPause()
                  }}
                  className="w-16 h-16 bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 video-control-btn"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 text-white ml-0.5" />
                  ) : (
                    <Play className="w-8 h-8 text-white ml-1" />
                  )}
                </button>
              </div>

              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="mb-2">
                  <div 
                    ref={progressBarRef}
                    className="w-full h-1 bg-black bg-opacity-30 rounded-full cursor-pointer group/progress"
                    onClick={handleProgressClick}
                  >
                    {/* Buffered progress */}
                    <div 
                      className="absolute h-1 bg-white bg-opacity-30 rounded-full"
                      style={{ width: `${buffered}%` }}
                    />
                    {/* Current progress */}
                    <div 
                      className="h-1 bg-white rounded-full relative transition-all duration-150"
                      style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    >
                      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>

                {/* Bottom controls */}
                <div className="flex items-center justify-between text-white text-sm">
                  <div className="flex items-center space-x-3">
                    {/* Time display */}
                    <span className="text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Volume control */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleMute()
                      }}
                      className="p-2 bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full transition-all duration-200 video-control-btn"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 text-white" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-white" />
                      )}
                    </button>

                    {/* Fullscreen button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFullscreen()
                      }}
                      className="p-2 bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full transition-all duration-200 video-control-btn"
                    >
                      <Maximize className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        )}
        
        {/* Enhanced video error state */}
        {post.video && videoError && (
          <div className="relative overflow-hidden rounded-xl mb-2 bg-gradient-to-br from-gray-100 to-gray-200 h-48 flex items-center justify-center">
            <div className="text-center p-6">
              <div className="bg-red-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Play className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-gray-800 font-medium mb-2">Video Unavailable</h3>
              <p className="text-gray-500 text-sm mb-4">Unable to load this video. Please check your connection and try again.</p>
              <div className="flex space-x-2 justify-center">
                <button
                  onClick={() => {
                    setVideoError(false)
                    setVideoLoading(true)
                    const video = videoRef.current
                    if (video) {
                      video.load()
                    }
                  }}
                  className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          </div>
        )}

                <div className="mb-2">
          <p className="text-gray-700 text-sm leading-relaxed">
            {isExpanded ? (
              <>
                {contentToDisplay}
                {needsTruncation && (
                  <>
                    {' '}
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
                    >
                      Less
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {getDisplayContent()}
                {needsTruncation && (
                  <>
                    ...{' '}
                    <button
                      onClick={() => setIsExpanded(true)}
                      className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
                    >
                      More
                    </button>
                  </>
                )}
              </>
            )}
          </p>
        </div>

        {/* View Details Section - only for non-news posts */}
        {!(post.source === 'news' || post.post_type === 'news') && (
          <div className="mb-3 overflow-visible">
            <button
              onClick={handleShowDetailsToggle}
              className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors group hover:bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4" />
                <span>More Details</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Details Panel */}
            <div className={`transition-all duration-300 ${showDetails ? 'opacity-100 visible' : 'opacity-0 invisible h-0'}`}>
              <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2 relative z-10">
                {/* Assignee - Always show */}
                <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                  {post.assignee && post.assignee_info ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Building className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-xs font-medium text-gray-700">Assigned Representative</span>
                              <CheckCircle className="w-3 h-3 text-green-500" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {post.assignee_info.title_info.abbreviation && (
                                    <span className="text-blue-600">{post.assignee_info.title_info.abbreviation}</span>
                                  )}
                                  {post.assignee_info.title_info.abbreviation && ' '}
                                  {post.assignee_info.title_info.title_name}
                                </span>
                              </div>
                              <div className="text-xs text-gray-600">
                                {post.assignee_info.jurisdiction_info.level_name}: {post.assignee_info.jurisdiction_info.name}
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Show actions if user is the post author or current assignee */}
                        {currentUser && (currentUser.id === post.author.id) && (
                          <div className="flex items-center space-x-1">
                            <button 
                              onClick={handleAssignClick}
                              disabled={assigneeLoading}
                              className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
                            >
                              {assigneeLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserPlus className="w-3 h-3" />
                              )}
                              <span>Change</span>
                            </button>
                            <button 
                              onClick={() => handleAssigneeUpdate(null)}
                              disabled={assigneeLoading}
                              className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              Unassign
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : post.assignee ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <User className="w-4 h-4 text-gray-500" />
                        <div className="flex-1">
                          <span className="text-xs font-medium text-gray-700">Assignee:</span>
                          <span className="text-xs text-gray-600 ml-2">{post.assignee}</span>
                        </div>
                      </div>
                      {/* Show actions if user is the post author */}
                      {currentUser && currentUser.id === post.author.id && (
                        <div className="flex items-center space-x-1">
                          <button 
                            onClick={handleAssignClick}
                            disabled={assigneeLoading}
                            className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
                          >
                            {assigneeLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            <span>Change</span>
                          </button>
                          <button 
                            onClick={() => handleAssigneeUpdate(null)}
                            disabled={assigneeLoading}
                            className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            Unassign
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <User className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-xs font-medium text-gray-700">Assigned Representative</span>
                            </div>
                            <div className="text-sm text-gray-500">Not assigned</div>
                          </div>
                        </div>
                        {/* Show assign button only if user is the post author */}
                        {currentUser && currentUser.id === post.author.id && (
                          <button 
                            onClick={handleAssignClick}
                            disabled={assigneeLoading}
                            className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
                          >
                            {assigneeLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            <span>Assign</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status */}
                {post.status && (
                  <div className="flex items-center space-x-3 p-2 bg-white rounded border border-gray-200">
                    <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                    <div className="flex-1">
                      <span className="text-xs font-medium text-gray-700">Status:</span>
                      <div className="inline-block ml-2">
                        {customDetailsStatusComponent || customStatusComponent || (
                          <StatusBadge 
                            status={post.status as TicketStatus} 
                            size="sm" 
                            variant="default"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Time Information */}
                {(post.updated_at || post.created_at) && (
                  <div className="space-y-2">
                    {post.updated_at && (
                      <div className="flex items-center space-x-3 p-2 bg-white rounded border border-gray-200">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <div className="flex-1">
                          <span className="text-xs font-medium text-gray-700">Updated:</span>
                          <span className="text-xs text-gray-600 ml-2">
                            {new Date(post.updated_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    )}

                    {post.created_at && (
                      <div className="flex items-center space-x-3 p-2 bg-white rounded border border-gray-200">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <div className="flex-1">
                          <span className="text-xs font-medium text-gray-700">Created:</span>
                          <span className="text-xs text-gray-600 ml-2">
                            {new Date(post.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Location Information */}
                {(post.author.rep_accounts && post.author.rep_accounts.length > 0) && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 p-2 bg-white rounded border border-gray-200">
                      <MapIcon className="w-4 h-4 text-gray-500" />
                      <div className="flex-1">
                        <span className="text-xs font-medium text-gray-700">Jurisdiction:</span>
                        <span className="text-xs text-gray-600 ml-2">
                          {post.author.rep_accounts[0]?.jurisdiction?.name || 'Not specified'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-2 border-t border-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <button
              onClick={(post.source === 'news' || post.post_type === 'news') ? undefined : throttledUpvote.current}
              disabled={post.source === 'news' || post.post_type === 'news'}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-all transform hover:scale-105 active:scale-95 ${
                (post.source === 'news' || post.post_type === 'news')
                  ? 'opacity-50 cursor-not-allowed'
                  : post.is_upvoted 
                    ? 'bg-green-100 text-green-700 shadow-glow-green' 
                    : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <ArrowUp className={`w-4 h-4 ${post.is_upvoted ? 'fill-current' : ''}`} />
              <span className="text-sm font-medium">{post.upvotes}</span>
            </button>
            
            <button
              onClick={(post.source === 'news' || post.post_type === 'news') ? undefined : throttledDownvote.current}
              disabled={post.source === 'news' || post.post_type === 'news'}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-all transform hover:scale-105 active:scale-95 ${
                (post.source === 'news' || post.post_type === 'news')
                  ? 'opacity-50 cursor-not-allowed'
                  : post.is_downvoted 
                    ? 'bg-red-100 text-red-700 shadow-glow-red' 
                    : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <ArrowDown className={`w-4 h-4 ${post.is_downvoted ? 'fill-current' : ''}`} />
              <span className="text-sm font-medium">{post.downvotes}</span>
            </button>
            
            <button 
              onClick={(post.source === 'news' || post.post_type === 'news') ? undefined : () => navigate(`/post/${post.id}/comments`)}
              disabled={post.source === 'news' || post.post_type === 'news'}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-all transform hover:scale-105 active:scale-95 ${
                (post.source === 'news' || post.post_type === 'news')
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{post.comment_count}</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={(post.source === 'news' || post.post_type === 'news') ? undefined : throttledSave.current}
              disabled={post.source === 'news' || post.post_type === 'news'}
              className={`p-2 rounded-lg transition-all transform hover:scale-105 active:scale-95 ${
                (post.source === 'news' || post.post_type === 'news')
                  ? 'opacity-50 cursor-not-allowed'
                  : post.is_saved 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${post.is_saved ? 'fill-current' : ''}`} />
            </button>
            
            <button 
              onClick={handleShare}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-all transform hover:scale-105 active:scale-95"
            >
              <Share className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Show comment count preview - only for regular posts */}
        {post.comment_count > 0 && !(post.source === 'news' || post.post_type === 'news') && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => navigate(`/post/${post.id}/comments`)}
              className="w-full text-left hover:bg-gray-50 -mx-2 p-2 rounded-lg transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Assignee Selection Modal */}
      {showAssigneeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Assign Representative</h3>
              <button
                onClick={() => setShowAssigneeModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <AssigneeSelection
                postId={post.id}
                latitude={post.latitude}
                longitude={post.longitude}
                currentAssignee={post.assignee}
                onAssign={async (assigneeId) => {
                  await handleAssigneeUpdate(assigneeId)
                  setShowAssigneeModal(false)
                }}
                onCancel={() => setShowAssigneeModal(false)}
                isLoading={assigneeLoading}
                showHeader={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
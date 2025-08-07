import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Send, Heart, MessageCircle, Share2, MoreVertical, ThumbsUp, ThumbsDown } from 'lucide-react'
import { CivicPost, Comment } from '../types'
import { useUser } from '../contexts/UserContext'
import { usePosts } from '../contexts/PostContext'
import { commentsService } from '../services/comments'
import { postsService } from '../services/posts'
import Avatar from '../components/Avatar'

export default function CommentsPage() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const [post, setPost] = useState<CivicPost | null>(null)
  const [commentText, setCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [loadingPost, setLoadingPost] = useState(true)
  const { user } = useUser()
  const { addComment } = usePosts()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (postId) {
      loadPost()
      loadComments()
    }
  }, [postId])

  const loadPost = async () => {
    if (!postId) return
    
    setLoadingPost(true)
    try {
      const fetchedPost = await postsService.getPost(postId)
      setPost(fetchedPost)
    } catch (error) {
      // Post loading failed - could be handled with user notification
    } finally {
      setLoadingPost(false)
    }
  }

  const loadComments = async () => {
    if (!postId) return
    
    setLoadingComments(true)
    try {
      const fetchedComments = await commentsService.getComments(postId)
      setComments(fetchedComments)
    } catch (error) {
      setComments([]) // Reset comments array on error
    } finally {
      setLoadingComments(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !commentText.trim() || isSubmitting || !post) return

    setIsSubmitting(true)
    const text = commentText.trim()
    setCommentText('')

    try {
      await addComment(post.id, text, user as any)
      // Refresh comments after adding new one
      await loadComments()
      // Update post comment count
      setPost(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : null)
    } catch (error) {
      setCommentText(text) // Restore text on error
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentText(e.target.value)
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString()
  }

  if (loadingPost) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Post not found</h2>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-700"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-900" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Comments</h1>
            <div className="flex items-center space-x-2">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <MessageCircle className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments List - Vertical Scrolling Feed */}
      <div className="flex-1 overflow-y-auto">
        {post.comment_count === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-4"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-gray-900 mb-2">No comments yet</h3>
            <p className="text-sm text-gray-500">Be the first to share your thoughts!</p>
          </motion.div>
        ) : loadingComments ? (
          <div className="text-center py-16">
            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">Loading comments...</p>
          </div>
        ) : (
          <div className="py-2">
            {comments.map((comment, index) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="px-4 py-3"
              >
                <div className="flex space-x-3">
                  {/* Profile Picture */}
                  <Avatar
                    src={comment.author.avatar_url}
                    alt={comment.author.display_name || 'User'}
                    size="sm"
                    className="flex-shrink-0"
                  />
                  
                  {/* Comment Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {comment.author.display_name || comment.author.username || 'User'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    
                    {/* Comment Text */}
                    <p className="text-sm text-gray-900 leading-relaxed mb-2">
                      {comment.content}
                    </p>
                    
                    {/* Comment Actions */}
                    <div className="flex items-center space-x-4">
                      <button className="text-xs text-gray-500 font-medium hover:text-gray-700">
                        Reply
                      </button>
                      <button className="text-xs text-gray-500 font-medium hover:text-gray-700">
                        Hide
                      </button>
                      {comment.upvotes > 0 && (
                        <div className="flex items-center space-x-1">
                          <Heart className="w-3 h-3 text-red-500 fill-current" />
                          <span className="text-xs text-gray-500">{comment.upvotes}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Show "Hide replies" if this comment has replies */}
                    <button className="mt-2 text-xs text-gray-500 font-medium hover:text-gray-700">
                      ─── Hide replies
                    </button>
                  </div>
                  
                  {/* Heart Button on Right */}
                  <button className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors" />
                  </button>
                </div>
                
                {/* Example Reply with Indentation */}
                {index === 0 && (
                  <div className="ml-10 mt-3 flex space-x-3">
                    <Avatar
                      src={comment.author.avatar_url}
                      alt="Reply Author"
                      size="sm"
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">
                          yoursuccessstory
                        </span>
                        <span className="text-xs text-gray-500">
                          3d
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 leading-relaxed mb-2">
                        Thanks so much! We're glad you're enjoying our content! Keep following for more inspiration! ⭐ 💪
                      </p>
                      <div className="flex items-center space-x-4">
                        <button className="text-xs text-gray-500 font-medium hover:text-gray-700">
                          Reply
                        </button>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">1</span>
                        </div>
                      </div>
                    </div>
                    <button className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-full transition-colors">
                      <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Emoji Reactions Row */}
      <div className="bg-white border-t border-gray-100 px-4 py-2 relative z-50">
        <div className="flex items-center justify-center space-x-6">
          <button className="text-xl hover:scale-110 transition-transform">❤️</button>
          <button className="text-xl hover:scale-110 transition-transform">🙌</button>
          <button className="text-xl hover:scale-110 transition-transform">🔥</button>
          <button className="text-xl hover:scale-110 transition-transform">👏</button>
          <button className="text-xl hover:scale-110 transition-transform">😢</button>
          <button className="text-xl hover:scale-110 transition-transform">😍</button>
          <button className="text-xl hover:scale-110 transition-transform">😮</button>
          <button className="text-xl hover:scale-110 transition-transform">😂</button>
        </div>
      </div>

      {/* Comment Input - Fixed at bottom with proper z-index */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 relative z-50">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center space-x-3">
            <Avatar
              src={user?.avatar_url}
              alt={user?.display_name || 'You'}
              size="sm"
              className="flex-shrink-0"
            />
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={handleTextareaChange}
                placeholder="Add a comment..."
                className="w-full px-4 py-2 pr-12 border border-gray-200 rounded-full focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none overflow-hidden min-h-[36px] max-h-20 transition-all duration-200 text-sm bg-gray-50 focus:bg-white"
                rows={1}
                disabled={isSubmitting}
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || isSubmitting}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-full transition-all duration-200 ${
                  commentText.trim() && !isSubmitting
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                aria-label="Send comment"
              >
                {isSubmitting ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </button>
            </div>
            <button 
              type="button"
              className="flex-shrink-0 px-2 py-1 text-xs font-semibold text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              aria-label="GIF"
            >
              GIF
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

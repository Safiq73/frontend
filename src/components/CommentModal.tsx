import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send } from 'lucide-react'
import { CivicPost, Comment } from '../types'
import { useUser } from '../contexts/UserContext'
import { usePosts } from '../contexts/PostContext'
import { commentsService } from '../services/comments'
import Avatar from './Avatar'

interface CommentModalProps {
  post: CivicPost
  isOpen: boolean
  onClose: () => void
}

export default function CommentModal({ post, isOpen, onClose }: CommentModalProps) {
  const [commentText, setCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const { user } = useUser()
  const { addComment } = usePosts()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
      // Focus textarea after animation
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 300)
      
      // Fetch comments when modal opens
      loadComments()
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, post.id])

  const loadComments = async () => {
    if (post.comment_count === 0) return
    
    setLoadingComments(true)
    try {
      const fetchedComments = await commentsService.getComments(post.id)
      setComments(fetchedComments)
    } catch (error) {
      console.error('Failed to load comments:', error)
    } finally {
      setLoadingComments(false)
    }
  }

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !commentText.trim() || isSubmitting) return

    setIsSubmitting(true)
    const text = commentText.trim()
    setCommentText('')

    try {
      await addComment(post.id, text, user as any)
      // Refresh comments after adding new one
      await loadComments()
    } catch (error) {
      setCommentText(text) // Restore text on error
      console.error('Failed to add comment:', error)
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

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] modal-overlay">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-[99999]"
        />

        {/* Modal - Always from bottom */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 w-full max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] z-[99999]"
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
          </div>
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 relative z-[100000]">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                {post.comment_count}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 relative z-[100001] cursor-pointer touch-manipulation"
              type="button"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="Close comments"
            >
              <X className="w-5 h-5 text-gray-500 pointer-events-none" />
            </button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {post.comment_count === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="text-2xl">💬</div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No comments yet</h3>
                <p className="text-gray-500 text-sm">Be the first to share your thoughts!</p>
              </div>
            ) : loadingComments ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 text-sm">Loading comments...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <Avatar
                      src={comment.author.avatar_url}
                      alt={comment.author.display_name || 'User'}
                      size="sm"
                    />
                    <div className="flex-1">
                      <div className="bg-gray-50 rounded-2xl px-4 py-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-sm text-gray-900">
                            {comment.author.display_name || comment.author.username || 'User'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-800 text-sm leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                      {/* Vote buttons could be added here */}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>{comment.upvotes} upvotes</span>
                        <span>{comment.downvotes} downvotes</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comment Input */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-end space-x-3">
                <Avatar
                  src={user?.avatar_url}
                  alt={user?.display_name || 'You'}
                  size="md"
                />
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    value={commentText}
                    onChange={handleTextareaChange}
                    placeholder="Add a comment..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none overflow-hidden min-h-[44px] max-h-32 transition-all duration-200"
                    rows={1}
                    disabled={isSubmitting}
                    maxLength={500}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!commentText.trim() || isSubmitting}
                  className={`p-3 rounded-full transition-all duration-200 ${
                    commentText.trim() && !isSubmitting
                      ? 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 shadow-lg'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  aria-label="Send comment"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              
              {/* Character count */}
              {commentText.length > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">
                    {commentText.length}/500 characters
                  </span>
                  {commentText.length > 450 && (
                    <span className="text-orange-500 font-medium">
                      {500 - commentText.length} remaining
                    </span>
                  )}
                </div>
              )}
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

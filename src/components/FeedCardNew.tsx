import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CivicPost } from '../types'
import { StatusBadge, TicketStatus } from './UI/TicketStatus'
import { Heart, MessageCircle, Share, ArrowUp, ArrowDown, Bookmark, MapPin, Clock, User, AlertTriangle, CheckCircle2, Megaphone, Trophy, Play, Pause, Volume2, VolumeX, MoreHorizontal, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePosts } from '../contexts/PostContext'
import Avatar from './Avatar'
import { Card, Badge, Button } from './UI'

interface FeedCardProps {
  post: CivicPost
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

export default function FeedCardNew({ post }: FeedCardProps) {
  const navigate = useNavigate()
  const { toggleUpvote, toggleDownvote, toggleSave } = usePosts()
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Throttled versions of the action functions
  const throttledUpvote = useRef(throttle(() => toggleUpvote(post.id), 1000))
  const throttledDownvote = useRef(throttle(() => toggleDownvote(post.id), 1000))
  const throttledSave = useRef(throttle(() => toggleSave(post.id), 1000))

  const getPostTypeColor = (type: string) => {
    switch (type) {
      case 'news':
        return 'primary'
      case 'announcement':
        return 'info'
      case 'issue':
        return 'danger'
      case 'accomplishment':
        return 'success'
      default:
        return 'default'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'warning'
      case 'in_progress':
        return 'info'
      case 'resolved':
        return 'success'
      case 'closed':
        return 'danger'
      default:
        return 'default'
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.content,
          url: window.location.href,
        })
      } catch (error) {
        console.log('Error sharing:', error)
      }
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4"
    >
      <Card variant="elevated" padding="lg" interactive>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Avatar
              src={post.author?.avatar_url}
              alt={post.author?.username || 'User'}
              size="md"
              className="ring-2 ring-white shadow-md"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-semibold text-gray-900">
                  {post.author?.display_name || post.author?.username || 'Anonymous'}
                </h4>
                {post.author?.verified && (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                {/* Use rep_accounts info first, fallback to role_name */}
                {(() => {
                  // Debug logging
                  
                  if (post.author?.rep_accounts && post.author.rep_accounts.length > 0) {
                    const repAccount = post.author.rep_accounts[0];
                    return (
                      <span className="flex items-center space-x-1">
                        {repAccount.title.abbreviation && (
                          <span className="font-semibold text-primary-600">{repAccount.title.abbreviation}</span>
                        )}
                        <span className="text-primary-600">•</span>
                        <span className="text-primary-600">{repAccount.jurisdiction.name}</span>
                      </span>
                    );
                  } else {
                    console.log('FeedCardNew - Using role_name or fallback:', post.author?.role_name);
                    return <span>{post.author?.role_name || 'Citizen'}</span>;
                  }
                })()}
                <span>•</span>
                <span>{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          
          <button className="icon-btn">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
            {post.title}
          </h3>
          
          <div className="flex items-center space-x-2 mb-3">
            <Badge variant={getPostTypeColor(post.post_type)} size="sm">
              {post.post_type}
            </Badge>
            {post.status && (
              <StatusBadge 
                status={post.status as TicketStatus} 
                size="sm"
                variant="default"
              />
            )}
          </div>

          <p className={`text-gray-700 leading-relaxed ${
            !isExpanded && post.content.length > 200 ? 'line-clamp-3' : ''
          }`}>
            {post.content}
          </p>
          
          {post.content.length > 200 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-primary-600 text-sm font-medium mt-2 hover:text-primary-700 transition-colors"
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {/* Media */}
        {(post.image || post.url_to_image) && (
          <div className="relative overflow-hidden rounded-2xl mb-4 group">
            {imageLoading && (
              <div className="skeleton w-full h-64 bg-gray-200 animate-pulse rounded-2xl"></div>
            )}
            <motion.img
              src={post.image || post.url_to_image}
              alt={post.title}
              className={`w-full h-64 object-cover rounded-2xl transition-all duration-300 ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              } group-hover:scale-105`}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true)
                setImageLoading(false)
              }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            />
            {post.external_url && (
              <div className="absolute bottom-3 left-3">
                <motion.a
                  href={post.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 bg-black/70 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all backdrop-blur-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>View Source</span>
                </motion.a>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-1">
            {/* Upvote */}
            <motion.button
              onClick={() => throttledUpvote.current()}
              className={`icon-btn ${
                post.user_vote === 'upvote' ? 'text-green-600 bg-green-50' : ''
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <ArrowUp className="w-4 h-4" />
              <span className="text-xs font-medium ml-1">{post.upvotes || 0}</span>
            </motion.button>

            {/* Downvote */}
            <motion.button
              onClick={() => throttledDownvote.current()}
              className={`icon-btn ${
                post.user_vote === 'downvote' ? 'text-red-600 bg-red-50' : ''
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <ArrowDown className="w-4 h-4" />
              <span className="text-xs font-medium ml-1">{post.downvotes || 0}</span>
            </motion.button>

            {/* Comments */}
            <motion.button
              onClick={() => navigate(`/post/${post.id}/comments`)}
              className="icon-btn"
              whileTap={{ scale: 0.9 }}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs font-medium ml-1">{post.comment_count || 0}</span>
            </motion.button>
          </div>

          <div className="flex items-center space-x-1">
            {/* Save */}
            <motion.button
              onClick={() => throttledSave.current()}
              className={`icon-btn ${
                post.is_saved ? 'text-yellow-600 bg-yellow-50' : ''
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <Bookmark className="w-4 h-4" />
            </motion.button>

            {/* Share */}
            <motion.button
              onClick={handleShare}
              className="icon-btn"
              whileTap={{ scale: 0.9 }}
            >
              <Share className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

import { apiClient, ApiResponse, PaginatedResponse } from './api'
import { CivicPost } from '../types'

// Helper function to transform backend post data to frontend format
function transformPost(backendPost: any): CivicPost {
  return {
    ...backendPost,
    // Map user_vote enum to boolean fields for backward compatibility
    is_upvoted: backendPost.user_vote === 'upvote',
    is_downvoted: backendPost.user_vote === 'downvote',
    // Handle media_urls vs images backward compatibility
    images: backendPost.media_urls || backendPost.images,
    // Handle status enum differences - keep backend format
    status: backendPost.status
  }
}

export interface PostFilters {
  page?: number
  size?: number
  post_type?: string
  status?: string
  category?: string
  sort_by?: string
  order?: 'asc' | 'desc'
  include_follow_status?: boolean  // NEW: Include follow status for post authors
}

export interface CreatePostRequest {
  title: string
  content: string  // Changed from 'description' to 'content'
  post_type: 'issue' | 'announcement' | 'news' | 'accomplishment' | 'discussion'  // Changed from 'type' to 'post_type'
  assignee: string  // Required: UUID of representative
  area?: string  // Changed from 'area' to optional
  category?: string
  location?: string  // Added location field
  latitude?: number  // Added latitude
  longitude?: number  // Added longitude
  tags?: string[]  // Added tags
  media_urls?: string[]  // Added media_urls
}

export interface UpdatePostRequest {
  title?: string
  content?: string  // Changed from 'description' to 'content'
  post_type?: 'issue' | 'announcement' | 'news' | 'accomplishment' | 'discussion'
  status?: 'open' | 'in_progress' | 'resolved' | 'closed'  // Updated to match backend enum
  area?: string
  category?: string
  location?: string
  tags?: string[]
  media_urls?: string[]
}

export const postsService = {
  async getPosts(filters: PostFilters = {}): Promise<PaginatedResponse<CivicPost>> {
    const searchParams = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString())
      }
    })

    const queryString = searchParams.toString()
    const endpoint = `/posts${queryString ? `?${queryString}` : ''}`
    
    const response = await apiClient.get<PaginatedResponse<any>>(endpoint)
    
    // Transform backend response to frontend format
    return {
      ...response,
      items: response.items.map(transformPost)
    }
  },

  async getAssignedPosts(representativeIds: string[], filters: PostFilters = {}): Promise<PaginatedResponse<CivicPost>> {
    const searchParams = new URLSearchParams()
    
    // Add assignee filters
    representativeIds.forEach(id => {
      searchParams.append('assignee', id)
    })
    
    // Add other filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && key !== 'assignee') {
        searchParams.append(key, value.toString())
      }
    })

    const queryString = searchParams.toString()
    const endpoint = `/posts/posts-only${queryString ? `?${queryString}` : ''}`
    
    const response = await apiClient.get<PaginatedResponse<any>>(endpoint)
    
    // Transform backend response to frontend format
    return {
      ...response,
      items: response.items.map(transformPost)
    }
  },

  async getPost(postId: string): Promise<CivicPost> {
    const response = await apiClient.get<ApiResponse<any>>(`/posts/${postId}`)
    if (response.success && response.data) {
      return transformPost(response.data)
    }
    throw new Error(response.error || 'Failed to fetch post')
  },

  async createPost(postData: CreatePostRequest): Promise<CivicPost> {
    // Convert to FormData since backend expects multipart/form-data
    const formData = new FormData()
    
    // Add required fields
    formData.append('title', postData.title)
    formData.append('content', postData.content)
    formData.append('post_type', postData.post_type)
    
    // Add assignee (required by backend)
    if (postData.assignee) {
      formData.append('assignee', postData.assignee)
    } else {
      // If no assignee provided, we need to handle this
      throw new Error('Assignee is required for creating posts')
    }
    
    // Add optional fields
    if (postData.location) {
      formData.append('location', postData.location)
    }
    if (postData.latitude !== undefined) {
      formData.append('latitude', postData.latitude.toString())
    }
    if (postData.longitude !== undefined) {
      formData.append('longitude', postData.longitude.toString())
    }
    
    // Handle media files if provided
    if (postData.media_urls && postData.media_urls.length > 0) {
      // Note: This is for URLs, but backend expects files
      // You might need to handle file uploads differently
      console.warn('Media URLs provided but backend expects file uploads')
    }
    
    const response = await apiClient.postFormData<ApiResponse<{ post: any }>>('/posts', formData)
    if (response.success && response.data?.post) {
      return transformPost(response.data.post)
    }
    throw new Error(response.error || 'Failed to create post')
  },

  async updatePost(postId: string, postData: UpdatePostRequest): Promise<CivicPost> {
    const response = await apiClient.put<ApiResponse<{ post: any }>>(`/posts/${postId}`, postData)
    if (response.success && response.data?.post) {
      return transformPost(response.data.post)
    }
    throw new Error(response.error || 'Failed to update post')
  },

  async deletePost(postId: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse>(`/posts/${postId}`)
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete post')
    }
  },

  async upvotePost(postId: string): Promise<{ upvotes: number; downvotes: number; is_upvoted: boolean; is_downvoted: boolean }> {
    const response = await apiClient.post<ApiResponse<any>>(`/posts/${postId}/vote?vote_type=up`)
    if (response.success && response.data) {
      // Map backend response to frontend format
      const data = response.data
      return {
        upvotes: data.upvotes,
        downvotes: data.downvotes,
        is_upvoted: data.is_upvoted,
        is_downvoted: data.is_downvoted
      }
    }
    throw new Error(response.error || 'Failed to upvote post')
  },

  async downvotePost(postId: string): Promise<{ upvotes: number; downvotes: number; is_upvoted: boolean; is_downvoted: boolean }> {
    const response = await apiClient.post<ApiResponse<any>>(`/posts/${postId}/vote?vote_type=down`)
    if (response.success && response.data) {
      // Map backend response to frontend format
      const data = response.data
      return {
        upvotes: data.upvotes,
        downvotes: data.downvotes,
        is_upvoted: data.is_upvoted,
        is_downvoted: data.is_downvoted
      }
    }
    throw new Error(response.error || 'Failed to downvote post')
  },

  async savePost(postId: string): Promise<{ is_saved: boolean }> {
    const response = await apiClient.post<ApiResponse<any>>(`/posts/${postId}/save`)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to save post')
  },

  async updatePostStatus(postId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed'): Promise<CivicPost> {
    const response = await apiClient.patch<ApiResponse<{ post: any }>>(`/posts/${postId}/status`, { status })
    if (response.success && response.data?.post) {
      return transformPost(response.data.post)
    }
    throw new Error(response.error || 'Failed to update post status')
  },

  async updatePostAssignee(postId: string, assigneeId: string | null): Promise<CivicPost> {
    const response = await apiClient.patch<ApiResponse<{ post: any }>>(`/posts/${postId}/assignee`, { 
      assignee: assigneeId 
    })
    if (response.success && response.data?.post) {
      return transformPost(response.data.post)
    }
    throw new Error(response.error || 'Failed to update post assignee')
  },

  async getRepresentativesByLocation(latitude: number, longitude: number): Promise<ApiResponse<any>> {
    const response = await apiClient.get<ApiResponse<any>>(`/posts/representatives/by-location?latitude=${latitude}&longitude=${longitude}`)
    return response
  }
}

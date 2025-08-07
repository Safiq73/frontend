import { apiClient, ApiResponse } from './api'
import { Comment } from '../types'

export interface CreateCommentRequest {
  content: string
  post_id: string
  parent_id?: string // For replies to comments
}

export interface UpdateCommentRequest {
  content: string
}

export const commentsService = {
  async getComments(postId: string): Promise<Comment[]> {
    const response = await apiClient.get<ApiResponse<{ comments: any[]; total: number }>>(`/posts/${postId}/comments`)
    
    if (response.success && response.data?.comments) {
      // Map backend response to frontend format
      const mappedComments = response.data.comments.map((comment: any) => ({
        ...comment,
        // Map user_vote enum to boolean fields for backward compatibility
        is_upvoted: comment.user_vote === 'upvote',
        is_downvoted: comment.user_vote === 'downvote'
      }))
      return mappedComments
    }
    throw new Error(response.error || 'Failed to fetch comments')
  },

  async createComment(commentData: CreateCommentRequest): Promise<Comment> {
    return await apiClient.post<Comment>('/comments', commentData)
  },

  async updateComment(commentId: string, commentData: UpdateCommentRequest): Promise<Comment> {
    return await apiClient.put<Comment>(`/comments/${commentId}`, commentData)
  },

  async deleteComment(commentId: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse>(`/comments/${commentId}`)
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete comment')
    }
  },

  async upvoteComment(commentId: string): Promise<{ upvotes: number; is_upvoted: boolean }> {
    const response = await apiClient.post<ApiResponse<any>>(`/comments/${commentId}/upvote`)
    if (response.success && response.data) {
      // Map backend response to frontend format
      const data = response.data
      return {
        upvotes: data.upvotes,
        is_upvoted: data.user_vote === 'upvote'
      }
    }
    throw new Error(response.error || 'Failed to upvote comment')
  }
}

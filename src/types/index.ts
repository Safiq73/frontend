export interface Role {
  id: string
  role_name: string
  abbreviation: string
  level_rank: number
  role_type: string
  description: string
  level: string
  is_elected: boolean
  term_length?: number
  status: string
  created_at: string
  updated_at: string
}

export interface Representative {
  id: string
  jurisdiction_id: string
  title_id: string
  user_id?: string | null
  jurisdiction_name: string
  jurisdiction_level: string
  title_name: string
  abbreviation?: string
  level_rank?: number
  description?: string
  created_at: string
  updated_at: string
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  district?: string;
  pincode?: string;
}

export interface AssigneeOption {
  id: string;
  name: string;
  type: 'representative';
  title?: string;
  abbreviation?: string;
  jurisdiction?: string;
  level_rank?: number;
}

export interface RepresentativeAccount {
  id: string;
  title: {
    id: string;
    title_name: string;
    abbreviation: string;
    level_rank: number;
    description: string;
  };
  jurisdiction: {
    id: string;
    name: string;
    level_name: string;
  };
  linked_at: string;
}

export interface User {
  id: string
  username: string
  email: string
  display_name?: string
  bio?: string
  avatar_url?: string
  cover_photo?: string
  verified: boolean
  created_at: string
  role_name: string
  role_id?: string
  rep_accounts?: RepresentativeAccount[]
  followers_count: number
  following_count: number
}

export interface Author {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  verified: boolean
  role_name?: string
  rep_accounts?: RepresentativeAccount[]
  followers_count: number
  following_count: number
  bio?: string
  abbreviation?: string
  follow_status?: boolean | null  // NEW: Follow status (null if user is author or not authenticated)
}

export interface CivicPost {
  id: string
  user_id: string
  author: Author  // Changed to use new Author interface with role fields
  post_type: 'issue' | 'announcement' | 'news' | 'accomplishment' | 'discussion'  // Added 'discussion' type
  title: string
  content: string  // Changed from 'description' to 'content'
  assignee?: string  // UUID of representative assigned to handle this post
  assignee_info?: {  // Assignee details from representative API
    id: string
    title_info: {
      title_name: string
      abbreviation?: string
      level_rank?: number
      description?: string
    }
    jurisdiction_info: {
      name: string
      level_name: string
    }
    user_info?: {
      username: string
      display_name?: string
      first_name?: string
      last_name?: string
      avatar_url?: string
    } | null
  }
  image?: string
  video?: string
  media_urls?: string[]  // Changed from 'images' to 'media_urls' to match backend
  latitude?: number  // Geographic coordinates
  longitude?: number  // Geographic coordinates
  created_at: string  // Changed from 'timestamp' to 'created_at'
  updated_at: string  // Added updated_at
  status?: 'open' | 'in_progress' | 'resolved' | 'closed'  // Updated to match backend enum
  upvotes: number
  downvotes: number
  comment_count: number
  view_count: number
  share_count: number
  priority_score: number
  last_activity_at?: string
  user_vote?: 'upvote' | 'downvote' | null  // Changed to match backend enum
  is_upvoted: boolean  // Keep for backward compatibility
  is_downvoted: boolean  // Keep for backward compatibility
  is_saved: boolean
  tags?: string[]  // Added tags array
  source?: 'post' | 'news'  // Added source field to distinguish posts from news
  external_url?: string  // Added for news articles
  source_name?: string  // Added for news source attribution
  // Additional NewsAPI fields for richer news content
  description?: string  // Original news description
  published_at?: string  // Original publish timestamp from news source
  url_to_image?: string  // Direct image URL from news
  news_source_id?: string  // NewsAPI source ID
  author_name?: string  // Original author name from news
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  author: Author  // Changed to use new Author interface with role fields
  content: string
  parent_id?: string
  edited: boolean
  edited_at?: string
  upvotes: number
  downvotes: number
  reply_count: number
  thread_level: number
  thread_path?: string
  created_at: string  // Changed from 'timestamp' to 'created_at'
  updated_at: string
  user_vote?: 'upvote' | 'downvote' | null  // Match backend enum
  replies?: Comment[]
}

export interface Notification {
  id: string
  user_id: string
  post_id?: string
  comment_id?: string
  triggered_by_user_id?: string
  notification_type: 'issue_update' | 'comment' | 'vote' | 'assignment' | 'resolution' | 'mention' | 'follow'  // Match backend enum
  title: string
  message: string
  action_url?: string
  read: boolean
  read_at?: string
  created_at: string  // Changed from 'timestamp' to 'created_at'
}

export interface HighlightStory {
  id: string
  type: 'resolved' | 'alert' | 'event' | 'campaign'
  title: string
  image: string
  content: string
}

export interface Analytics {
  totalIssues: number
  resolvedIssues: number
  averageResolutionTime: number
  topCategories: { name: string; count: number }[]
  areaPerformance: { area: string; rating: number; issuesCount: number }[]
}

// Follow-related types
export interface FollowStats {
  followers_count: number
  following_count: number
}

export interface FollowUser {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  is_verified: boolean
  mutual: boolean
  followed_at: string
}

export interface FollowResponse {
  success: boolean
  is_following: boolean
  mutual: boolean
  followers_count: number
  following_count: number
}

export interface FollowStatusResponse {
  is_following: boolean
  is_followed_by: boolean
  mutual: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  has_more: boolean
}

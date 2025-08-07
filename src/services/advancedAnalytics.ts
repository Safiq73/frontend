import { apiClient } from './api'

// Enhanced Analytics Interfaces for Step 6
export interface AdvancedAnalyticsSummary {
  time_period: string
  start_time: string
  end_time: string
  platform_metrics: PlatformMetrics
  search_analytics: SearchAnalyticsData
  user_behavior: UserBehaviorMetrics
  content_analytics: ContentAnalytics
  trend_analysis: TrendAnalysis
  real_time_stats: RealTimeStats
}

export interface PlatformMetrics {
  total_users: number
  active_users_24h: number
  active_users_7d: number
  total_posts: number
  total_comments: number
  total_searches: number
  engagement_rate: number
  response_time_avg_ms: number
}

export interface SearchAnalyticsData {
  popular_queries: Array<{
    query: string
    search_count: number
    unique_users: number
    avg_results: number
    last_searched: string
  }>
  search_trends: Array<{
    hour: string
    search_count: number
    unique_users: number
    avg_response_time: number
  }>
  entity_breakdown: Array<{
    search_type: string
    count: number
    unique_users: number
  }>
  zero_result_queries: Array<{
    query: string
    count: number
  }>
  total_searches: number
}

export interface UserBehaviorMetrics {
  total_searches: number
  unique_users: number
  average_session_length_seconds: number
  bounce_rate: number
  popular_entity_types: Record<string, number>
  peak_search_hours: number[]
}

export interface ContentAnalytics {
  trending_posts: Array<{
    id: string
    title: string
    area: string
    category: string
    upvotes: number
    comment_count: number
    view_count: number
    author: string
    created_at: string
  }>
  trending_topics: Array<{
    topic: string
    frequency: string
  }>
  popular_areas: Array<{
    area: string
    post_count: number
    total_upvotes: number
    total_comments: number
  }>
  engagement_leaders: Array<{
    username: string
    display_name: string
    posts_count: number
    total_upvotes: number
    comments_count: number
  }>
}

export interface TrendAnalysis {
  growth_trends: Array<{
    date: string
    new_users: number
    new_posts: number
  }>
  search_volume_trends: Array<{
    date: string
    search_volume: number
    unique_searchers: number
  }>
}

export interface RealTimeStats {
  active_users_last_hour: number
  searches_last_hour: number
  avg_response_time_last_hour: number
  recent_posts: number
  recent_comments: number
  timestamp: string
}

export interface SearchInsights {
  weekly_patterns: Array<{
    day_of_week: number
    search_count: number
    avg_results: number
  }>
  query_analysis: Array<{
    query_length: 'short' | 'medium' | 'long'
    count: number
    avg_results: number
  }>
  improving_queries: Array<{
    query: string
    improvement_trend: number
  }>
  time_period: string
  start_time: string
  end_time: string
}

// WebSocket Analytics Events
export interface AnalyticsEvent {
  event_type: 'analytics_update'
  analytics_type: string
  data: any
  timestamp: string
}

export type AnalyticsEventType = 
  | 'platform_metrics' 
  | 'search_trends' 
  | 'user_activity' 
  | 'system_alert' 
  | 'content_update'

class AdvancedAnalyticsService {
  private baseUrl = '/analytics'

  /**
   * Get comprehensive dashboard analytics
   */
  async getDashboardAnalytics(timePeriod: '1d' | '7d' | '30d' = '7d'): Promise<AdvancedAnalyticsSummary> {
    try {
      const response = await apiClient.get<{success: boolean, data: AdvancedAnalyticsSummary}>(
        `${this.baseUrl}/dashboard?time_period=${timePeriod}`
      )
      return response.data
    } catch (error) {
      console.error('Get dashboard analytics failed:', error)
      throw error
    }
  }

  /**
   * Get detailed search insights
   */
  async getSearchInsights(timePeriod: '1d' | '7d' | '30d' = '7d'): Promise<SearchInsights> {
    try {
      const response = await apiClient.get<{success: boolean, data: SearchInsights}>(
        `${this.baseUrl}/search-insights?time_period=${timePeriod}`
      )
      return response.data
    } catch (error) {
      console.error('Get search insights failed:', error)
      throw error
    }
  }

  /**
   * Get real-time platform statistics
   */
  async getRealTimeStats(): Promise<RealTimeStats> {
    try {
      const response = await apiClient.get<{success: boolean, data: RealTimeStats}>(
        `${this.baseUrl}/real-time`
      )
      return response.data
    } catch (error) {
      console.error('Get real-time stats failed:', error)
      throw error
    }
  }

  /**
   * Clear analytics cache
   */
  async clearCache(): Promise<void> {
    try {
      await apiClient.post(`${this.baseUrl}/clear-cache`)
    } catch (error) {
      console.error('Clear analytics cache failed:', error)
      throw error
    }
  }

  /**
   * Start analytics monitoring
   */
  async startMonitoring(): Promise<void> {
    try {
      await apiClient.post('/ws/start-monitoring')
    } catch (error) {
      console.error('Start analytics monitoring failed:', error)
      throw error
    }
  }

  /**
   * Stop analytics monitoring
   */
  async stopMonitoring(): Promise<void> {
    try {
      await apiClient.post('/ws/stop-monitoring')
    } catch (error) {
      console.error('Stop analytics monitoring failed:', error)
      throw error
    }
  }

  /**
   * Get analytics monitoring stats
   */
  async getMonitoringStats(): Promise<any> {
    try {
      const response = await apiClient.get<{success: boolean, data: any}>('/ws/stats')
      return response.data
    } catch (error) {
      console.error('Get monitoring stats failed:', error)
      throw error
    }
  }

  /**
   * Test analytics broadcast
   */
  async testBroadcast(eventType: string, message: string): Promise<void> {
    try {
      const params = new URLSearchParams()
      params.append('event_type', eventType)
      params.append('message', message)
      await apiClient.post(`/ws/broadcast-test?${params.toString()}`)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Test broadcast failed:', error)
      }
      throw error
    }
  }

  /**
   * Check analytics service health
   */
  async checkHealth(): Promise<any> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/health`)
      return response
    } catch (error) {
      console.error('Analytics health check failed:', error)
      throw error
    }
  }
}

// Export singleton instance
export const advancedAnalyticsService = new AdvancedAnalyticsService()

// Keep existing interfaces for backward compatibility
export interface AnalyticsSummary {
  total_posts: number
  total_issues: number
  resolved_issues: number
  total_users: number
  engagement_rate: number
  popular_areas: Array<{ area: string; count: number }>
  recent_activity: Array<{ date: string; posts: number; comments: number }>
}

export interface IssueAnalytics {
  by_status: Record<string, number>
  by_area: Array<{ area: string; count: number }>
  by_category: Array<{ category: string; count: number }>
  resolution_rate: number
  average_resolution_time: number
}

export interface AreaAnalytics {
  area: string
  total_posts: number
  total_issues: number
  resolved_issues: number
  engagement_score: number
  popular_categories: Array<{ category: string; count: number }>
}

// Legacy analytics service for backward compatibility
export const analyticsService = {
  async getDashboardAnalytics(): Promise<AnalyticsSummary> {
    return apiClient.get<AnalyticsSummary>('/analytics/dashboard')
  },

  async getIssueAnalytics(
    area?: string,
    date_from?: string,
    date_to?: string
  ): Promise<IssueAnalytics> {
    const params = new URLSearchParams()
    if (area) params.append('area', area)
    if (date_from) params.append('date_from', date_from)
    if (date_to) params.append('date_to', date_to)
    
    const queryString = params.toString()
    const endpoint = queryString ? `/analytics/issues?${queryString}` : '/analytics/issues'
    
    return apiClient.get<IssueAnalytics>(endpoint)
  },

  async getAreaAnalytics(area: string): Promise<AreaAnalytics> {
    return apiClient.get<AreaAnalytics>(`/analytics/areas/${encodeURIComponent(area)}`)
  }
}

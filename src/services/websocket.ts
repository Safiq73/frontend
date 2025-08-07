/**
 * WebSocket service for real-time search updates
 * Handles connection management and event processing
 */

// Simple event emitter implementation for TypeScript
class SimpleEventEmitter {
  private events: Map<string, Function[]> = new Map();

  on(event: string, callback: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error('Error in event callback:', error);
        }
      });
    }
  }
}

export interface SearchSubscription {
  id: string;
  query: string;
  entityTypes: ('user' | 'post' | 'representative')[];
  filters?: Record<string, any>;
  onUpdate?: (event: SearchUpdateEvent) => void;
}

export interface SearchUpdateEvent {
  event_type: 'new_result' | 'updated_result' | 'removed_result' | 'engagement_update' | 'search_trending' | 'connection_status';
  entity_type: 'user' | 'post' | 'representative';
  entity_id: string;
  data: any;
  affected_queries: string[];
  timestamp: string;
  relevance_score?: number;
  metadata?: Record<string, any>;
}

export interface ConnectionStats {
  total_connections: number;
  total_subscriptions: number;
  entity_subscriptions: Record<string, number>;
  unique_queries: number;
  pending_updates: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

class WebSocketSearchService extends SimpleEventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, SearchSubscription> = new Map();
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private pingInterval: number | null = null;
  private heartbeatInterval = 30000; // 30 seconds
  private url: string;
  private token: string | null = null;

  constructor(baseUrl: string = 'ws://localhost:8000') {
    super();
    this.url = `${baseUrl}/api/v1/ws/search`;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(token?: string): Promise<void> {
    if (this.connectionStatus === ConnectionStatus.CONNECTED || 
        this.connectionStatus === ConnectionStatus.CONNECTING) {
      return;
    }

    this.setConnectionStatus(ConnectionStatus.CONNECTING);
    this.token = token || null;

    try {
      const wsUrl = this.token ? `${this.url}?token=${this.token}` : this.url;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.setConnectionStatus(ConnectionStatus.ERROR);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
    this.clearHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
    this.reconnectAttempts = 0;
  }

  /**
   * Subscribe to real-time search updates
   */
  subscribe(subscription: SearchSubscription): boolean {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return false;
    }

    this.subscriptions.set(subscription.id, subscription);

    const message = {
      type: 'subscribe',
      data: {
        subscription_id: subscription.id,
        query: subscription.query,
        entity_types: subscription.entityTypes,
        filters: subscription.filters || {}
      }
    };

    this.sendMessage(message);
    console.log(`Subscribed to search updates: ${subscription.query}`);
    return true;
  }

  /**
   * Unsubscribe from search updates
   */
  unsubscribe(subscriptionId: string): boolean {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      console.warn('Cannot unsubscribe: WebSocket not connected');
      return false;
    }

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn(`Subscription not found: ${subscriptionId}`);
      return false;
    }

    this.subscriptions.delete(subscriptionId);

    const message = {
      type: 'unsubscribe',
      data: {
        subscription_id: subscriptionId
      }
    };

    this.sendMessage(message);
    console.log(`Unsubscribed from search updates: ${subscriptionId}`);
    return true;
  }

  /**
   * Get connection statistics
   */
  async getStats(): Promise<ConnectionStats | null> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Stats request timeout'));
      }, 5000);

      const handler = (stats: ConnectionStats) => {
        clearTimeout(timeout);
        this.off('stats', handler);
        resolve(stats);
      };

      this.on('stats', handler);

      const message = {
        type: 'get_stats',
        data: {}
      };

      this.sendMessage(message);
    });
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): SearchSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('WebSocket connected');
    this.setConnectionStatus(ConnectionStatus.CONNECTED);
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.startHeartbeat();

    // Resubscribe to all previous subscriptions
    this.resubscribeAll();
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      this.processMessage(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
    this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
    this.clearHeartbeat();

    // Only attempt to reconnect if it wasn't a manual disconnect
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
    this.setConnectionStatus(ConnectionStatus.ERROR);
  }

  /**
   * Process incoming WebSocket message
   */
  private processMessage(message: any): void {
    switch (message.type) {
      case 'batch_update':
        this.handleBatchUpdate(message);
        break;

      case 'subscription_confirmed':
        this.handleSubscriptionConfirmed(message);
        break;

      case 'unsubscription_confirmed':
        this.handleUnsubscriptionConfirmed(message);
        break;

      case 'connection_status':
        this.handleConnectionStatus(message);
        break;

      case 'stats':
        this.handleStats(message);
        break;

      case 'pong':
        this.handlePong(message);
        break;

      case 'error':
        this.handleServerError(message);
        break;

      case 'test_broadcast':
        this.handleTestBroadcast(message);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Handle batch search updates
   */
  private handleBatchUpdate(message: any): void {
    const events: SearchUpdateEvent[] = message.events || [];

    for (const event of events) {
      // Find relevant subscriptions
      const relevantSubscriptions = this.findRelevantSubscriptions(event);

      // Notify subscribers
      for (const subscription of relevantSubscriptions) {
        if (subscription.onUpdate) {
          try {
            subscription.onUpdate(event);
          } catch (error) {
            console.error('Error in subscription callback:', error);
          }
        }
      }

      // Emit global event
      this.emit('searchUpdate', event);
    }

    console.log(`Processed ${events.length} search updates`);
  }

  /**
   * Handle subscription confirmation
   */
  private handleSubscriptionConfirmed(message: any): void {
    console.log(`Subscription confirmed: ${message.subscription_id}`);
    this.emit('subscriptionConfirmed', message);
  }

  /**
   * Handle unsubscription confirmation
   */
  private handleUnsubscriptionConfirmed(message: any): void {
    console.log(`Unsubscription confirmed: ${message.subscription_id}`);
    this.emit('unsubscriptionConfirmed', message);
  }

  /**
   * Handle connection status update
   */
  private handleConnectionStatus(message: any): void {
    console.log(`Connection status: ${message.status}`);
    this.emit('connectionStatus', message);
  }

  /**
   * Handle statistics response
   */
  private handleStats(message: any): void {
    this.emit('stats', message.data);
  }

  /**
   * Handle pong response
   */
  private handlePong(message: any): void {
    // Heartbeat received, connection is healthy
    console.log('Heartbeat received');
  }

  /**
   * Handle server error
   */
  private handleServerError(message: any): void {
    console.error('Server error:', message.message);
    this.emit('error', new Error(message.message));
  }

  /**
   * Handle test broadcast
   */
  private handleTestBroadcast(message: any): void {
    if (import.meta.env.DEV) {
      console.log('Test broadcast received:', message.data);
    }
    this.emit('testBroadcast', message.data);
  }

  /**
   * Find subscriptions relevant to a search update event
   */
  private findRelevantSubscriptions(event: SearchUpdateEvent): SearchSubscription[] {
    const relevant: SearchSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      // Check if entity type matches
      if (!subscription.entityTypes.includes(event.entity_type)) {
        continue;
      }

      // Check if query matches any affected queries
      const queryMatches = event.affected_queries.some(query => 
        query.toLowerCase().includes(subscription.query.toLowerCase()) ||
        subscription.query.toLowerCase().includes(query.toLowerCase())
      );

      if (queryMatches) {
        relevant.push(subscription);
      }
    }

    return relevant;
  }

  /**
   * Send message to WebSocket server
   */
  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }

  /**
   * Set connection status and emit event
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.emit('connectionStatusChanged', status);
      console.log(`Connection status changed: ${status}`);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.connectionStatus === ConnectionStatus.DISCONNECTED || 
        this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.setConnectionStatus(ConnectionStatus.RECONNECTING);
    this.reconnectAttempts++;

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect(this.token || undefined);
    }, delay);
  }

  /**
   * Start heartbeat ping
   */
  private startHeartbeat(): void {
    this.clearHeartbeat();
    
    this.pingInterval = setInterval(() => {
      if (this.connectionStatus === ConnectionStatus.CONNECTED) {
        this.sendMessage({
          type: 'ping',
          data: {}
        });
      }
    }, this.heartbeatInterval);
  }

  /**
   * Clear heartbeat ping
   */
  private clearHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Resubscribe to all active subscriptions
   */
  private resubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      const message = {
        type: 'subscribe',
        data: {
          subscription_id: subscription.id,
          query: subscription.query,
          entity_types: subscription.entityTypes,
          filters: subscription.filters || {}
        }
      };
      this.sendMessage(message);
    }

    if (this.subscriptions.size > 0) {
      console.log(`Resubscribed to ${this.subscriptions.size} search subscriptions`);
    }
  }
}

// Global instance
export const webSocketSearchService = new WebSocketSearchService(
  import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
);

export default webSocketSearchService;

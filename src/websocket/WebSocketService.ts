import { Client } from '@stomp/stompjs';
import { store } from '@/store';

class WebSocketService {
  private static instance: WebSocketService;
  private stompClient: Client | null = null;
  private subscribers: Map<string, Set<(message: any) => void>> = new Map();
  private subscriptions: Map<string, any> = new Map(); // Store STOMP subscription objects
  private pendingSubscriptions: Array<{ topic: string; callback: (message: any) => void }> = [];
  private isConnecting: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private getAuthToken(): string | null {
    return store.getState().auth.token;
  }

  async ensureConnected(): Promise<void> {
    if (this.stompClient?.connected) return;

    if (this.isConnecting) {
      return this.connectionPromise!;
    }

    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      const token = this.getAuthToken();
      if (!token) {
        reject(new Error('No auth token available'));
        return;
      }

      this.stompClient = new Client({
        brokerURL: `wss://localhost:3001/ws`,
        connectHeaders: {
          Authorization: `Bearer ${token}`
        },
        debug: (str: string) => {},
        reconnectDelay: 5000,
        heartbeatIncoming: 15000,
        heartbeatOutgoing: 15000,
      });

      this.stompClient.onConnect = () => {
        this.isConnecting = false;
        this.processPendingSubscriptions();
        resolve();
      };

      this.stompClient.onStompError = (frame) => {
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(frame);
      };

      this.stompClient.activate();
    });

    return this.connectionPromise;
  }

  private processPendingSubscriptions() {
    // Group callbacks by topic to avoid duplicate subscriptions
    const topicCallbacks = new Map<string, Set<(message: any) => void>>();
    
    this.pendingSubscriptions.forEach(({ topic, callback }) => {
      if (!topicCallbacks.has(topic)) {
        topicCallbacks.set(topic, new Set());
      }
      topicCallbacks.get(topic)?.add(callback);
    });
    
    // Subscribe to each topic once with all callbacks
    topicCallbacks.forEach((callbacks, topic) => {
      callbacks.forEach(callback => {
        this.subscribe(topic, callback);
      });
    });
    
    this.pendingSubscriptions = [];
  }

  async subscribe(topic: string, callback: (message: any) => void) {
    try {
      await this.ensureConnected();

      if (!this.subscribers.has(topic)) {
        this.subscribers.set(topic, new Set());
      }
      this.subscribers.get(topic)?.add(callback);

      if (this.stompClient?.connected) {
        // Only create new subscription if not already subscribed to this topic
        if (!this.subscriptions.has(topic)) {
          const subscription = this.stompClient.subscribe(topic, (message) => {
            const parsedMessage = JSON.parse(message.body);
            // Call all callbacks registered for this topic
            const callbacks = this.subscribers.get(topic);
            if (callbacks) {
              callbacks.forEach(cb => cb(parsedMessage));
            }
          });
          this.subscriptions.set(topic, subscription);
        }
      } else {
        this.pendingSubscriptions.push({ topic, callback });
      }
    } catch (error) {
      this.pendingSubscriptions.push({ topic, callback });
    }
  }

  unsubscribe(topic: string, callback: (message: any) => void) {
    const subscribers = this.subscribers.get(topic);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        this.subscribers.delete(topic);
        // Unsubscribe from STOMP using the stored subscription
        const subscription = this.subscriptions.get(topic);
        if (subscription) {
          subscription.unsubscribe();
          this.subscriptions.delete(topic);
        }
      }
    }
  }

  publish(destination: string, body: any) {
    if (!this.stompClient?.connected) {
      return;
    }

    try {
      this.stompClient.publish({
        destination,
        body: JSON.stringify(body)
      });
    } catch (error) {
    }
  }

  unsubscribeFromChannel(channelId: number) {
    const topicsToUnsubscribe: string[] = [];
    
    // Find all topics related to this channel
    this.subscriptions.forEach((subscription, topic) => {
      if (topic.includes(`/channels/${channelId}/`)) {
        topicsToUnsubscribe.push(topic);
      }
    });
    
    // Unsubscribe from all channel-related topics
    topicsToUnsubscribe.forEach(topic => {
      const subscription = this.subscriptions.get(topic);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(topic);
        this.subscribers.delete(topic);
      }
    });
  }

  isConnected(): boolean {
    return this.stompClient?.connected || false;
  }

  disconnect() {
    if (this.stompClient) {
      // Unsubscribe from all topics
      this.subscriptions.forEach((subscription, topic) => {
        subscription.unsubscribe();
      });
      this.subscriptions.clear();
      this.subscribers.clear();
      
      this.stompClient.deactivate();
      this.stompClient = null;
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }
}

export const webSocketService = WebSocketService.getInstance(); 
import { Client } from '@stomp/stompjs';

class WebSocketService {
  private static instance: WebSocketService;
  private stompClient: Client | null = null;
  private subscribers: Map<string, Set<(message: any) => void>> = new Map();
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
    return localStorage.getItem('jwt');
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
        debug: (str: string) => {
          console.log(str);
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 15000,
        heartbeatOutgoing: 15000,
      });

      this.stompClient.onConnect = () => {
        console.log('Connected to WebSocket');
        this.isConnecting = false;
        this.processPendingSubscriptions();
        resolve();
      };

      this.stompClient.onStompError = (frame) => {
        console.error('STOMP error:', frame);
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(frame);
      };

      this.stompClient.activate();
    });

    return this.connectionPromise;
  }

  private processPendingSubscriptions() {
    this.pendingSubscriptions.forEach(({ topic, callback }) => {
      this.subscribe(topic, callback);
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
        this.stompClient.subscribe(topic, (message) => {
          const parsedMessage = JSON.parse(message.body);
          callback(parsedMessage);
        });
      } else {
        this.pendingSubscriptions.push({ topic, callback });
      }
    } catch (error) {
      console.error('Failed to subscribe:', error);
      this.pendingSubscriptions.push({ topic, callback });
    }
  }

  unsubscribe(topic: string, callback: (message: any) => void) {
    const subscribers = this.subscribers.get(topic);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        this.subscribers.delete(topic);
        if (this.stompClient?.connected) {
          this.stompClient.unsubscribe(topic);
        }
      }
    }
  }

  publish(destination: string, body: any) {
    if (!this.stompClient?.connected) {
      console.error('WebSocket is not connected');
      return;
    }

    try {
      this.stompClient.publish({
        destination,
        body: JSON.stringify(body)
      });
    } catch (error) {
      console.error('Failed to publish message:', error);
    }
  }

  disconnect() {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }
}

export const webSocketService = WebSocketService.getInstance(); 
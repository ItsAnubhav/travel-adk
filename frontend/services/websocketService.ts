
import { WSMessage, ContextData } from '../types';

class WebSocketService {
  private socket: WebSocket | null = null;
  private onMessageCallback: ((data: WSMessage) => void) | null = null;
  private onOpenCallback: (() => void) | null = null;
  private onCloseCallback: ((event: CloseEvent) => void) | null = null;
  private onErrorCallback: ((event: Event) => void) | null = null;
  private isConnecting: boolean = false;

  connect(sessionId: string, context: ContextData) {
    const query = new URLSearchParams(context).toString();
    const wsBase = (
      import.meta.env.VITE_WS_BASE_URL ||
      import.meta.env.VITE_API_BASE_URL ||
      window.location.origin
    ).replace(/\/$/, '');
    const normalizedWsBase = wsBase
      .replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:');
    const uri = `${normalizedWsBase}/ws/${sessionId}${query ? '?' + query : ''}`;
    
    // Prevent multiple simultaneous connections
    if (this.isConnecting) {
      console.warn('Connection already in progress');
      return;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.isConnecting = true;
    this.socket = new WebSocket(uri);

    this.socket.onopen = () => {
      console.log('WS Connected');
      this.isConnecting = false;
      if (this.onOpenCallback) this.onOpenCallback();
    };

    this.socket.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        if (this.onMessageCallback) this.onMessageCallback(data);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    this.socket.onerror = (event) => {
      console.error('WS Error:', event);
      if (this.onErrorCallback) this.onErrorCallback(event);
    };

    this.socket.onclose = (event) => {
      console.log('WS Closed:', event.code, event.reason);
      this.isConnecting = false;
      if (this.onCloseCallback) this.onCloseCallback(event);
    };
  }

  sendMessage(message: string, metadata?: Record<string, any>) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ message, metadata }));
    }
  }

  updateContext(context: Partial<ContextData>) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'context',
        context
      }));
    }
  }

  onMessage(cb: (data: WSMessage) => void) { this.onMessageCallback = cb; }
  onOpen(cb: () => void) { this.onOpenCallback = cb; }
  onClose(cb: (event: CloseEvent) => void) { this.onCloseCallback = cb; }
  onError(cb: (event: Event) => void) { this.onErrorCallback = cb; }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    this.isConnecting = false;
    }
  }
}

export const wsService = new WebSocketService();

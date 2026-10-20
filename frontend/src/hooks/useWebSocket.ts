import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authSlice';

interface WebSocketMessage {
  type: string;
  data?: any;
}

type MessageHandler = (message: WebSocketMessage) => void;

const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const { isAuthenticated } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const handlersRef = useRef<MessageHandler[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempts = 0;
    let stopped = false;

    const connect = () => {
      // The server authenticates the handshake with the JWT and takes the organization from it
      const token = localStorage.getItem('token');
      if (!token) return;
      // Same origin as the REST API (/api), so the host, port and TLS follow the page
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(
        `${protocol}://${window.location.host}/api/ws?token=${encodeURIComponent(token)}`
      );

      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts = 0;
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);

          // Notify all handlers
          handlersRef.current.forEach((handler) => {
            try {
              handler(message);
            } catch (error) {
              console.error('Handler error:', error);
            }
          });
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        if (stopped) return;
        // Exponential backoff, so a rejected token or a down server isn't retried every second
        const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    };

    connect();

    // Close on logout and unmount, and stop reconnecting
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [isAuthenticated]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.log('WebSocket not connected, message not sent');
    }
  }, []);

  const addHandler = useCallback((handler: MessageHandler) => {
    handlersRef.current.push(handler);
    return () => {
      const index = handlersRef.current.indexOf(handler);
      if (index > -1) {
        handlersRef.current.splice(index, 1);
      }
    };
  }, []);
  return {
    isConnected,
    lastMessage,
    sendMessage,
    addHandler,
  };
}

// Hook for subscribing to specific message types
export function useWebSocketMessage(type: string, callback: (data: any) => void) {
  const { addHandler } = useWebSocket();
  useEffect(() => {
    const cleanup = addHandler((message) => {
      if (message.type === type) {
        callback(message.data);
      }
    });

    return cleanup;
  }, [type, addHandler]);
}

// Hook for real-time dashboard updates
export function useDashboardSync(dashboardId: string | undefined) {
  const { addHandler, sendMessage } = useWebSocket();
  const [updates, setUpdates] = useState<any[]>([]);

  useEffect(() => {
    if (!dashboardId) return;

    // Subscribe to dashboard updates
    sendMessage({
      type: 'subscribe',
      data: { dashboardId },
    });

    const cleanup = addHandler((message) => {
      if (
        message.type === 'dashboard_update' &&
        message.data?.dashboardId === dashboardId
      ) {
        updates.push(message.data);
        setUpdates(updates);
      }
    });

    return () => {
      cleanup();
      sendMessage({
        type: 'unsubscribe',
        data: { dashboardId },
      });
    };
  }, [dashboardId]);

  return updates;
}

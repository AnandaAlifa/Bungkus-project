/**
 * Bungkus! — useBungkusWebSocket Hook
 * =====================================
 * Real-time WebSocket integration for Group Buy updates.
 * Handles:
 * - Connection management with auto-reconnect
 * - Event parsing and type-safe dispatch
 * - Heartbeat keep-alive
 * - Connection state tracking
 *
 * Usage:
 *   const { state, events, subscribe } = useBungkusWebSocket(groupBuyId);
 *   useEffect(() => {
 *     subscribe('MEMBER_JOINED', (event) => { ... });
 *   }, []);
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSEvent, WSEventType } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface WebSocketState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  reconnectAttempts: number;
  lastEventAt: string | null;
  latency: number;  // ms
}

export type EventCallback = (event: WSEvent) => void;

interface UseBungkusWebSocketOptions {
  url?: string;
  groupBuyId: string;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

interface UseBungkusWebSocketReturn {
  state: WebSocketState;
  events: WSEvent[];
  subscribe: (eventType: WSEventType | '*', callback: EventCallback) => () => void;
  unsubscribe: (eventType: WSEventType | '*', callback: EventCallback) => void;
  connect: () => void;
  disconnect: () => void;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_OPTIONS: Partial<UseBungkusWebSocketOptions> = {
  url: 'wss://api.bungkus.id/ws',
  autoConnect: true,
  maxReconnectAttempts: 10,
  reconnectInterval: 2000,
  heartbeatInterval: 30000,
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useBungkusWebSocket(
  groupBuyId: string,
  options: Partial<UseBungkusWebSocketOptions> = {},
): UseBungkusWebSocketReturn {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // State
  const [state, setState] = useState<WebSocketState>({
    status: 'disconnected',
    reconnectAttempts: 0,
    lastEventAt: null,
    latency: 0,
  });
  const [events, setEvents] = useState<WSEvent[]>([]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<WSEventType | '*', Set<EventCallback>>>(new Map());
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const pingTimestampRef = useRef<number>(0);

  // ========================================================================
  // SUBSCRIBE / UNSUBSCRIBE
  // ========================================================================

  const subscribe = useCallback(
    (eventType: WSEventType | '*', callback: EventCallback): (() => void) => {
      if (!listenersRef.current.has(eventType)) {
        listenersRef.current.set(eventType, new Set());
      }
      listenersRef.current.get(eventType)!.add(callback);

      // Return unsubscribe function
      return () => {
        const listeners = listenersRef.current.get(eventType);
        if (listeners) {
          listeners.delete(callback);
          if (listeners.size === 0) {
            listenersRef.current.delete(eventType);
          }
        }
      };
    },
    [],
  );

  const unsubscribe = useCallback(
    (eventType: WSEventType | '*', callback: EventCallback) => {
      const listeners = listenersRef.current.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          listenersRef.current.delete(eventType);
        }
      }
    },
    [],
  );

  // ========================================================================
  // DISPATCH EVENT
  // ========================================================================

  const dispatchEvent = useCallback((event: WSEvent) => {
    // Add to events history
    setEvents((prev) => [...prev.slice(-99), event]);  // Keep last 100

    // Update state
    setState((prev) => ({
      ...prev,
      lastEventAt: event.timestamp,
    }));

    // Dispatch to specific listeners
    const specificListeners = listenersRef.current.get(event.eventType);
    if (specificListeners) {
      specificListeners.forEach((callback) => {
        try {
          callback(event);
        } catch (e) {
          console.error(`[WS] Error in listener for ${event.eventType}:`, e);
        }
      });
    }

    // Dispatch to wildcard listeners
    const wildcardListeners = listenersRef.current.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((callback) => {
        try {
          callback(event);
        } catch (e) {
          console.error('[WS] Error in wildcard listener:', e);
        }
      });
    }
  }, []);

  // ========================================================================
  // HEARTBEAT
  // ========================================================================

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();

    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        pingTimestampRef.current = Date.now();
        wsRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, config.heartbeatInterval);
  }, [config.heartbeatInterval]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // ========================================================================
  // RECONNECT
  // ========================================================================

  const scheduleReconnect = useCallback(() => {
    if (reconnectCountRef.current >= (config.maxReconnectAttempts || 10)) {
      setState((prev) => ({ ...prev, status: 'error' }));
      console.warn('[WS] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      (config.reconnectInterval || 2000) * Math.pow(1.5, reconnectCountRef.current),
      30000,
    );

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectCountRef.current + 1})`);

    reconnectRef.current = setTimeout(() => {
      reconnectCountRef.current++;
      connect();
    }, delay);
  }, [config.maxReconnectAttempts, config.reconnectInterval]);

  // ========================================================================
  // CONNECT
  // ========================================================================

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState((prev) => ({ ...prev, status: 'connecting' }));

    try {
      const wsUrl = `${config.url}?groupBuyId=${groupBuyId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[WS] Connected to group ${groupBuyId}`);
        reconnectCountRef.current = 0;
        setState((prev) => ({
          ...prev,
          status: 'connected',
          reconnectAttempts: 0,
        }));
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle PONG (heartbeat response)
          if (data.type === 'PONG') {
            const latency = Date.now() - pingTimestampRef.current;
            setState((prev) => ({ ...prev, latency }));
            return;
          }

          // Parse as WSEvent
          const wsEvent: WSEvent = {
            eventType: data.event_type || data.eventType,
            groupBuyId: data.group_buy_id || data.groupBuyId,
            timestamp: data.timestamp || new Date().toISOString(),
            data: data.data || {},
            actorId: data.actor_id || data.actorId,
          };

          dispatchEvent(wsEvent);
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        setState((prev) => ({ ...prev, status: 'error' }));
      };

      ws.onclose = (event) => {
        console.log(`[WS] Closed: ${event.code} ${event.reason}`);
        stopHeartbeat();
        setState((prev) => ({ ...prev, status: 'disconnected' }));

        // Auto-reconnect if not intentionally closed
        if (event.code !== 1000) {
          scheduleReconnect();
        }
      };
    } catch (e) {
      console.error('[WS] Connection failed:', e);
      setState((prev) => ({ ...prev, status: 'error' }));
      scheduleReconnect();
    }
  }, [groupBuyId, config.url, dispatchEvent, startHeartbeat, stopHeartbeat, scheduleReconnect]);

  // ========================================================================
  // DISCONNECT
  // ========================================================================

  const disconnect = useCallback(() => {
    reconnectCountRef.current = config.maxReconnectAttempts || 10;  // Prevent reconnect

    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Intentional disconnect');
      wsRef.current = null;
    }

    setState({
      status: 'disconnected',
      reconnectAttempts: 0,
      lastEventAt: null,
      latency: 0,
    });
  }, [config.maxReconnectAttempts, stopHeartbeat]);

  // ========================================================================
  // AUTO-CONNECT & CLEANUP
  // ========================================================================

  useEffect(() => {
    if (config.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [groupBuyId]);  // eslint-disable-line react-hooks/exhaustive-deps

  return {
    state,
    events,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Subscribe to specific event types with automatic cleanup.
 */
export function useWSEvent(
  ws: UseBungkusWebSocketReturn,
  eventType: WSEventType | '*',
  callback: EventCallback,
) {
  useEffect(() => {
    const unsub = ws.subscribe(eventType, callback);
    return unsub;
  }, [ws, eventType, callback]);
}

/**
 * Track member count from WebSocket events.
 */
export function useMemberCount(ws: UseBungkusWebSocketReturn, initial: number = 0) {
  const [count, setCount] = useState(initial);

  useWSEvent(ws, 'MEMBER_JOINED', (event) => {
    const newCount = event.data.current_quota as number;
    if (newCount !== undefined) {
      setCount(newCount);
    }
  });

  useWSEvent(ws, 'MEMBER_LEFT', (event) => {
    const newCount = event.data.current_quota as number;
    if (newCount !== undefined) {
      setCount(newCount);
    }
  });

  return count;
}

/**
 * Track price from WebSocket events.
 */
export function usePriceUpdates(ws: UseBungkusWebSocketReturn, initial: number = 0) {
  const [price, setPrice] = useState(initial);

  useWSEvent(ws, 'PRICE_UPDATED', (event) => {
    const newPrice = event.data.new_price as number;
    if (newPrice !== undefined) {
      setPrice(newPrice);
    }
  });

  return price;
}

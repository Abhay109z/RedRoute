import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext.js';

export interface SocketEvent {
  type: string;
  tripId?: string;
  seatId?: string;
  owner?: string;
  expiresAt?: number;
  telemetry?: any;
  seatNumbers?: string[];
  freedSeats?: string[];
  payload?: any;
  timestamp?: number;
}

interface SocketContextType {
  isConnected: boolean;
  subscribeTrip: (tripId: string) => void;
  unsubscribeTrip: (tripId: string) => void;
  lastEvent: SocketEvent | null;
  activeLocksMap: Record<string, { owner: string; expiresAt: number }>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userId } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<SocketEvent | null>(null);
  const [activeLocksMap, setActiveLocksMap] = useState<Record<string, { owner: string; expiresAt: number }>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const activeTripsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let unmounted = false;

    const connectWebSocket = () => {
      if (unmounted) return;

      try {
        const metaEnv = (import.meta as any).env;
        let wsUrl: string = metaEnv?.VITE_WS_URL || metaEnv?.VITE_BACKEND_WS_URL || 'wss://redroute-tqew.onrender.com/ws';
        if (wsUrl.startsWith('https://')) {
          wsUrl = wsUrl.replace(/^https:/, 'wss:');
        } else if (wsUrl.startsWith('http://')) {
          wsUrl = wsUrl.replace(/^http:/, 'ws:');
        }

        console.info(`[RedRoute] Connecting WebSocket to external backend: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
          reconnectAttemptsRef.current = 0;
          setIsConnected(true);
          if (userId) {
            ws.send(JSON.stringify({ type: 'SET_USER', userId }));
          }
          // Re-subscribe to any active trips
          activeTripsRef.current.forEach((tripId) => {
            ws.send(JSON.stringify({ type: 'SUBSCRIBE_TRIP', tripId }));
          });
        };

        ws.onmessage = (event) => {
          try {
            const data: SocketEvent = JSON.parse(event.data);
            setLastEvent(data);

            if (data.type === 'SEAT_LOCKED' && data.tripId && data.seatId && data.owner && data.expiresAt) {
              const key = `${data.tripId}:${data.seatId}`;
              setActiveLocksMap((prev) => ({
                ...prev,
                [key]: { owner: data.owner!, expiresAt: data.expiresAt! },
              }));
            } else if (data.type === 'SEAT_RELEASED' && data.tripId && data.seatId) {
              const key = `${data.tripId}:${data.seatId}`;
              setActiveLocksMap((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            } else if (data.type === 'SEATS_BOOKED' && data.tripId && data.seatNumbers) {
              setActiveLocksMap((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((k) => {
                  if (k.startsWith(`${data.tripId}:`)) {
                    delete next[k];
                  }
                });
                return next;
              });
            }
          } catch (e) {
            console.error('Socket message parse error:', e);
          }
        };

        const scheduleReconnect = () => {
          if (unmounted) return;
          setIsConnected(false);
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(2500 * Math.pow(1.4, reconnectAttemptsRef.current - 1), 20000);
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        };

        ws.onclose = (event) => {
          if (unmounted) return;
          // Normal clean close (1000) does not require aggressive error logging
          if (event.code !== 1000) {
            scheduleReconnect();
          }
        };

        ws.onerror = () => {
          if (unmounted) return;
          setIsConnected(false);
        };
      } catch (err) {
        if (unmounted) return;
        setIsConnected(false);
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(2500 * Math.pow(1.4, reconnectAttemptsRef.current - 1), 20000);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
      }
    };

    connectWebSocket();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        const socket = wsRef.current;
        wsRef.current = null;
        socket.onclose = null;
        socket.onerror = null;
        if (socket.readyState === WebSocket.OPEN) {
          try { socket.close(1000, 'Teardown'); } catch {}
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => {
            try { socket.close(1000, 'Teardown'); } catch {}
          };
        }
      }
    };
  }, [userId]);

  const subscribeTrip = (tripId: string) => {
    activeTripsRef.current.add(tripId);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SUBSCRIBE_TRIP', tripId }));
    }
  };

  const unsubscribeTrip = (tripId: string) => {
    activeTripsRef.current.delete(tripId);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'UNSUBSCRIBE_TRIP', tripId }));
    }
  };

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        subscribeTrip,
        unsubscribeTrip,
        lastEvent,
        activeLocksMap,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

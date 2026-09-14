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
  const activeTripsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let unmounted = false;

    const connectWebSocket = () => {
      if (unmounted) return;

      try {
        const metaEnv = (import.meta as any).env;
        const wsUrl: string = metaEnv?.VITE_BACKEND_WS_URL || 'wss://redroute-tqew.onrender.com/ws';

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
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

        ws.onclose = () => {
          if (unmounted) return;
          setIsConnected(false);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
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

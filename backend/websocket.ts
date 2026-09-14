import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { redis } from './redisEngine.js';

interface ClientConnection {
  ws: WebSocket;
  isAlive: boolean;
  subscribedTrips: Set<string>;
  userId?: string;
}

export class WebSocketHub {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientConnection> = new Set();
  private upstreamWs: WebSocket | null = null;
  private upstreamUrl: string = process.env.BACKEND_WS_URL || 'wss://redroute-tqew.onrender.com/ws';

  public init(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    // Connect to upstream Render backend WebSocket
    this.connectUpstream();

    this.wss.on('connection', (ws: WebSocket) => {
      const client: ClientConnection = {
        ws,
        isAlive: true,
        subscribedTrips: new Set(),
      };
      this.clients.add(client);

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('message', (data: string) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleClientMessage(client, msg);
        } catch (e) {
          console.error('WebSocket parse error:', e);
        }
      });

      ws.on('close', () => {
        this.clients.delete(client);
      });

      // Send initial welcome
      ws.send(
        JSON.stringify({
          type: 'CONNECTED',
          timestamp: Date.now(),
          connectedClientsCount: this.clients.size,
          upstream: this.upstreamUrl,
        })
      );
    });

    // Listen to Redis Pub/Sub events and forward to connected WebSocket clients
    redis.subscribe('lock:events', (event) => {
      this.broadcast({
        type: 'SEAT_LOCK_EVENT',
        payload: event,
        timestamp: Date.now(),
      });
    });

    // Heartbeat ping/pong interval
    setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(client);
          continue;
        }
        client.isAlive = false;
        client.ws.ping();
      }
    }, 25000);
  }

  private connectUpstream(): void {
    try {
      const ws = new WebSocket(this.upstreamUrl);
      this.upstreamWs = ws;

      ws.on('open', () => {
        console.log(`[RedRoute] Connected to upstream Render WebSocket at ${this.upstreamUrl}`);
      });

      ws.on('message', (data: string) => {
        try {
          const msg = JSON.parse(data.toString());
          // Forward upstream real-time event to local connected clients
          this.broadcast(msg, msg.tripId);
        } catch (e) {
          // ignore non-json messages
        }
      });

      ws.on('close', () => {
        this.upstreamWs = null;
        setTimeout(() => this.connectUpstream(), 5000);
      });

      ws.on('error', (err) => {
        console.warn(`[RedRoute] Upstream Render WebSocket warning: ${err.message}`);
      });
    } catch (e) {
      setTimeout(() => this.connectUpstream(), 5000);
    }
  }

  private handleClientMessage(client: ClientConnection, msg: any): void {
    if (msg.type === 'SUBSCRIBE_TRIP' && msg.tripId) {
      client.subscribedTrips.add(msg.tripId);
      client.ws.send(
        JSON.stringify({
          type: 'SUBSCRIBED',
          tripId: msg.tripId,
        })
      );
    } else if (msg.type === 'UNSUBSCRIBE_TRIP' && msg.tripId) {
      client.subscribedTrips.delete(msg.tripId);
    } else if (msg.type === 'SET_USER' && msg.userId) {
      client.userId = msg.userId;
    }

    // Forward client message to upstream Render WebSocket
    if (this.upstreamWs && this.upstreamWs.readyState === WebSocket.OPEN) {
      try {
        this.upstreamWs.send(JSON.stringify(msg));
      } catch {
        // ignore send error
      }
    }
  }

  public broadcast(data: any, filterTripId?: string): void {
    const serialized = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (!filterTripId || client.subscribedTrips.has(filterTripId)) {
          client.ws.send(serialized);
        }
      }
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const wsHub = new WebSocketHub();

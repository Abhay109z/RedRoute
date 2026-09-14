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

  public init(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

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

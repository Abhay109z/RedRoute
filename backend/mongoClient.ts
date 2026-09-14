import { MongoClient, Db, Collection } from 'mongodb';
import { BusTrip, Seat, Booking } from './types.js';

class MongoManager {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected: boolean = false;
  private connectionError: string | null = null;
  private connectionPromise: Promise<boolean> | null = null;

  constructor() {
    // Attempt lazy initialization on first access or server start
  }

  public getStatus(): {
    connected: boolean;
    configured: boolean;
    database: string | null;
    error: string | null;
    cluster: string;
  } {
    const rawUri = process.env.MONGODB_URI || '';
    const isConfigured = rawUri.length > 0 && !rawUri.includes('<db_username>');
    return {
      connected: this.isConnected,
      configured: isConfigured,
      database: this.db ? this.db.databaseName : (isConfigured ? 'redbus' : null),
      error: this.connectionError,
      cluster: 'cluster0.njybtza.mongodb.net',
    };
  }

  public async init(): Promise<boolean> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      const uri = process.env.MONGODB_URI;

      if (!uri) {
        this.connectionError = 'MONGODB_URI not provided in environment variables';
        console.log('[MongoDB] URI not set. Running with high-speed local datastore.');
        return false;
      }

      if (uri.includes('<db_username>')) {
        this.connectionError = 'MONGODB_URI contains unreplaced <db_username> placeholder';
        console.log('[MongoDB] Notice: <db_username> placeholder detected. Please supply username in environment variables to link Atlas cluster.');
        return false;
      }

      try {
        console.log('[MongoDB] Connecting to MongoDB Atlas cluster...');
        this.client = new MongoClient(uri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });

        await this.client.connect();
        this.db = this.client.db('redbus');
        this.isConnected = true;
        this.connectionError = null;
        console.log('[MongoDB] Successfully connected to MongoDB Atlas (redbus database)!');

        // Create indexes for high performance
        await this.db.collection('trips').createIndex({ sourceCity: 1, destinationCity: 1 });
        await this.db.collection('bookings').createIndex({ pnr: 1 }, { unique: true });
        await this.db.collection('bookings').createIndex({ userId: 1 });

        return true;
      } catch (err: any) {
        this.isConnected = false;
        this.connectionError = err?.message || 'Failed to connect to MongoDB cluster';
        console.warn('[MongoDB] Connection failed, falling back to in-memory store:', this.connectionError);
        return false;
      }
    })();

    return this.connectionPromise;
  }

  public getDb(): Db | null {
    return this.db;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  // --- Collection helpers ---
  public tripsCollection(): Collection<BusTrip> | null {
    return this.db ? this.db.collection<BusTrip>('trips') : null;
  }

  public seatsCollection(): Collection<{ tripId: string; seats: Seat[] }> | null {
    return this.db ? this.db.collection<{ tripId: string; seats: Seat[] }>('seats') : null;
  }

  public bookingsCollection(): Collection<Booking> | null {
    return this.db ? this.db.collection<Booking>('bookings') : null;
  }

  public auditCollection(): Collection<any> | null {
    return this.db ? this.db.collection<any>('audit_logs') : null;
  }

  // Seed MongoDB if empty
  public async seedIfEmpty(initialTrips: BusTrip[], initialSeatMap: Map<string, Seat[]>): Promise<void> {
    if (!this.db || !this.isConnected) return;

    try {
      const tripCount = await this.db.collection('trips').countDocuments();
      if (tripCount === 0) {
        console.log('[MongoDB] Seeding initial trips collection...');
        await this.db.collection('trips').insertMany(initialTrips);

        console.log('[MongoDB] Seeding initial seats collection...');
        const seatDocs: { tripId: string; seats: Seat[] }[] = [];
        for (const [tripId, seats] of initialSeatMap.entries()) {
          seatDocs.push({ tripId, seats });
        }
        if (seatDocs.length > 0) {
          await this.db.collection('seats').insertMany(seatDocs);
        }
        console.log('[MongoDB] Seed completed successfully!');
      }
    } catch (err) {
      console.error('[MongoDB] Error seeding initial data:', err);
    }
  }

  // Persist a new booking to MongoDB
  public async saveBooking(booking: Booking): Promise<void> {
    if (!this.db || !this.isConnected) return;
    try {
      await this.db.collection('bookings').insertOne(booking);
      console.log(`[MongoDB] Saved booking ${booking.pnr} to bookings collection`);
    } catch (err) {
      console.error('[MongoDB] Failed to persist booking to MongoDB:', err);
    }
  }

  // Update booking status
  public async updateBookingStatus(bookingId: string, updates: Partial<Booking>): Promise<void> {
    if (!this.db || !this.isConnected) return;
    try {
      await this.db.collection('bookings').updateOne({ id: bookingId }, { $set: updates });
    } catch (err) {
      console.error('[MongoDB] Failed to update booking status in MongoDB:', err);
    }
  }

  // Update trip in MongoDB
  public async updateTrip(tripId: string, updates: Partial<BusTrip>): Promise<void> {
    if (!this.db || !this.isConnected) return;
    try {
      await this.db.collection('trips').updateOne({ id: tripId }, { $set: updates });
    } catch (err) {
      console.error('[MongoDB] Failed to update trip in MongoDB:', err);
    }
  }

  // Update seats in MongoDB
  public async updateSeats(tripId: string, seats: Seat[]): Promise<void> {
    if (!this.db || !this.isConnected) return;
    try {
      await this.db.collection('seats').updateOne(
        { tripId },
        { $set: { tripId, seats } },
        { upsert: true }
      );
    } catch (err) {
      console.error('[MongoDB] Failed to update seats in MongoDB:', err);
    }
  }
}

export const mongo = new MongoManager();

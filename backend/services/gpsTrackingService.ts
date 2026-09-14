import { redis } from '../redisEngine.js';
import { db } from '../database.js';

export interface GpsTelemetry {
  tripId: string;
  busNumber: string;
  operatorName: string;
  lat: number;
  lng: number;
  speed: number;
  bearing: number;
  currentLocationName: string;
  nextStopName: string;
  etaMinutes: number;
  distanceCoveredKm: number;
  totalDistanceKm: number;
  timestamp: number;
  status: 'on_schedule' | 'minor_traffic' | 'at_rest_stop';
}

export class GpsTrackingService {
  private activeInterval: any = null;

  constructor() {
    this.startLiveTelemetrySimulation();
  }

  public getTelemetry(tripId: string): GpsTelemetry | null {
    const trip = db.getTripById(tripId);
    if (!trip) return null;

    // Check Redis Geo for position
    const pos = redis.geoPos('bus_fleet', trip.busNumber);
    const lat = pos ? pos.lat : trip.currentGps?.lat || 13.0;
    const lng = pos ? pos.lng : trip.currentGps?.lng || 77.5;

    return {
      tripId: trip.id,
      busNumber: trip.busNumber,
      operatorName: trip.operatorName,
      lat,
      lng,
      speed: trip.currentGps?.speed || 74,
      bearing: trip.currentGps?.bearing || 45,
      currentLocationName: this.getLocationDescription(tripId, lat, lng),
      nextStopName: trip.currentGps?.nextStop || trip.droppingPoints[0]?.name || 'Next Transit Hub',
      etaMinutes: trip.currentGps?.etaMinutes || 45,
      distanceCoveredKm: 280,
      totalDistanceKm: 560,
      timestamp: Date.now(),
      status: 'on_schedule',
    };
  }

  /**
   * Driver mobile app simulation: Ingests GPS coordinate stream
   */
  public ingestDriverGps(tripId: string, lat: number, lng: number, speed: number, bearing: number): GpsTelemetry | null {
    const trip = db.getTripById(tripId);
    if (!trip) return null;

    // Index in Redis Geo
    redis.geoAdd('bus_fleet', trip.busNumber, lat, lng);

    // Update database record
    db.updateTrip(tripId, {
      currentGps: {
        lat,
        lng,
        speed,
        bearing,
        lastUpdated: Date.now(),
        nextStop: trip.currentGps?.nextStop || trip.droppingPoints[0]?.name || 'Next Depot',
        etaMinutes: Math.max(5, (trip.currentGps?.etaMinutes || 60) - 1),
      },
    });

    const telemetry = this.getTelemetry(tripId);

    // Broadcast on Redis Pub/Sub
    if (telemetry) {
      redis.publish(`telemetry:${tripId}`, telemetry);
    }

    return telemetry;
  }

  /**
   * Continuous background simulation that moves on-route buses incrementally
   */
  private startLiveTelemetrySimulation(): void {
    if (this.activeInterval) return;

    this.activeInterval = setInterval(() => {
      const trips = db.getAllTrips().filter((t) => t.status === 'on_route' && t.currentGps);

      for (const trip of trips) {
        if (!trip.currentGps) continue;

        // Subtle realistic drift along bearing
        const deltaLat = (Math.random() - 0.45) * 0.003;
        const deltaLng = (Math.random() - 0.45) * 0.003;
        const speed = Math.floor(65 + Math.random() * 20);
        const newLat = parseFloat((trip.currentGps.lat + deltaLat).toFixed(6));
        const newLng = parseFloat((trip.currentGps.lng + deltaLng).toFixed(6));

        this.ingestDriverGps(trip.id, newLat, newLng, speed, trip.currentGps.bearing);
      }
    }, 4000);
  }

  private getLocationDescription(tripId: string, lat: number, lng: number): string {
    if (tripId.includes('blr_hyd')) return 'National Highway 44 (Near Anantapur Toll Plaza)';
    if (tripId.includes('mum_goa')) return 'Mumbai-Goa Highway NH66 (Khed Ghat Section)';
    if (tripId.includes('del_manali')) return 'Chandigarh-Manali Himalayan Express Highway';
    if (tripId.includes('che_blr')) return 'Chennai-Bangalore Expressway (Ranipet stretch)';
    if (tripId.includes('pun_mum')) return 'Mumbai-Pune Yashwantrao Chavan Expressway';
    return `Coord: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export const gpsTrackingService = new GpsTrackingService();

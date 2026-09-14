import { BusTrip } from '../types.js';
import { db } from '../database.js';

export interface DynamicPriceBreakdown {
  baseFare: number;
  occupancyMultiplier: number;
  urgencyMultiplier: number;
  weekendMultiplier: number;
  finalFare: number;
  surgeReason: string[];
  occupancyPercentage: number;
}

export class PricingEngine {
  /**
   * Calculates dynamic price for a trip based on real-time inventory and departure time
   */
  public calculateFare(trip: BusTrip): DynamicPriceBreakdown {
    const totalSeats = trip.totalSeats || 36;
    const bookedSeats = totalSeats - trip.availableSeats;
    const occupancyPercentage = Math.round((bookedSeats / totalSeats) * 100);

    const surgeReasons: string[] = [];

    // 1. Occupancy Multiplier
    let occupancyMultiplier = 1.0;
    if (occupancyPercentage >= 90) {
      occupancyMultiplier = 1.35;
      surgeReasons.push('High Demand: Bus is 90%+ booked');
    } else if (occupancyPercentage >= 75) {
      occupancyMultiplier = 1.2;
      surgeReasons.push('Moderate Surge: 75%+ occupancy');
    } else if (occupancyPercentage < 20) {
      occupancyMultiplier = 0.9;
      surgeReasons.push('Early Bird 10% Discount applied');
    }

    // 2. Urgency Surge (Hours until departure)
    let urgencyMultiplier = 1.0;
    const now = new Date();
    const currentHour = now.getHours();
    const [depHour] = trip.departureTime.split(':').map(Number);
    const diffHours = (depHour - currentHour + 24) % 24;

    if (diffHours <= 2 && diffHours > 0) {
      urgencyMultiplier = 1.25;
      surgeReasons.push('Last-Minute Rush: Departing in <2 hours');
    } else if (diffHours <= 6 && diffHours > 0) {
      urgencyMultiplier = 1.15;
      surgeReasons.push('Departing Soon: <6 hours to board');
    }

    // 3. Weekend Surge
    const dayOfWeek = now.getDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday
    let weekendMultiplier = 1.0;
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      weekendMultiplier = 1.1;
      surgeReasons.push('Weekend Getaway Demand');
    }

    if (surgeReasons.length === 0) {
      surgeReasons.push('Standard Base Tariff');
    }

    const calculatedFare = Math.round(trip.baseFare * occupancyMultiplier * urgencyMultiplier * weekendMultiplier);

    return {
      baseFare: trip.baseFare,
      occupancyMultiplier,
      urgencyMultiplier,
      weekendMultiplier,
      finalFare: calculatedFare,
      surgeReason: surgeReasons,
      occupancyPercentage,
    };
  }

  /**
   * Recalculate and update current prices for all trips
   */
  public updateAllTripPrices(): void {
    const trips = db.getAllTrips();
    for (const trip of trips) {
      const breakdown = this.calculateFare(trip);
      db.updateTrip(trip.id, { currentFare: breakdown.finalFare });
    }
  }
}

export const pricingEngine = new PricingEngine();

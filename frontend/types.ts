import { BusTrip, Seat, RouteStop, Booking, SeatGender, TraceSpan, BackgroundJob } from '../backend/types.js';

export type UserRole = 'passenger' | 'operator' | 'auditor' | 'admin';

export interface UserContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  userId: string;
  userName: string;
}

export interface DynamicPricingDetails {
  baseFare: number;
  occupancyMultiplier: number;
  urgencyMultiplier: number;
  weekendMultiplier: number;
  finalFare: number;
  surgeReason: string[];
  occupancyPercentage: number;
}

export interface EnrichedBusTrip extends BusTrip {
  pricingBreakdown?: DynamicPricingDetails;
  occupancyRate?: number;
  bookedSeatsCount?: number;
  tripRevenue?: number;
}

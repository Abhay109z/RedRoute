export type SeatType = 'seater' | 'sleeper';
export type DeckType = 'lower' | 'upper';
export type SeatGender = 'all' | 'female' | 'male';

export interface Seat {
  id: string; // e.g., "L1", "U12"
  number: string;
  deck: DeckType;
  type: SeatType;
  row: number;
  col: number; // 0, 1 for left side; 3, 4 for right side; 2 is aisle
  basePrice: number;
  currentPrice: number;
  isBooked: boolean;
  bookedBy?: string;
  passengerGender?: SeatGender;
  lockedUntil?: number; // timestamp in ms
  lockedBy?: string; // sessionId or userId
}

export interface RouteStop {
  id: string;
  name: string;
  city: string;
  time: string; // "20:30"
  landmark: string;
  lat: number;
  lng: number;
}

export interface BusTrip {
  id: string;
  operatorId: string;
  operatorName: string;
  busNumber: string;
  busType: 'AC Sleeper 2+1' | 'Volvo Multi-Axle AC' | 'BharatBenz Executive 2+2' | 'Electric AC Sleeper';
  rating: number;
  reviewCount: number;
  sourceCity: string;
  destinationCity: string;
  departureTime: string; // "21:00"
  arrivalTime: string; // "06:30"
  duration: string; // "9h 30m"
  date: string; // YYYY-MM-DD
  baseFare: number;
  currentFare: number;
  totalSeats: number;
  availableSeats: number;
  amenities: string[];
  boardingPoints: RouteStop[];
  droppingPoints: RouteStop[];
  driverName: string;
  driverPhone: string;
  status: 'scheduled' | 'on_route' | 'completed' | 'delayed';
  currentGps?: {
    lat: number;
    lng: number;
    speed: number;
    bearing: number;
    lastUpdated: number;
    nextStop: string;
    etaMinutes: number;
  };
}

export interface Booking {
  id: string;
  pnr: string;
  tripId: string;
  userId: string;
  passengerName: string;
  passengerEmail: string;
  passengerPhone: string;
  passengerGender: SeatGender;
  seatNumbers: string[];
  totalAmount: number;
  boardingPoint: RouteStop;
  droppingPoint: RouteStop;
  status: 'confirmed' | 'cancelled' | 'refunded';
  bookingTime: number;
  idempotencyKey: string;
  paymentGateway: 'Razorpay' | 'Stripe';
  paymentId: string;
  cancellationRefund?: {
    refundAmount: number;
    deductionFee: number;
    refundTier: string;
    processedAt: number;
  };
}

export interface DistributedLock {
  resource: string; // e.g. "lock:trip_101:seat_L12"
  owner: string; // sessionId
  ttlMs: number;
  expiresAt: number;
}

export interface TraceSpan {
  id: string;
  traceId: string;
  name: string;
  service: 'API_Gateway' | 'Redis_Lock_Manager' | 'Postgres_ACID_Engine' | 'Worker_Pool' | 'Payment_Gateway';
  startTimeMs: number;
  durationMs: number;
  status: 'ok' | 'error';
  metadata?: Record<string, any>;
}

export interface BackgroundJob {
  id: string;
  queue: 'pdf_tickets' | 'whatsapp_notifications' | 'email_confirmations' | 'refund_processor';
  payload: any;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempts: number;
  createdAt: number;
  completedAt?: number;
}

export interface UserSession {
  id: string;
  role: 'passenger' | 'operator' | 'auditor' | 'admin';
  name: string;
  email: string;
}

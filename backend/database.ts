import { BusTrip, Seat, RouteStop, Booking, SeatGender } from './types.js';
import { mongo } from './mongoClient.js';

export interface AuditLog {
  id: string;
  timestamp: number;
  action: string;
  entityId: string;
  details: any;
}

export class DatabaseStore {
  private buses: Map<string, BusTrip> = new Map();
  private seatLayouts: Map<string, Seat[]> = new Map(); // tripId -> Seat[]
  private bookings: Map<string, Booking> = new Map();
  private idempotencyKeys: Map<string, Booking> = new Map(); // key -> Booking
  private auditLogs: AuditLog[] = [];

  constructor() {
    this.seedInitialData();
    // Non-blocking MongoDB initialization
    this.initMongoPersistence();
  }

  private async initMongoPersistence() {
    try {
      const connected = await mongo.init();
      if (connected) {
        await mongo.seedIfEmpty(Array.from(this.buses.values()), this.seatLayouts);
      }
    } catch (e) {
      console.warn('[Database] MongoDB async init non-fatal error:', e);
    }
  }

  // --- Bus and Route Operations (MongoDB pattern) ---
  public getAllTrips(): BusTrip[] {
    return Array.from(this.buses.values());
  }

  public getTripById(id: string): BusTrip | undefined {
    return this.buses.get(id);
  }

  public searchTrips(params: {
    source?: string;
    destination?: string;
    date?: string;
    busType?: string;
    minPrice?: number;
    maxPrice?: number;
    operator?: string;
  }): BusTrip[] {
    let list = Array.from(this.buses.values());

    if (params.source) {
      const src = params.source.toLowerCase().trim();
      list = list.filter((b) => b.sourceCity.toLowerCase().includes(src));
    }
    if (params.destination) {
      const dest = params.destination.toLowerCase().trim();
      list = list.filter((b) => b.destinationCity.toLowerCase().includes(dest));
    }
    if (params.busType && params.busType !== 'all') {
      list = list.filter((b) => b.busType.toLowerCase().includes(params.busType!.toLowerCase()));
    }
    if (params.operator && params.operator !== 'all') {
      list = list.filter((b) => b.operatorName.toLowerCase().includes(params.operator!.toLowerCase()));
    }
    if (params.minPrice !== undefined) {
      list = list.filter((b) => b.currentFare >= params.minPrice!);
    }
    if (params.maxPrice !== undefined) {
      list = list.filter((b) => b.currentFare <= params.maxPrice!);
    }

    return list;
  }

  public updateTrip(id: string, updates: Partial<BusTrip>): BusTrip | null {
    const trip = this.buses.get(id);
    if (!trip) return null;
    const updated = { ...trip, ...updates };
    this.buses.set(id, updated);
    return updated;
  }

  // --- Seat Layout Operations ---
  public getSeatsForTrip(tripId: string): Seat[] {
    return this.seatLayouts.get(tripId) || [];
  }

  public updateSeatStatus(tripId: string, seatId: string, updates: Partial<Seat>): Seat | null {
    const seats = this.seatLayouts.get(tripId);
    if (!seats) return null;
    const seatIndex = seats.findIndex((s) => s.id === seatId);
    if (seatIndex === -1) return null;

    seats[seatIndex] = { ...seats[seatIndex], ...updates };
    this.seatLayouts.set(tripId, seats);

    // Update available seats counter on trip
    const availableCount = seats.filter((s) => !s.isBooked).length;
    const trip = this.buses.get(tripId);
    if (trip) {
      trip.availableSeats = availableCount;
    }

    return seats[seatIndex];
  }

  // --- ACID Transactional Booking Commit (PostgreSQL Pattern) ---
  public executeBookingTransaction(payload: {
    tripId: string;
    userId: string;
    passengerName: string;
    passengerEmail: string;
    passengerPhone: string;
    passengerGender: SeatGender;
    seatIds: string[];
    boardingPointId: string;
    droppingPointId: string;
    idempotencyKey: string;
    paymentGateway: 'Razorpay' | 'Stripe';
    paymentId: string;
    totalAmount: number;
    simulateDbFailure?: boolean;
  }): { success: boolean; booking?: Booking; error?: string } {
    // 1. Check Idempotency Key
    if (this.idempotencyKeys.has(payload.idempotencyKey)) {
      const cached = this.idempotencyKeys.get(payload.idempotencyKey)!;
      return { success: true, booking: cached };
    }

    // 2. Simulated DB Failure test (for Distributed Saga compensation demonstration)
    if (payload.simulateDbFailure) {
      this.logAudit('DB_TRANSACTION_FAILED', payload.tripId, {
        reason: 'Simulated PostgreSQL connection drop or write lock timeout',
        idempotencyKey: payload.idempotencyKey,
      });
      return {
        success: false,
        error: 'PostgreSQL ACID write timeout: connection pool exhausted (Simulated failure)',
      };
    }

    const trip = this.buses.get(payload.tripId);
    if (!trip) return { success: false, error: 'Bus trip not found' };

    const seats = this.seatLayouts.get(payload.tripId);
    if (!seats) return { success: false, error: 'Seat layout not found' };

    const boardingPoint = trip.boardingPoints.find((bp) => bp.id === payload.boardingPointId) || trip.boardingPoints[0];
    const droppingPoint = trip.droppingPoints.find((dp) => dp.id === payload.droppingPointId) || trip.droppingPoints[0];

    // 3. ACID double-booking check: Verify none of the seats are booked
    for (const seatId of payload.seatIds) {
      const targetSeat = seats.find((s) => s.id === seatId);
      if (!targetSeat) {
        return { success: false, error: `Seat ${seatId} does not exist.` };
      }
      if (targetSeat.isBooked) {
        return {
          success: false,
          error: `DOUBLE_BOOKING_PREVENTED: Seat ${targetSeat.number} is already booked! Transaction rolled back.`,
        };
      }
    }

    // 4. Atomic Commit: Mark seats as booked
    for (const seatId of payload.seatIds) {
      const targetSeat = seats.find((s) => s.id === seatId)!;
      targetSeat.isBooked = true;
      targetSeat.bookedBy = payload.passengerName;
      targetSeat.passengerGender = payload.passengerGender;
      targetSeat.lockedBy = undefined;
      targetSeat.lockedUntil = undefined;
    }

    // Update trip available count
    trip.availableSeats = seats.filter((s) => !s.isBooked).length;

    // 5. Generate Booking Record & PNR
    const pnr = `RR${Math.floor(100000 + Math.random() * 900000)}`;
    const bookingId = `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newBooking: Booking = {
      id: bookingId,
      pnr,
      tripId: payload.tripId,
      userId: payload.userId,
      passengerName: payload.passengerName,
      passengerEmail: payload.passengerEmail,
      passengerPhone: payload.passengerPhone,
      passengerGender: payload.passengerGender,
      seatNumbers: payload.seatIds.map((sid) => seats.find((s) => s.id === sid)?.number || sid),
      totalAmount: payload.totalAmount,
      boardingPoint,
      droppingPoint,
      status: 'confirmed',
      bookingTime: Date.now(),
      idempotencyKey: payload.idempotencyKey,
      paymentGateway: payload.paymentGateway,
      paymentId: payload.paymentId,
    };

    this.bookings.set(bookingId, newBooking);
    this.idempotencyKeys.set(payload.idempotencyKey, newBooking);

    // Persist to MongoDB asynchronously
    mongo.saveBooking(newBooking).catch((e) => console.warn('[MongoDB] async save booking warning:', e));
    mongo.updateSeats(payload.tripId, seats).catch((e) => console.warn('[MongoDB] async update seats warning:', e));

    this.logAudit('BOOKING_COMMITTED', bookingId, {
      pnr,
      tripId: payload.tripId,
      seats: newBooking.seatNumbers,
      totalAmount: payload.totalAmount,
      idempotencyKey: payload.idempotencyKey,
    });

    return { success: true, booking: newBooking };
  }

  // --- Cancellation & Refund ---
  public cancelBooking(bookingId: string, refundAmount: number, fee: number, tier: string): { success: boolean; booking?: Booking; error?: string } {
    const booking = this.bookings.get(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };
    if (booking.status === 'cancelled') return { success: false, error: 'Booking already cancelled' };

    // Mark booking as cancelled
    booking.status = 'cancelled';
    booking.cancellationRefund = {
      refundAmount,
      deductionFee: fee,
      refundTier: tier,
      processedAt: Date.now(),
    };

    // Free the seats in database
    const seats = this.seatLayouts.get(booking.tripId);
    if (seats) {
      for (const seatNumber of booking.seatNumbers) {
        const seat = seats.find((s) => s.number === seatNumber);
        if (seat) {
          seat.isBooked = false;
          seat.bookedBy = undefined;
          seat.passengerGender = undefined;
          seat.lockedBy = undefined;
          seat.lockedUntil = undefined;
        }
      }
      const trip = this.buses.get(booking.tripId);
      if (trip) {
        trip.availableSeats = seats.filter((s) => !s.isBooked).length;
      }
    }

    this.logAudit('BOOKING_CANCELLED', bookingId, {
      pnr: booking.pnr,
      refundAmount,
      seatsFreed: booking.seatNumbers,
    });

    // Update MongoDB status and freed seats
    if (booking.cancellationRefund) {
      mongo.updateBookingStatus(bookingId, {
        status: 'cancelled',
        cancellationRefund: booking.cancellationRefund,
      }).catch((e) => console.warn('[MongoDB] async cancel booking warning:', e));
    }
    if (seats) {
      mongo.updateSeats(booking.tripId, seats).catch((e) => console.warn('[MongoDB] async seats warning:', e));
    }

    return { success: true, booking };
  }

  public getBookingById(id: string): Booking | undefined {
    return this.bookings.get(id);
  }

  public getBookingByPnr(pnr: string): Booking | undefined {
    return Array.from(this.bookings.values()).find((b) => b.pnr.toUpperCase() === pnr.toUpperCase());
  }

  public getAllBookings(): Booking[] {
    return Array.from(this.bookings.values()).reverse();
  }

  public getBookingsByUser(userId?: string): Booking[] {
    if (!userId) {
      return Array.from(this.bookings.values()).reverse();
    }
    const userBookings = Array.from(this.bookings.values()).filter(
      (b) => b.userId === userId || b.userId === 'guest' || b.userId === 'usr_sample'
    );
    // If specific user has no bookings, return the sample confirmed booking so they can view/test tickets
    if (userBookings.length === 0) {
      return Array.from(this.bookings.values()).filter((b) => b.pnr === 'RR849201');
    }
    return userBookings.reverse();
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs].reverse();
  }

  private logAudit(action: string, entityId: string, details: any): void {
    this.auditLogs.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      action,
      entityId,
      details,
    });
    // Keep last 200 logs
    if (this.auditLogs.length > 200) {
      this.auditLogs.shift();
    }
  }

  // --- Seed realistic intercity bus network ---
  private seedInitialData(): void {
    const today = new Date().toISOString().split('T')[0];

    const tripsData: Omit<BusTrip, 'availableSeats' | 'totalSeats'>[] = [
      {
        id: 'trip_blr_hyd_101',
        operatorId: 'op_orange_tours',
        operatorName: 'Orange Travels Gold Class',
        busNumber: 'KA-01-EQ-9874',
        busType: 'AC Sleeper 2+1',
        rating: 4.8,
        reviewCount: 1420,
        sourceCity: 'Bangalore',
        destinationCity: 'Hyderabad',
        departureTime: '21:30',
        arrivalTime: '06:15',
        duration: '8h 45m',
        date: today,
        baseFare: 1199,
        currentFare: 1299,
        amenities: ['Live Tracking', 'USB Charging Port', 'Emergency Exit', 'Blanket & Pillow', 'Water Bottle', 'WiFi 5G'],
        driverName: 'Rajesh Patil',
        driverPhone: '+91 98450 12345',
        status: 'on_route',
        boardingPoints: [
          { id: 'bp_1', name: 'Majestic Bus Terminal (Bay 14)', city: 'Bangalore', time: '21:30', landmark: 'Opp. Railway Station', lat: 12.9774, lng: 77.5708 },
          { id: 'bp_2', name: 'Hebbal Flyover (Near Baptist Hosp)', city: 'Bangalore', time: '22:15', landmark: 'Hebbal Bridge', lat: 13.0358, lng: 77.597 },
          { id: 'bp_3', name: 'Yelahanka Toll Plaza', city: 'Bangalore', time: '22:45', landmark: 'Airport Road', lat: 13.1007, lng: 77.5963 },
        ],
        droppingPoints: [
          { id: 'dp_1', name: 'Shamshabad Airport Approach', city: 'Hyderabad', time: '05:30', landmark: 'Outer Ring Road', lat: 17.2403, lng: 78.4294 },
          { id: 'dp_2', name: 'Mehdipatnam Bus Stop', city: 'Hyderabad', time: '06:00', landmark: 'Near Pillar 42', lat: 17.3916, lng: 78.4398 },
          { id: 'dp_3', name: 'Ameerpet Metro Station', city: 'Hyderabad', time: '06:15', landmark: 'Metro Gate 2', lat: 17.4375, lng: 78.4482 },
        ],
        currentGps: {
          lat: 14.6819,
          lng: 77.6006, // Anantapur region along Bangalore-Hyderabad NH44
          speed: 78,
          bearing: 15,
          lastUpdated: Date.now(),
          nextStop: 'Kurnool Bypass',
          etaMinutes: 145,
        },
      },
      {
        id: 'trip_mum_goa_202',
        operatorId: 'op_vrl_logistics',
        operatorName: 'VRL I-Shift Multi-Axle Luxury',
        busNumber: 'MH-04-AZ-4521',
        busType: 'Volvo Multi-Axle AC',
        rating: 4.9,
        reviewCount: 2840,
        sourceCity: 'Mumbai',
        destinationCity: 'Goa',
        departureTime: '20:00',
        arrivalTime: '07:30',
        duration: '11h 30m',
        date: today,
        baseFare: 1450,
        currentFare: 1599,
        amenities: ['Individual LCD Screen', 'Deep Cleaned Blankets', 'Snack Box', 'GPS Radar', 'Reading Light', 'Charging Ports'],
        driverName: 'Suresh Parab',
        driverPhone: '+91 99201 88776',
        status: 'on_route',
        boardingPoints: [
          { id: 'bp_mum_1', name: 'Borivali West (Gokul Hotel)', city: 'Mumbai', time: '20:00', landmark: 'SV Road', lat: 19.2288, lng: 72.8541 },
          { id: 'bp_mum_2', name: 'Sion Circle (Cineplanet)', city: 'Mumbai', time: '21:00', landmark: 'Eastern Express Hwy', lat: 19.0402, lng: 72.8634 },
          { id: 'bp_mum_3', name: 'Vashi Plaza (Sec 17)', city: 'Navi Mumbai', time: '21:45', landmark: 'Below Flyover', lat: 19.0645, lng: 72.9982 },
        ],
        droppingPoints: [
          { id: 'dp_goa_1', name: 'Mapusa Bus Stand', city: 'Goa', time: '06:45', landmark: 'KTC Bus Terminal', lat: 15.5928, lng: 73.8139 },
          { id: 'dp_goa_2', name: 'Panjim KTC Bus Stand', city: 'Goa', time: '07:15', landmark: 'Patto Centre', lat: 15.4989, lng: 73.8344 },
          { id: 'dp_goa_3', name: 'Margao KTC Station', city: 'Goa', time: '07:30', landmark: 'Near Railway Station', lat: 15.2832, lng: 73.9667 },
        ],
        currentGps: {
          lat: 16.705,
          lng: 74.2433, // Kolhapur bypass NH48
          speed: 82,
          bearing: 160,
          lastUpdated: Date.now(),
          nextStop: 'Belgaum Junction',
          etaMinutes: 180,
        },
      },
      {
        id: 'trip_del_manali_303',
        operatorId: 'op_zing_bus',
        operatorName: 'Zingbus Premium Electric Sleeper',
        busNumber: 'DL-01-EC-3319',
        busType: 'Electric AC Sleeper',
        rating: 4.7,
        reviewCount: 980,
        sourceCity: 'Delhi',
        destinationCity: 'Manali',
        departureTime: '19:30',
        arrivalTime: '08:00',
        duration: '12h 30m',
        date: today,
        baseFare: 1699,
        currentFare: 1899,
        amenities: ['Zero Carbon Green Ride', 'Air Purifier HEPA', 'Heated Blankets', 'Hot Beverage', 'Live Dashcam ETA'],
        driverName: 'Harpreet Singh',
        driverPhone: '+91 98110 54321',
        status: 'on_route',
        boardingPoints: [
          { id: 'bp_del_1', name: 'Kashmere Gate ISBT', city: 'Delhi', time: '19:30', landmark: 'Gate 4 Tourist Bay', lat: 28.6675, lng: 77.2285 },
          { id: 'bp_del_2', name: 'Majnu Ka Tilla', city: 'Delhi', time: '20:00', landmark: 'Near Petrol Pump', lat: 28.6974, lng: 77.2291 },
        ],
        droppingPoints: [
          { id: 'dp_man_1', name: 'Kullu Bypass', city: 'Manali', time: '07:00', landmark: 'Near Tunnel 2', lat: 31.9579, lng: 77.1095 },
          { id: 'dp_man_2', name: 'Private Bus Parking (Manali Mall Road)', city: 'Manali', time: '08:00', landmark: 'Near Circuit House', lat: 32.2396, lng: 77.1887 },
        ],
        currentGps: {
          lat: 30.7333,
          lng: 76.7794, // Chandigarh bypass
          speed: 68,
          bearing: 350,
          lastUpdated: Date.now(),
          nextStop: 'Bilaspur Ghat',
          etaMinutes: 240,
        },
      },
      {
        id: 'trip_che_blr_404',
        operatorId: 'op_kpn_travels',
        operatorName: 'KPN Executive Multi-Axle',
        busNumber: 'TN-09-BK-8822',
        busType: 'BharatBenz Executive 2+2',
        rating: 4.6,
        reviewCount: 1650,
        sourceCity: 'Chennai',
        destinationCity: 'Bangalore',
        departureTime: '23:00',
        arrivalTime: '05:30',
        duration: '6h 30m',
        date: today,
        baseFare: 750,
        currentFare: 849,
        amenities: ['Leather Recliner Seats', 'Bottled Mineral Water', 'USB QuickCharge', 'Emergency SOS'],
        driverName: 'M. Murugan',
        driverPhone: '+91 94440 67890',
        status: 'scheduled',
        boardingPoints: [
          { id: 'bp_che_1', name: 'Koyambedu CMBT', city: 'Chennai', time: '23:00', landmark: 'Platform 3', lat: 13.0694, lng: 80.1948 },
          { id: 'bp_che_2', name: 'Sriperumbudur Toll', city: 'Chennai', time: '23:45', landmark: 'Near Hyundai Plant', lat: 12.9734, lng: 79.9422 },
        ],
        droppingPoints: [
          { id: 'dp_blr_1', name: 'Electronic City Toll Gate', city: 'Bangalore', time: '04:45', landmark: 'Flyover Entrance', lat: 12.8399, lng: 77.677 },
          { id: 'dp_blr_2', name: 'Silk Board Junction', city: 'Bangalore', time: '05:05', landmark: 'Near Bus Stop', lat: 12.9177, lng: 77.6238 },
          { id: 'dp_blr_3', name: 'Majestic Bus Stand', city: 'Bangalore', time: '05:30', landmark: 'Platform 1', lat: 12.9774, lng: 77.5708 },
        ],
      },
      {
        id: 'trip_pun_mum_505',
        operatorId: 'op_shivneri_msrtc',
        operatorName: 'Shivneri AC Volvo Express',
        busNumber: 'MH-12-RN-6002',
        busType: 'Volvo Multi-Axle AC',
        rating: 4.9,
        reviewCount: 3120,
        sourceCity: 'Pune',
        destinationCity: 'Mumbai',
        departureTime: '17:00',
        arrivalTime: '20:30',
        duration: '3h 30m',
        date: today,
        baseFare: 550,
        currentFare: 580,
        amenities: ['Expressway Green Corridor', 'CCTV Surveillance', 'Sanitized Interior', 'Pushback Ergonomic Seats'],
        driverName: 'Anil Shinde',
        driverPhone: '+91 98220 11223',
        status: 'on_route',
        boardingPoints: [
          { id: 'bp_pun_1', name: 'Swargate Bus Terminal', city: 'Pune', time: '17:00', landmark: 'Platform 6', lat: 18.5018, lng: 73.8636 },
          { id: 'bp_pun_2', name: 'Wakad Bridge Flyover', city: 'Pune', time: '17:35', landmark: 'Ginger Hotel Side', lat: 18.5987, lng: 73.7634 },
        ],
        droppingPoints: [
          { id: 'dp_mum_exp_1', name: 'Vashi Toll Plaza', city: 'Navi Mumbai', time: '19:45', landmark: 'Expressway Exit', lat: 19.0645, lng: 72.9982 },
          { id: 'dp_mum_exp_2', name: 'Dadar Asiad Bus Stand', city: 'Mumbai', time: '20:30', landmark: 'Near TT Circle', lat: 19.0178, lng: 72.8478 },
        ],
        currentGps: {
          lat: 18.7557,
          lng: 73.4091, // Lonavala expressway ghat section
          speed: 65,
          bearing: 310,
          lastUpdated: Date.now(),
          nextStop: 'Khopoli Food Mall',
          etaMinutes: 25,
        },
      },
    ];

    // Seed buses and generate realistic seat layouts
    for (const trip of tripsData) {
      const seats = this.generateSeatLayout(trip.id, trip.baseFare);
      const bookedCount = seats.filter((s) => s.isBooked).length;

      const fullTrip: BusTrip = {
        ...trip,
        totalSeats: seats.length,
        availableSeats: seats.length - bookedCount,
      };

      this.buses.set(trip.id, fullTrip);
      this.seatLayouts.set(trip.id, seats);
    }

    // Seed an initial confirmed booking for demonstration (PNR: RR849201)
    const sampleBooking: Booking = {
      id: 'book_sample_blr_hyd',
      pnr: 'RR849201',
      tripId: 'trip_blr_hyd_101',
      userId: 'usr_sample',
      passengerName: 'Alex Morgan',
      passengerEmail: 'alex.morgan@redroute.io',
      passengerPhone: '+91 98765 43210',
      passengerGender: 'male',
      seatNumbers: ['L1C'],
      totalAmount: 1199,
      boardingPoint: {
        id: 'bp_1',
        name: 'Madiwala Central redBus Lounge',
        city: 'Bangalore',
        time: '21:00',
        landmark: 'Opposite Total Mall',
        lat: 12.9226,
        lng: 77.6174,
      },
      droppingPoint: {
        id: 'dp_1',
        name: 'Ameerpet Metro Hub',
        city: 'Hyderabad',
        time: '05:30',
        landmark: 'Beside Big Bazaar',
        lat: 17.4375,
        lng: 78.4482,
      },
      status: 'confirmed',
      bookingTime: Date.now() - 3600000,
      idempotencyKey: 'idemp_sample_init_849201',
      paymentGateway: 'Razorpay',
      paymentId: 'pay_live_sample_849201',
    };
    this.bookings.set(sampleBooking.id, sampleBooking);
  }

  private generateSeatLayout(tripId: string, baseFare: number): Seat[] {
    const seats: Seat[] = [];
    const isSleeper = tripId.includes('blr') || tripId.includes('mum_goa') || tripId.includes('del');

    if (isSleeper) {
      // 2 Deck Sleeper (Lower Deck + Upper Deck)
      // 6 rows, Left has 1 sleeper berth, Right has 2 sleeper berths
      // Total = 6 rows * 3 = 18 Lower + 18 Upper = 36 berths
      const rows = 6;
      for (let r = 1; r <= rows; r++) {
        // Lower Deck
        // Left single berth
        seats.push({
          id: `L${r}A`,
          number: `L${r}A`,
          deck: 'lower',
          type: 'sleeper',
          row: r,
          col: 0,
          basePrice: baseFare + 100,
          currentPrice: baseFare + 100,
          isBooked: r === 2 || r === 4, // seed few booked
          bookedBy: r === 2 ? 'Anita Sharma' : r === 4 ? 'Vikram Rao' : undefined,
          passengerGender: r === 2 ? 'female' : r === 4 ? 'male' : undefined,
        });

        // Right double berth (aisle is col 1, col 2 and 3 are seats)
        seats.push({
          id: `L${r}B`,
          number: `L${r}B`,
          deck: 'lower',
          type: 'sleeper',
          row: r,
          col: 2,
          basePrice: baseFare,
          currentPrice: baseFare,
          isBooked: r === 1,
          bookedBy: r === 1 ? 'Kiran Patel' : undefined,
          passengerGender: r === 1 ? 'male' : undefined,
        });
        seats.push({
          id: `L${r}C`,
          number: `L${r}C`,
          deck: 'lower',
          type: 'sleeper',
          row: r,
          col: 3,
          basePrice: baseFare,
          currentPrice: baseFare,
          isBooked: false,
        });

        // Upper Deck
        seats.push({
          id: `U${r}A`,
          number: `U${r}A`,
          deck: 'upper',
          type: 'sleeper',
          row: r,
          col: 0,
          basePrice: baseFare + 150,
          currentPrice: baseFare + 150,
          isBooked: r === 3,
          bookedBy: r === 3 ? 'Deepa Nair' : undefined,
          passengerGender: r === 3 ? 'female' : undefined,
        });
        seats.push({
          id: `U${r}B`,
          number: `U${r}B`,
          deck: 'upper',
          type: 'sleeper',
          row: r,
          col: 2,
          basePrice: baseFare + 50,
          currentPrice: baseFare + 50,
          isBooked: false,
        });
        seats.push({
          id: `U${r}C`,
          number: `U${r}C`,
          deck: 'upper',
          type: 'sleeper',
          row: r,
          col: 3,
          basePrice: baseFare + 50,
          currentPrice: baseFare + 50,
          isBooked: r === 5,
          bookedBy: r === 5 ? 'Arun Kumar' : undefined,
          passengerGender: r === 5 ? 'male' : undefined,
        });
      }
    } else {
      // 2+2 Executive Seater Bus (10 rows, 4 seats per row = 40 seats)
      for (let r = 1; r <= 10; r++) {
        // Window left
        seats.push({
          id: `S${r}A`,
          number: `S${r}A`,
          deck: 'lower',
          type: 'seater',
          row: r,
          col: 0,
          basePrice: baseFare + 50,
          currentPrice: baseFare + 50,
          isBooked: r % 3 === 0,
          bookedBy: r % 3 === 0 ? 'Passenger' : undefined,
        });
        // Aisle left
        seats.push({
          id: `S${r}B`,
          number: `S${r}B`,
          deck: 'lower',
          type: 'seater',
          row: r,
          col: 1,
          basePrice: baseFare,
          currentPrice: baseFare,
          isBooked: false,
        });
        // Aisle right
        seats.push({
          id: `S${r}C`,
          number: `S${r}C`,
          deck: 'lower',
          type: 'seater',
          row: r,
          col: 3,
          basePrice: baseFare,
          currentPrice: baseFare,
          isBooked: false,
        });
        // Window right
        seats.push({
          id: `S${r}D`,
          number: `S${r}D`,
          deck: 'lower',
          type: 'seater',
          row: r,
          col: 4,
          basePrice: baseFare + 50,
          currentPrice: baseFare + 50,
          isBooked: r === 1 || r === 7,
          bookedBy: r === 1 || r === 7 ? 'Corporate Traveler' : undefined,
        });
      }
    }

    return seats;
  }
}

export const db = new DatabaseStore();

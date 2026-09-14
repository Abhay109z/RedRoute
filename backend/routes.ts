import { Router, Request, Response } from 'express';
import { db } from './database.js';
import { redis } from './redisEngine.js';
import { seatLockService } from './services/seatLockService.js';
import { pricingEngine } from './services/pricingEngine.js';
import { gpsTrackingService } from './services/gpsTrackingService.js';
import { sagaOrchestrator } from './services/sagaService.js';
import { cancellationService } from './services/cancellationService.js';
import { workerQueueService } from './services/workerQueueService.js';
import { tracingService } from './services/tracingService.js';
import { wsHub } from './websocket.js';
import { mongo } from './mongoClient.js';

export const apiRouter = Router();

// --- Rate Limiting Middleware using Redis Token Bucket ---
const rateLimiterMiddleware = (req: Request, res: Response, next: Function) => {
  // Allow health and status probes to bypass rate limiting
  if (req.path === '/health' || req.path === '/healthz' || req.path === '/ping' || req.path === '/mongodb/status') {
    return next();
  }

  const clientKey = req.ip || req.headers['x-forwarded-for']?.toString() || 'anonymous_client';
  const check = redis.checkRateLimit(clientKey, 40, 15);

  res.setHeader('X-RateLimit-Limit', '40');
  res.setHeader('X-RateLimit-Remaining', check.remainingTokens.toString());

  if (!check.allowed) {
    return res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Redis Token-Bucket protection active against bot scrapers.',
      remainingTokens: 0,
    });
  }
  next();
};

apiRouter.use(rateLimiterMiddleware);

// --- 1. Dynamic Route Search & Filtering API ---
apiRouter.get('/routes/search', (req: Request, res: Response) => {
  const { source, destination, date, busType, operator, minPrice, maxPrice } = req.query;

  const results = db.searchTrips({
    source: source ? String(source) : undefined,
    destination: destination ? String(destination) : undefined,
    date: date ? String(date) : undefined,
    busType: busType ? String(busType) : undefined,
    operator: operator ? String(operator) : undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  });

  // Calculate real-time dynamic pricing breakdown for each result
  const enrichedResults = results.map((trip) => {
    const pricing = pricingEngine.calculateFare(trip);
    return {
      ...trip,
      currentFare: pricing.finalFare,
      pricingBreakdown: pricing,
    };
  });

  res.json({
    total: enrichedResults.length,
    trips: enrichedResults,
  });
});

// --- 2. Single Bus Details ---
apiRouter.get('/buses/:id', (req: Request, res: Response) => {
  const trip = db.getTripById(req.params.id);
  if (!trip) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  const pricing = pricingEngine.calculateFare(trip);
  res.json({
    trip: {
      ...trip,
      currentFare: pricing.finalFare,
      pricingBreakdown: pricing,
    },
  });
});

// --- 3. Interactive Seat Selection with Real-time Redis Lock Inspection ---
apiRouter.get('/buses/:id/seats', (req: Request, res: Response) => {
  const tripId = req.params.id;
  const trip = db.getTripById(tripId);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  const seats = seatLockService.getSeatsWithActiveLocks(tripId);
  res.json({
    tripId,
    busType: trip.busType,
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => !s.isBooked && !s.lockedBy).length,
    seats,
  });
});

// --- 4. Atomic Redis Seat Locking Endpoint ---
apiRouter.post('/seats/lock', (req: Request, res: Response) => {
  const { tripId, seatId, userId, ttlMs } = req.body;

  if (!tripId || !seatId || !userId) {
    return res.status(400).json({ error: 'tripId, seatId, and userId are required' });
  }

  const result = seatLockService.acquireSeatLock(tripId, seatId, userId, ttlMs || 300000);

  if (!result.success) {
    return res.status(409).json({
      success: false,
      error: result.error,
      remainingTtlMs: result.remainingTtlMs,
      expiresAt: result.expiresAt,
    });
  }

  // Broadcast lock state to all clients on this trip
  wsHub.broadcast(
    {
      type: 'SEAT_LOCKED',
      tripId,
      seatId,
      owner: userId,
      expiresAt: result.expiresAt,
    },
    tripId
  );

  res.json({
    success: true,
    seatId,
    expiresAt: result.expiresAt,
    remainingTtlMs: result.remainingTtlMs,
  });
});

// --- 5. Atomic Seat Release ---
apiRouter.post('/seats/release', (req: Request, res: Response) => {
  const { tripId, seatId, userId } = req.body;

  if (!tripId || !seatId || !userId) {
    return res.status(400).json({ error: 'tripId, seatId, and userId are required' });
  }

  const released = seatLockService.releaseSeatLock(tripId, seatId, userId);

  wsHub.broadcast(
    {
      type: 'SEAT_RELEASED',
      tripId,
      seatId,
      owner: userId,
    },
    tripId
  );

  res.json({ success: released });
});

// --- 6. Distributed Saga Booking Checkout with Idempotent Webhook support ---
apiRouter.post('/bookings/checkout', async (req: Request, res: Response) => {
  try {
    const {
      tripId,
      userId,
      passengerName,
      passengerEmail,
      passengerPhone,
      passengerGender,
      seatIds,
      boardingPointId,
      droppingPointId,
      idempotencyKey,
      paymentGateway,
      totalAmount,
      simulateDbFailure,
    } = req.body;

    if (!tripId || !userId || !seatIds || seatIds.length === 0 || !idempotencyKey) {
      return res.status(400).json({ error: 'Missing required checkout parameters' });
    }

    const sagaResult = await sagaOrchestrator.executeBookingSaga({
      tripId,
      userId,
      passengerName: passengerName || 'Guest Passenger',
      passengerEmail: passengerEmail || 'passenger@redroute.io',
      passengerPhone: passengerPhone || '+91 98765 43210',
      passengerGender: passengerGender || 'male',
      seatIds,
      boardingPointId,
      droppingPointId,
      idempotencyKey,
      paymentGateway: paymentGateway || 'Razorpay',
      totalAmount: Number(totalAmount) || 1200,
      simulateDbFailure: Boolean(simulateDbFailure),
    });

    if (!sagaResult.success) {
      return res.status(422).json(sagaResult);
    }

    // Broadcast seats booked to all viewers
    wsHub.broadcast({
      type: 'SEATS_BOOKED',
      tripId,
      seatNumbers: sagaResult.booking?.seatNumbers,
    });

    res.json(sagaResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Saga execution failed' });
  }
});

// --- 7. Automated Tiered Cancellation & Refund ---
apiRouter.post('/bookings/cancel', (req: Request, res: Response) => {
  const { bookingId } = req.body;
  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is required' });
  }

  const result = cancellationService.processCancellation(bookingId);
  if (!result.success) {
    return res.status(400).json(result);
  }

  // Broadcast freed seats
  if (result.booking) {
    wsHub.broadcast({
      type: 'SEATS_FREED',
      tripId: result.booking.tripId,
      freedSeats: result.booking.seatNumbers,
    });
  }

  res.json(result);
});

// --- 8. Lookup Booking by PNR ---
apiRouter.get('/bookings/pnr/:pnr', (req: Request, res: Response) => {
  const booking = db.getBookingByPnr(req.params.pnr);
  if (!booking) {
    return res.status(404).json({ error: 'Booking with this PNR not found' });
  }
  const quote = cancellationService.calculateRefundQuote(booking);
  res.json({ booking, refundQuote: quote });
});

// --- 8b. Get All Bookings (Admin & Auditor) ---
apiRouter.get('/bookings/all', (req: Request, res: Response) => {
  const bookings = db.getAllBookings();
  res.json({ bookings, count: bookings.length });
});

// --- 8c. Get Bookings for Current User ---
apiRouter.get('/bookings/user/:userId?', (req: Request, res: Response) => {
  const userId = req.params.userId;
  const bookings = db.getBookingsByUser(userId);
  res.json({ bookings, count: bookings.length });
});

apiRouter.get('/bookings/user', (req: Request, res: Response) => {
  const bookings = db.getBookingsByUser();
  res.json({ bookings, count: bookings.length });
});

// --- 8d. Get Single Booking by ID ---
apiRouter.get('/bookings/:id', (req: Request, res: Response) => {
  const booking = db.getBookingById(req.params.id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  res.json({ booking });
});

// --- 9. Real-Time Bus GPS Tracking & ETA Telemetry ---
apiRouter.get('/gps/:tripId', (req: Request, res: Response) => {
  const telemetry = gpsTrackingService.getTelemetry(req.params.tripId);
  if (!telemetry) {
    return res.status(404).json({ error: 'No active telemetry found for trip' });
  }
  res.json(telemetry);
});

// --- 10. Driver Mobile App GPS Ingestion ---
apiRouter.post('/gps/driver-update', (req: Request, res: Response) => {
  const { tripId, lat, lng, speed, bearing } = req.body;
  const telemetry = gpsTrackingService.ingestDriverGps(tripId, Number(lat), Number(lng), Number(speed), Number(bearing));
  if (!telemetry) {
    return res.status(404).json({ error: 'Trip not found for GPS update' });
  }

  wsHub.broadcast({
    type: 'GPS_TELEMETRY_UPDATE',
    tripId,
    telemetry,
  });

  res.json({ success: true, telemetry });
});

// --- 11. Multi-Tenant Operator Portal: Fleet & Revenue Analytics ---
apiRouter.get('/operator/fleet', (req: Request, res: Response) => {
  const trips = db.getAllTrips();
  const bookings = db.getAllBookings();

  const totalRevenue = bookings
    .filter((b) => b.status === 'confirmed')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  const totalPassengers = bookings
    .filter((b) => b.status === 'confirmed')
    .reduce((acc, curr) => acc + curr.seatNumbers.length, 0);

  const fleetOverview = trips.map((trip) => {
    const seats = db.getSeatsForTrip(trip.id);
    const booked = seats.filter((s) => s.isBooked).length;
    const occupancyRate = Math.round((booked / seats.length) * 100);

    return {
      ...trip,
      occupancyRate,
      bookedSeatsCount: booked,
      tripRevenue: bookings
        .filter((b) => b.tripId === trip.id && b.status === 'confirmed')
        .reduce((sum, b) => sum + b.totalAmount, 0),
    };
  });

  res.json({
    metrics: {
      totalFleetBuses: trips.length,
      activeOnRoute: trips.filter((t) => t.status === 'on_route').length,
      totalRevenue,
      totalPassengers,
      averageOccupancy: Math.round(
        fleetOverview.reduce((sum, f) => sum + f.occupancyRate, 0) / (fleetOverview.length || 1)
      ),
    },
    buses: fleetOverview,
  });
});

// --- 12. Operator Schedule / Fare Modification ---
apiRouter.post('/operator/buses/:id/schedule', (req: Request, res: Response) => {
  const { departureTime, baseFare, status, driverName, driverPhone } = req.body;
  const updated = db.updateTrip(req.params.id, {
    ...(departureTime ? { departureTime } : {}),
    ...(baseFare ? { baseFare: Number(baseFare) } : {}),
    ...(status ? { status } : {}),
    ...(driverName ? { driverName } : {}),
    ...(driverPhone ? { driverPhone } : {}),
  });

  if (!updated) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  res.json({ success: true, trip: updated });
});

// --- 13. High-Concurrency Stress Test Benchmark Lab ---
apiRouter.post('/stress-test/seat-lock', (req: Request, res: Response) => {
  const { tripId, seatId, concurrentUsers } = req.body;
  const testTripId = tripId || 'trip_blr_hyd_101';
  const testSeatId = seatId || 'L1C';
  const usersCount = Number(concurrentUsers) || 30;

  const benchmark = seatLockService.runConcurrencyStressTest(testTripId, testSeatId, usersCount);

  res.json({
    ...benchmark,
    architectureNote: 'Redis SET NX PX atomic distributed lock guarantees exactly 1 winner, rejecting (N-1) race conflicts.',
  });
});

// --- 14. Distributed Tracing (OpenTelemetry / Zap waterfall) ---
apiRouter.get('/system/traces', (req: Request, res: Response) => {
  const traces = tracingService.getRecentSpans(60);
  res.json({ traces });
});

// --- 15. Asynq / Machinery Background Worker Queue Status ---
apiRouter.get('/system/workers', (req: Request, res: Response) => {
  const jobs = workerQueueService.getJobs();
  const metrics = workerQueueService.getQueueMetrics();
  res.json({ metrics, jobs });
});

// --- 16. Circuit Breakers Status ---
apiRouter.get('/system/circuit-breakers', (req: Request, res: Response) => {
  res.json({ breakers: tracingService.getCircuitBreakers() });
});

apiRouter.post('/system/circuit-breakers/toggle', (req: Request, res: Response) => {
  const { service, state } = req.body;
  const updated = tracingService.toggleCircuitBreaker(service, state);
  res.json({ breaker: updated });
});

// --- 17. Audit Logs ---
apiRouter.get('/system/audit-logs', (req: Request, res: Response) => {
  res.json({ logs: db.getAuditLogs() });
});

// --- 18. MongoDB Status ---
apiRouter.get('/mongodb/status', (req: Request, res: Response) => {
  res.json(mongo.getStatus());
});

// --- 19. Health Check ---
apiRouter.get('/health', (req: Request, res: Response) => {
  const mongoStatus = mongo.getStatus();
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptimeSec: process.uptime(),
    redis: 'online',
    postgres: 'connected',
    mongodb: mongoStatus.connected ? 'connected' : (mongoStatus.configured ? 'connecting' : 'in-memory-fallback'),
    mongoDetails: mongoStatus,
    websocketClients: wsHub.getConnectedClientsCount(),
  });
});

// Fallback 404 for unknown /api/* requests
apiRouter.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `API route ${req.baseUrl}${req.path} does not exist.`,
  });
});


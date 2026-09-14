import { db } from '../database.js';
import { redis } from '../redisEngine.js';
import { workerQueueService } from './workerQueueService.js';
import { tracingService } from './tracingService.js';
import { Booking, SeatGender } from '../types.js';

export interface SagaCheckoutPayload {
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
  totalAmount: number;
  simulateDbFailure?: boolean;
}

export interface SagaStepLog {
  step: string;
  service: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'COMPENSATED';
  timestamp: number;
  durationMs: number;
  details?: any;
}

export interface SagaResult {
  success: boolean;
  booking?: Booking;
  sagaTraceId: string;
  steps: SagaStepLog[];
  compensationTriggered: boolean;
  error?: string;
}

export class SagaOrchestrator {
  /**
   * Executes the distributed booking saga
   */
  public async executeBookingSaga(payload: SagaCheckoutPayload): Promise<SagaResult> {
    const sagaTraceId = `trace_saga_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const steps: SagaStepLog[] = [];
    let paymentId: string | null = null;
    let lockOwner = payload.userId;
    let compensationTriggered = false;

    // --- STEP 1: Verify Redis Distributed Locks ---
    const step1Start = performance.now();
    let locksValid = true;
    for (const seatId of payload.seatIds) {
      const lockKey = `lock:seat:${payload.tripId}:${seatId}`;
      const lock = redis.getLock(lockKey);
      // Valid if owned by this user or freshly acquireable
      if (lock && lock.owner !== lockOwner) {
        locksValid = false;
        break;
      }
    }

    const step1Duration = parseFloat((performance.now() - step1Start).toFixed(2));
    if (!locksValid) {
      steps.push({
        step: '1_VERIFY_DISTRIBUTED_LOCK',
        service: 'Redis_Lock_Engine',
        status: 'FAILED',
        timestamp: Date.now(),
        durationMs: step1Duration,
        details: { error: 'Seat lock expired or captured by concurrent user' },
      });
      return {
        success: false,
        sagaTraceId,
        steps,
        compensationTriggered: false,
        error: 'Seat lock has expired or is no longer reserved for your session.',
      };
    }

    steps.push({
      step: '1_VERIFY_DISTRIBUTED_LOCK',
      service: 'Redis_Lock_Engine',
      status: 'SUCCESS',
      timestamp: Date.now(),
      durationMs: step1Duration,
      details: { seats: payload.seatIds, lockOwner },
    });

    tracingService.recordSpan({
      id: `span_${Date.now()}_1`,
      traceId: sagaTraceId,
      name: 'Verify_Redis_Distributed_Lock',
      service: 'Redis_Lock_Manager',
      startTimeMs: Date.now(),
      durationMs: step1Duration,
      status: 'ok',
    });

    // --- STEP 2: Idempotent Payment Authorization ---
    const step2Start = performance.now();
    // Simulate payment gateway (Razorpay/Stripe) authorization
    paymentId = `pay_${payload.paymentGateway.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const step2Duration = parseFloat((performance.now() - step2Start).toFixed(2));

    steps.push({
      step: '2_AUTHORIZE_PAYMENT_GATEWAY',
      service: payload.paymentGateway === 'Razorpay' ? 'Payment_Gateway' : 'Payment_Gateway',
      status: 'SUCCESS',
      timestamp: Date.now(),
      durationMs: step2Duration + 45, // realistic gateway roundtrip
      details: {
        paymentId,
        idempotencyKey: payload.idempotencyKey,
        amount: payload.totalAmount,
        currency: 'INR',
      },
    });

    tracingService.recordSpan({
      id: `span_${Date.now()}_2`,
      traceId: sagaTraceId,
      name: `Charge_${payload.paymentGateway}_Payment`,
      service: 'Payment_Gateway',
      startTimeMs: Date.now(),
      durationMs: step2Duration + 45,
      status: 'ok',
      metadata: { paymentId, idempotencyKey: payload.idempotencyKey },
    });

    // --- STEP 3: ACID PostgreSQL Database Booking Write ---
    const step3Start = performance.now();
    const dbResult = db.executeBookingTransaction({
      tripId: payload.tripId,
      userId: payload.userId,
      passengerName: payload.passengerName,
      passengerEmail: payload.passengerEmail,
      passengerPhone: payload.passengerPhone,
      passengerGender: payload.passengerGender,
      seatIds: payload.seatIds,
      boardingPointId: payload.boardingPointId,
      droppingPointId: payload.droppingPointId,
      idempotencyKey: payload.idempotencyKey,
      paymentGateway: payload.paymentGateway,
      paymentId,
      totalAmount: payload.totalAmount,
      simulateDbFailure: payload.simulateDbFailure,
    });

    const step3Duration = parseFloat((performance.now() - step3Start).toFixed(2));

    if (!dbResult.success) {
      // ⚠️ CRITICAL SAGA FAILURE: Payment captured, but database write failed!
      // Must trigger compensating transactions
      compensationTriggered = true;

      steps.push({
        step: '3_POSTGRES_ACID_COMMIT',
        service: 'Postgres_ACID_Engine',
        status: 'FAILED',
        timestamp: Date.now(),
        durationMs: step3Duration,
        details: { error: dbResult.error },
      });

      tracingService.recordSpan({
        id: `span_${Date.now()}_3`,
        traceId: sagaTraceId,
        name: 'Postgres_ACID_Commit',
        service: 'Postgres_ACID_Engine',
        startTimeMs: Date.now(),
        durationMs: step3Duration,
        status: 'error',
        metadata: { error: dbResult.error },
      });

      // --- COMPENSATING TRANSACTION 1: Automated Payment Gateway Refund ---
      const comp1Start = performance.now();
      const refundId = `ref_${Date.now()}_${paymentId}`;
      const comp1Duration = parseFloat((performance.now() - comp1Start).toFixed(2));

      steps.push({
        step: 'COMPENSATE_AUTO_REFUND_GATEWAY',
        service: 'Payment_Gateway',
        status: 'COMPENSATED',
        timestamp: Date.now(),
        durationMs: comp1Duration + 30,
        details: {
          refundId,
          refundedPaymentId: paymentId,
          amountRefunded: payload.totalAmount,
          reason: 'Database write failure saga rollback',
        },
      });

      // --- COMPENSATING TRANSACTION 2: Release Redis Seat Locks ---
      const comp2Start = performance.now();
      for (const seatId of payload.seatIds) {
        const lockKey = `lock:seat:${payload.tripId}:${seatId}`;
        redis.forceReleaseLock(lockKey);
        db.updateSeatStatus(payload.tripId, seatId, { lockedBy: undefined, lockedUntil: undefined });
      }
      const comp2Duration = parseFloat((performance.now() - comp2Start).toFixed(2));

      steps.push({
        step: 'COMPENSATE_RELEASE_REDIS_LOCKS',
        service: 'Redis_Lock_Engine',
        status: 'COMPENSATED',
        timestamp: Date.now(),
        durationMs: comp2Duration,
        details: { releasedSeats: payload.seatIds },
      });

      return {
        success: false,
        sagaTraceId,
        steps,
        compensationTriggered: true,
        error: `TRANSACTION_ROLLBACK: ${dbResult.error}. SAGA COMPENSATING ACTION EXECUTED: Payment ${paymentId} fully refunded. Seat locks released back to pool.`,
      };
    }

    // Step 3 Succeeded!
    steps.push({
      step: '3_POSTGRES_ACID_COMMIT',
      service: 'Postgres_ACID_Engine',
      status: 'SUCCESS',
      timestamp: Date.now(),
      durationMs: step3Duration,
      details: { pnr: dbResult.booking?.pnr, bookingId: dbResult.booking?.id },
    });

    tracingService.recordSpan({
      id: `span_${Date.now()}_3`,
      traceId: sagaTraceId,
      name: 'Postgres_ACID_Commit',
      service: 'Postgres_ACID_Engine',
      startTimeMs: Date.now(),
      durationMs: step3Duration,
      status: 'ok',
      metadata: { pnr: dbResult.booking?.pnr },
    });

    // Release temporary Redis locks now that seats are permanently committed
    for (const seatId of payload.seatIds) {
      const lockKey = `lock:seat:${payload.tripId}:${seatId}`;
      redis.releaseLock(lockKey, lockOwner);
    }

    // --- STEP 4: Asynchronous Background Worker Queue Dispatch ---
    const step4Start = performance.now();
    workerQueueService.enqueue('pdf_tickets', {
      bookingId: dbResult.booking!.id,
      pnr: dbResult.booking!.pnr,
      passenger: payload.passengerName,
      seats: dbResult.booking!.seatNumbers,
    });
    workerQueueService.enqueue('whatsapp_notifications', {
      phone: payload.passengerPhone,
      message: `Your RedRoute Ticket is confirmed! PNR: ${dbResult.booking!.pnr}. Track live bus: /track/${payload.tripId}`,
    });
    workerQueueService.enqueue('email_confirmations', {
      email: payload.passengerEmail,
      subject: `RedRoute E-Ticket Confirmation - ${dbResult.booking!.pnr}`,
    });

    const step4Duration = parseFloat((performance.now() - step4Start).toFixed(2));
    steps.push({
      step: '4_DISPATCH_BACKGROUND_WORKERS',
      service: 'Worker_Pool',
      status: 'SUCCESS',
      timestamp: Date.now(),
      durationMs: step4Duration,
      details: {
        enqueuedJobs: ['pdf_tickets', 'whatsapp_notifications', 'email_confirmations'],
      },
    });

    tracingService.recordSpan({
      id: `span_${Date.now()}_4`,
      traceId: sagaTraceId,
      name: 'Dispatch_Background_Workers',
      service: 'Worker_Pool',
      startTimeMs: Date.now(),
      durationMs: step4Duration,
      status: 'ok',
    });

    return {
      success: true,
      booking: dbResult.booking,
      sagaTraceId,
      steps,
      compensationTriggered: false,
    };
  }
}

export const sagaOrchestrator = new SagaOrchestrator();

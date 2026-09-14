import { TraceSpan } from '../types.js';

export interface CircuitBreakerState {
  service: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  threshold: number;
  lastFailureTime?: number;
  cooldownMs: number;
}

export class TracingService {
  private spans: TraceSpan[] = [];
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  constructor() {
    this.initCircuitBreakers();
  }

  public recordSpan(span: TraceSpan): void {
    this.spans.push(span);
    // Keep last 300 spans
    if (this.spans.length > 300) {
      this.spans.shift();
    }
  }

  public getRecentSpans(limit: number = 50): TraceSpan[] {
    return [...this.spans].reverse().slice(0, limit);
  }

  public getSpansByTraceId(traceId: string): TraceSpan[] {
    return this.spans.filter((s) => s.traceId === traceId);
  }

  // --- Circuit Breaker Management ---
  private initCircuitBreakers(): void {
    this.circuitBreakers.set('Payment_Gateway', {
      service: 'Payment_Gateway (Stripe / Razorpay)',
      state: 'CLOSED',
      failureCount: 0,
      threshold: 5,
      cooldownMs: 30000,
    });
    this.circuitBreakers.set('SMS_Gateway', {
      service: 'SMS / WhatsApp Notification Gateway',
      state: 'CLOSED',
      failureCount: 0,
      threshold: 4,
      cooldownMs: 20000,
    });
    this.circuitBreakers.set('Redis_Cache_Cluster', {
      service: 'Redis Distributed Cache',
      state: 'CLOSED',
      failureCount: 0,
      threshold: 3,
      cooldownMs: 15000,
    });
  }

  public getCircuitBreakers(): CircuitBreakerState[] {
    return Array.from(this.circuitBreakers.values());
  }

  public toggleCircuitBreaker(serviceName: string, state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): CircuitBreakerState | null {
    const cb = this.circuitBreakers.get(serviceName);
    if (!cb) return null;
    cb.state = state;
    cb.failureCount = state === 'OPEN' ? cb.threshold : 0;
    return cb;
  }
}

export const tracingService = new TracingService();

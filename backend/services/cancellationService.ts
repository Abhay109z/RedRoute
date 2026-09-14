import { db } from '../database.js';
import { workerQueueService } from './workerQueueService.js';
import { Booking } from '../types.js';

export interface RefundQuote {
  totalAmount: number;
  refundPercentage: number;
  deductionFee: number;
  refundAmount: number;
  tier: string;
  hoursUntilDeparture: number;
}

export class CancellationService {
  /**
   * Calculates sliding-scale tiered refund quote
   */
  public calculateRefundQuote(booking: Booking): RefundQuote {
    const trip = db.getTripById(booking.tripId);
    let hoursUntilDeparture = 26; // default safe fallback

    if (trip) {
      const now = new Date();
      const currentHour = now.getHours();
      const [depHour] = trip.departureTime.split(':').map(Number);
      hoursUntilDeparture = Math.max(1, depHour - currentHour + 24);
    }

    let refundPercentage = 0;
    let deductionFee = 0;
    let tier = '';

    if (hoursUntilDeparture >= 24) {
      refundPercentage = 100;
      deductionFee = 50; // Standard cancellation fee
      tier = 'Tier 1: > 24 hours before departure (Full Refund minus flat Rs.50 handling)';
    } else if (hoursUntilDeparture >= 12) {
      refundPercentage = 75;
      deductionFee = Math.round(booking.totalAmount * 0.25);
      tier = 'Tier 2: 12 to 24 hours before departure (75% Refund)';
    } else if (hoursUntilDeparture >= 6) {
      refundPercentage = 50;
      deductionFee = Math.round(booking.totalAmount * 0.5);
      tier = 'Tier 3: 6 to 12 hours before departure (50% Refund)';
    } else {
      refundPercentage = 0;
      deductionFee = booking.totalAmount;
      tier = 'Tier 4: < 6 hours before departure (Non-refundable)';
    }

    const calculatedRefund = Math.max(0, Math.round(booking.totalAmount * (refundPercentage / 100) - deductionFee));

    return {
      totalAmount: booking.totalAmount,
      refundPercentage,
      deductionFee,
      refundAmount: calculatedRefund,
      tier,
      hoursUntilDeparture,
    };
  }

  /**
   * Process cancellation, free database seats, enqueue refund worker
   */
  public processCancellation(bookingId: string): { success: boolean; booking?: Booking; quote?: RefundQuote; error?: string } {
    const booking = db.getBookingById(bookingId);
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (booking.status === 'cancelled') {
      return { success: false, error: 'Booking is already cancelled' };
    }

    const quote = this.calculateRefundQuote(booking);
    const cancelRes = db.cancelBooking(bookingId, quote.refundAmount, quote.deductionFee, quote.tier);

    if (!cancelRes.success) {
      return { success: false, error: cancelRes.error };
    }

    // Offload refund processing to worker queue
    workerQueueService.enqueue('refund_processor', {
      bookingId,
      pnr: booking.pnr,
      amount: quote.refundAmount,
      gateway: booking.paymentGateway,
      paymentId: booking.paymentId,
    });

    return {
      success: true,
      booking: cancelRes.booking,
      quote,
    };
  }
}

export const cancellationService = new CancellationService();

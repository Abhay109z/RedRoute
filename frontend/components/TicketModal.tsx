import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, QrCode, Radio, Download, AlertTriangle, ArrowRight, ShieldCheck, MapPin, Calendar, Clock, Bus } from 'lucide-react';
import { Booking } from '../../backend/types.js';

interface TicketModalProps {
  booking: Booking;
  onClose: () => void;
  onTrackBus: (tripId: string) => void;
  onBookingCancelled?: () => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  booking,
  onClose,
  onTrackBus,
  onBookingCancelled,
}) => {
  const [currentBooking, setCurrentBooking] = useState<Booking>(booking);
  const [refundQuote, setRefundQuote] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [showCancelPrompt, setShowCancelPrompt] = useState<boolean>(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Fetch latest booking & refund quote
    fetchQuote();
  }, [booking.pnr]);

  const fetchQuote = async () => {
    try {
      const res = await fetch(`/api/bookings/pnr/${booking.pnr}`);
      const data = await res.json();
      if (data.booking) {
        setCurrentBooking(data.booking);
        setRefundQuote(data.refundQuote);
      }
    } catch (e) {
      console.error('Failed to fetch quote:', e);
    }
  };

  const handleCancelBooking = async () => {
    setIsCancelling(true);
    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: currentBooking.id }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setCurrentBooking(data.booking);
        setCancelSuccessMsg(
          `Ticket Cancelled! Refund of ₹${data.quote.refundAmount} initiated to your original payment gateway (${currentBooking.paymentGateway}). Seats freed back into Redis inventory.`
        );
        setShowCancelPrompt(false);
        if (onBookingCancelled) onBookingCancelled();
      }
    } catch (err) {
      console.error('Cancellation error:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const isCancelled = currentBooking.status === 'cancelled';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border-2 border-red-100 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col my-auto">
        {/* Header Strip */}
        <div className={`${isCancelled ? 'bg-slate-800' : 'bg-[#D84E55]'} text-white px-6 py-4 flex items-center justify-between shadow-sm`}>
          <div className="flex items-center gap-2">
            {!isCancelled ? (
              <CheckCircle2 className="w-5 h-5 text-white" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-200" />
            )}
            <h3 className="font-black text-lg sm:text-xl">
              {isCancelled ? 'Cancelled Ticket' : 'Confirmed E-Boarding Pass'}
            </h3>
          </div>

          <button
            id="close-ticket-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Cancelled Alert if applicable */}
        {isCancelled && (
          <div className="bg-red-50 border-b border-red-200 p-4 text-xs text-[#D84E55]">
            <strong className="block font-black mb-0.5">Booking Cancelled</strong>
            <p className="font-medium">
              Refund of ₹{currentBooking.cancellationRefund?.refundAmount} ({currentBooking.cancellationRefund?.refundTier}) was issued to {currentBooking.paymentGateway}.
            </p>
          </div>
        )}

        {cancelSuccessMsg && (
          <div className="bg-red-50 border-b border-red-200 p-4 text-xs text-[#D84E55] font-bold">
            {cancelSuccessMsg}
          </div>
        )}

        {/* Main Boarding Pass Container */}
        <div className="p-6 overflow-y-auto space-y-5 bg-[#FCFAFA]">
          {/* PNR and Barcode Banner */}
          <div className="bg-white p-5 rounded-2xl border-2 border-red-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#D84E55] block">
                Booking Reference (PNR)
              </span>
              <span className="text-2xl sm:text-3xl font-mono font-black text-slate-900 tracking-wider">
                {currentBooking.pnr}
              </span>
              <span className="text-xs text-[#D84E55] font-bold block mt-0.5">
                ACID Committed • PostgreSQL Verified
              </span>
            </div>

            <div className="w-16 h-16 bg-white p-1 rounded-xl border-2 border-red-100 flex items-center justify-center shadow-2xs">
              <QrCode className="w-14 h-14 text-slate-800" />
            </div>
          </div>

          {/* Passenger & Seats Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-white p-4 rounded-2xl border-2 border-red-50 shadow-xs">
              <span className="text-slate-400 font-bold block mb-1">Passenger Name</span>
              <span className="font-black text-slate-900 text-sm block">
                {currentBooking.passengerName}
              </span>
              <span className="text-[11px] text-slate-500 font-medium capitalize block mt-0.5">
                {currentBooking.passengerGender} • {currentBooking.passengerPhone}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border-2 border-red-50 shadow-xs">
              <span className="text-slate-400 font-bold block mb-1">Reserved Seats</span>
              <div className="flex gap-1.5 flex-wrap">
                {currentBooking.seatNumbers.map((sn) => (
                  <span
                    key={sn}
                    className="font-mono font-black text-sm bg-red-50 text-[#D84E55] px-2.5 py-0.5 rounded-lg border border-red-200 shadow-2xs"
                  >
                    {sn}
                  </span>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 font-medium block mt-1">
                Total Paid: ₹{currentBooking.totalAmount}
              </span>
            </div>
          </div>

          {/* Boarding and Dropping Points */}
          <div className="bg-white p-5 rounded-2xl border-2 border-red-50 shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D84E55] mt-1 shrink-0"></div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {currentBooking.boardingPoint.time}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {currentBooking.boardingPoint.name}
                  </span>
                </div>
                <span className="text-xs text-slate-400 block">
                  {currentBooking.boardingPoint.city} • Landmark: {currentBooking.boardingPoint.landmark}
                </span>
              </div>
            </div>

            <div className="border-l-2 border-dashed border-red-200 ml-1 h-4"></div>

            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D84E55] mt-1 shrink-0"></div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {currentBooking.droppingPoint.time}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {currentBooking.droppingPoint.name}
                  </span>
                </div>
                <span className="text-xs text-slate-400 block">
                  {currentBooking.droppingPoint.city} • Landmark: {currentBooking.droppingPoint.landmark}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {!isCancelled && (
              <button
                id="ticket-track-bus-btn"
                onClick={() => onTrackBus(currentBooking.tripId)}
                className="flex-1 py-3 px-4 bg-[#D84E55] hover:bg-[#b52a31] text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-red-500/30 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Radio className="w-4 h-4 text-white animate-pulse" />
                <span>Track Bus Live GPS</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="py-3 px-4 bg-white hover:bg-red-50 text-[#D84E55] border-2 border-red-100 hover:border-red-300 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Print Pass</span>
            </button>

            {!isCancelled && !showCancelPrompt && (
              <button
                id="initiate-cancel-btn"
                onClick={() => setShowCancelPrompt(true)}
                className="py-3 px-4 bg-white hover:bg-red-50 text-[#D84E55] border-2 border-red-200 rounded-2xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                Cancel Ticket
              </button>
            )}
          </div>

          {/* Sliding-Scale Tiered Refund Confirmation Prompt */}
          {showCancelPrompt && refundQuote && (
            <div className="bg-white border-2 border-red-200 rounded-2xl p-4 text-xs space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-[#D84E55] font-black">
                <AlertTriangle className="w-4 h-4 text-[#D84E55]" />
                <span>Automated Cancellation Policy</span>
              </div>

              <p className="text-slate-600 leading-relaxed font-medium">
                Rule Applied: <strong>{refundQuote.tier}</strong>
              </p>

              <div className="bg-red-50/50 p-3 rounded-xl border border-red-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 font-bold">Total Paid:</span>
                  <span className="font-bold text-slate-900 block">₹{refundQuote.totalAmount}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold">Deduction Fee:</span>
                  <span className="font-bold text-[#D84E55] block">₹{refundQuote.deductionFee}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-red-100 flex justify-between items-center">
                  <span className="text-slate-700 font-bold">Estimated Refund:</span>
                  <span className="text-base font-black text-[#D84E55]">₹{refundQuote.refundAmount}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Keep Ticket
                </button>
                <button
                  id="confirm-cancel-ticket-btn"
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCancelBooking}
                  className="px-4 py-2 rounded-xl bg-[#D84E55] hover:bg-[#b52a31] text-white font-black transition-all cursor-pointer shadow-sm"
                >
                  {isCancelling ? 'Releasing Seats...' : 'Confirm Cancellation & Refund'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

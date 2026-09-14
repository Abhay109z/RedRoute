import React, { useState } from 'react';
import { X, ShieldCheck, CreditCard, RefreshCw, AlertTriangle, ArrowRight, CheckCircle2, User, Phone, Mail, MapPin } from 'lucide-react';
import { Seat, Booking, SeatGender } from '../../backend/types.js';
import { EnrichedBusTrip } from '../types.js';
import { useAuth } from '../context/AuthContext.js';
import { apiUrl } from '../utils/api.js';

interface CheckoutModalProps {
  trip: EnrichedBusTrip;
  selectedSeats: Seat[];
  totalFare: number;
  onClose: () => void;
  onBookingSuccess: (booking: Booking, sagaTraceId?: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  trip,
  selectedSeats,
  totalFare,
  onClose,
  onBookingSuccess,
}) => {
  const { userId } = useAuth();

  const [passengerName, setPassengerName] = useState('Ananya Verma');
  const [passengerEmail, setPassengerEmail] = useState('ananya.verma@example.com');
  const [passengerPhone, setPassengerPhone] = useState('+91 98200 45678');
  const [passengerGender, setPassengerGender] = useState<SeatGender>('female');

  const [boardingPointId, setBoardingPointId] = useState(trip.boardingPoints[0]?.id || '');
  const [droppingPointId, setDroppingPointId] = useState(trip.droppingPoints[0]?.id || '');

  const [paymentGateway, setPaymentGateway] = useState<'Razorpay' | 'Stripe'>('Razorpay');
  const [idempotencyKey, setIdempotencyKey] = useState(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const [simulateDbFailure, setSimulateDbFailure] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [sagaLogs, setSagaLogs] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const regenerateIdempotencyKey = () => {
    setIdempotencyKey(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMsg(null);
    setSagaLogs([]);

    try {
      const res = await fetch(apiUrl('/api/bookings/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: trip.id,
          userId,
          passengerName,
          passengerEmail,
          passengerPhone,
          passengerGender,
          seatIds: selectedSeats.map((s) => s.id),
          boardingPointId,
          droppingPointId,
          idempotencyKey,
          paymentGateway,
          totalAmount: totalFare,
          simulateDbFailure,
        }),
      });

      const data = await res.json();

      if (data.steps) {
        setSagaLogs(data.steps);
      }

      if (res.ok && data.success && data.booking) {
        onBookingSuccess(data.booking, data.sagaTraceId);
      } else {
        setErrorMsg(data.error || 'Checkout failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network connection failed during saga');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border-2 border-red-100 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col my-auto">
        {/* Header */}
        <div className="bg-[#D84E55] text-white px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h3 className="font-black text-lg flex items-center gap-2">
              <span>Checkout & Booking Details</span>
              <span className="text-[10px] bg-white/25 text-white px-2 py-0.5 rounded-full font-mono font-bold">
                Live Engine
              </span>
            </h3>
            <p className="text-xs text-red-100 font-medium">
              {trip.operatorName} • {selectedSeats.length} Seat(s): {selectedSeats.map((s) => s.number).join(', ')}
            </p>
          </div>

          <button
            id="close-checkout-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Error / Saga Compensating Alert */}
        {errorMsg && (
          <div className="bg-red-50 border-b border-red-200 p-4 text-xs text-[#D84E55]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-[#D84E55] shrink-0 mt-0.5" />
              <div>
                <strong className="block font-black text-sm mb-0.5">Transaction Notice:</strong>
                <p className="font-medium">{errorMsg}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleCheckout} className="p-6 overflow-y-auto flex-1 space-y-5 bg-[#FCFAFA]">
          {/* Passenger Information */}
          <div className="bg-white p-5 rounded-2xl border-2 border-red-50 shadow-xs">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#D84E55] mb-4 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#D84E55]" /> Passenger Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primary Passenger Name
                </label>
                <input
                  id="checkout-name-input"
                  type="text"
                  required
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-[#D84E55] focus:ring-2 focus:ring-red-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Gender
                </label>
                <div className="flex gap-2">
                  {(['female', 'male', 'all'] as SeatGender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setPassengerGender(g)}
                      className={`flex-1 py-2.5 text-xs rounded-xl font-black capitalize border-2 transition-all cursor-pointer ${
                        passengerGender === g
                          ? 'bg-[#D84E55] text-white border-[#D84E55] shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-red-200'
                      }`}
                    >
                      {g === 'all' ? 'Other' : g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email (for E-Ticket)
                </label>
                <input
                  id="checkout-email-input"
                  type="email"
                  required
                  value={passengerEmail}
                  onChange={(e) => setPassengerEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-[#D84E55] focus:ring-2 focus:ring-red-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  id="checkout-phone-input"
                  type="tel"
                  required
                  value={passengerPhone}
                  onChange={(e) => setPassengerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:border-[#D84E55] focus:ring-2 focus:ring-red-100 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Boarding & Dropping Point Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border-2 border-red-50 shadow-xs">
              <label className="block text-xs font-black uppercase tracking-wider text-[#D84E55] mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#D84E55]" /> Boarding Stop
              </label>
              <select
                id="checkout-boarding-select"
                value={boardingPointId}
                onChange={(e) => setBoardingPointId(e.target.value)}
                className="w-full p-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-[#D84E55] focus:outline-none cursor-pointer"
              >
                {trip.boardingPoints.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.time} - {bp.name} ({bp.landmark})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white p-4 rounded-2xl border-2 border-red-50 shadow-xs">
              <label className="block text-xs font-black uppercase tracking-wider text-[#D84E55] mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#D84E55]" /> Dropping Stop
              </label>
              <select
                id="checkout-dropping-select"
                value={droppingPointId}
                onChange={(e) => setDroppingPointId(e.target.value)}
                className="w-full p-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-[#D84E55] focus:outline-none cursor-pointer"
              >
                {trip.droppingPoints.map((dp) => (
                  <option key={dp.id} value={dp.id}>
                    {dp.time} - {dp.name} ({dp.landmark})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Gateway & Resilience Section (Red & White Theme) */}
          <div className="bg-white p-5 rounded-2xl border-2 border-red-100 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-[#D84E55] flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#D84E55]" /> Secure Payment Gateway
              </span>

              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="gateway"
                    checked={paymentGateway === 'Razorpay'}
                    onChange={() => setPaymentGateway('Razorpay')}
                    className="accent-[#D84E55]"
                  />
                  <span>Razorpay</span>
                </label>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="gateway"
                    checked={paymentGateway === 'Stripe'}
                    onChange={() => setPaymentGateway('Stripe')}
                    className="accent-[#D84E55]"
                  />
                  <span>Stripe</span>
                </label>
              </div>
            </div>

            {/* Idempotency Key Bar */}
            <div className="flex items-center justify-between bg-red-50/60 p-2.5 rounded-xl border border-red-100 text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <ShieldCheck className="w-4 h-4 text-[#D84E55] shrink-0" />
                <span className="text-slate-500 font-bold whitespace-nowrap">Idempotency Token:</span>
                <code className="text-[#D84E55] font-mono font-bold truncate">{idempotencyKey}</code>
              </div>
              <button
                type="button"
                onClick={regenerateIdempotencyKey}
                title="Regenerate Idempotency Key"
                className="text-slate-400 hover:text-[#D84E55] p-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Saga Failure Injection Checkbox */}
            <div className="pt-2 border-t border-red-50">
              <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer">
                <input
                  id="simulate-db-failure-checkbox"
                  type="checkbox"
                  checked={simulateDbFailure}
                  onChange={(e) => setSimulateDbFailure(e.target.checked)}
                  className="rounded border-red-300 text-[#D84E55] focus:ring-[#D84E55] w-4 h-4"
                />
                <span>
                  <strong>Simulate PostgreSQL Write Timeout</strong> (Test Distributed Saga Compensating Auto-Refund & Lock Release)
                </span>
              </label>
            </div>
          </div>

          {/* Saga Execution Steps Display if completed */}
          {sagaLogs.length > 0 && (
            <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 text-xs font-mono space-y-1.5">
              <div className="text-[#D84E55] font-black mb-2 uppercase tracking-wide">Saga Orchestrator Execution Log:</div>
              {sagaLogs.map((step, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-700 font-semibold">
                    {step.step} ({step.service})
                  </span>
                  <span
                    className={`font-black px-2 py-0.5 rounded-md ${
                      step.status === 'SUCCESS'
                        ? 'bg-red-100 text-[#D84E55]'
                        : step.status === 'COMPENSATED'
                        ? 'bg-slate-100 text-slate-800'
                        : 'bg-red-200 text-red-900'
                    }`}
                  >
                    {step.status} ({step.durationMs}ms)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Fare Summary and Action Button */}
          <div className="pt-4 border-t-2 border-red-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-bold block">Payable Total</span>
              <span className="text-2xl sm:text-3xl font-black text-[#D84E55]">₹{totalFare}</span>
            </div>

            <button
              id="confirm-checkout-btn"
              type="submit"
              disabled={isProcessing}
              className={`px-7 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider text-white flex items-center gap-2 shadow-lg transition-all ${
                isProcessing
                  ? 'bg-slate-400 cursor-wait'
                  : 'bg-[#D84E55] hover:bg-[#b52a31] shadow-red-500/30 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isProcessing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Executing Saga...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Pay ₹{totalFare}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

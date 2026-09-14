import React, { useState, useEffect } from 'react';
import { X, Lock, Check, Clock, AlertCircle, Info, ShieldAlert, Sparkles, User } from 'lucide-react';
import { Seat, DeckType } from '../../backend/types.js';
import { EnrichedBusTrip } from '../types.js';
import { useAuth } from '../context/AuthContext.js';
import { useSocket } from '../context/SocketContext.js';
import { apiUrl } from '../utils/api.js';

interface SeatLayoutModalProps {
  trip: EnrichedBusTrip;
  onClose: () => void;
  onProceedToCheckout: (selectedSeats: Seat[], totalFare: number) => void;
}

export const SeatLayoutModal: React.FC<SeatLayoutModalProps> = ({ trip, onClose, onProceedToCheckout }) => {
  const { userId } = useAuth();
  const { subscribeTrip, unsubscribeTrip, lastEvent, activeLocksMap } = useSocket();

  const [activeDeck, setActiveDeck] = useState<DeckType>('lower');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [lockingSeatId, setLockingSeatId] = useState<string | null>(null);
  const [conflictAlert, setConflictAlert] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(300); // 5 min TTL countdown

  // Subscribe to trip via WebSocket
  useEffect(() => {
    subscribeTrip(trip.id);
    fetchSeats();

    return () => {
      unsubscribeTrip(trip.id);
    };
  }, [trip.id]);

  // Fetch seats from backend API
  const fetchSeats = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/buses/${trip.id}/seats`));
      const data = await res.json();
      if (data.seats) {
        setSeats(data.seats);
      }
    } catch (err) {
      console.error('Failed to load seats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Listen to live WebSocket events for this trip
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'SEAT_LOCKED' && lastEvent.tripId === trip.id) {
      setSeats((prev) =>
        prev.map((s) =>
          s.id === lastEvent.seatId
            ? { ...s, lockedBy: lastEvent.owner, lockedUntil: lastEvent.expiresAt }
            : s
        )
      );

      // If another user locked a seat this client was trying to get
      if (lastEvent.owner !== userId && selectedSeatIds.includes(lastEvent.seatId!)) {
        setSelectedSeatIds((prev) => prev.filter((id) => id !== lastEvent.seatId));
        setConflictAlert(`Race Condition Prevented! Seat ${lastEvent.seatId} was just locked by another passenger via Redis.`);
      }
    } else if (lastEvent.type === 'SEAT_RELEASED' && lastEvent.tripId === trip.id) {
      setSeats((prev) =>
        prev.map((s) =>
          s.id === lastEvent.seatId
            ? { ...s, lockedBy: undefined, lockedUntil: undefined }
            : s
        )
      );
    } else if (lastEvent.type === 'SEATS_BOOKED' && lastEvent.tripId === trip.id) {
      fetchSeats();
    }
  }, [lastEvent, trip.id, userId, selectedSeatIds]);

  // Countdown timer for user's locked seats
  useEffect(() => {
    if (selectedSeatIds.length === 0) return;

    const timer = setInterval(() => {
      setTimeRemainingSec((prev) => {
        if (prev <= 1) {
          // Locks expired!
          setSelectedSeatIds([]);
          setConflictAlert('Your 5-minute seat lock TTL has expired. Seats released back to inventory pool.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedSeatIds]);

  // Handle seat click: Acquire or Release Redis Distributed Lock
  const handleSeatClick = async (seat: Seat) => {
    if (seat.isBooked) return;

    // Check if locked by someone else
    const isLockedByOther = seat.lockedBy && seat.lockedBy !== userId;
    if (isLockedByOther) {
      setConflictAlert(`Seat ${seat.number} is temporarily locked by another user!`);
      return;
    }

    setConflictAlert(null);
    setLockingSeatId(seat.id);

    const isAlreadySelected = selectedSeatIds.includes(seat.id);

    if (isAlreadySelected) {
      // Release lock
      try {
        await fetch(apiUrl('/api/seats/release'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: trip.id,
            seatId: seat.id,
            userId,
          }),
        });
        setSelectedSeatIds((prev) => prev.filter((id) => id !== seat.id));
      } catch (e) {
        console.error('Failed to release lock:', e);
      } finally {
        setLockingSeatId(null);
      }
    } else {
      // Atomic acquire lock via Redis
      try {
        const res = await fetch(apiUrl('/api/seats/lock'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: trip.id,
            seatId: seat.id,
            userId,
            ttlMs: 300000, // 5 min TTL
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setSelectedSeatIds((prev) => [...prev, seat.id]);
          setTimeRemainingSec(300); // reset countdown
        } else {
          // Conflict! Another user got it
          setConflictAlert(data.error || 'Redis Lock Conflict: This seat was just reserved by another user.');
          fetchSeats();
        }
      } catch (err: any) {
        setConflictAlert('Network error attempting Redis lock.');
      } finally {
        setLockingSeatId(null);
      }
    }
  };

  const selectedSeatObjects = seats.filter((s) => selectedSeatIds.includes(s.id));
  const totalFare = selectedSeatObjects.reduce((acc, s) => acc + (s.currentPrice || trip.currentFare), 0);

  const lowerDeckSeats = seats.filter((s) => s.deck === 'lower');
  const upperDeckSeats = seats.filter((s) => s.deck === 'upper');
  const hasUpperDeck = upperDeckSeats.length > 0;
  const currentDeckSeats = activeDeck === 'lower' ? lowerDeckSeats : upperDeckSeats;

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border-2 border-red-100 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col my-auto">
        {/* Modal Header */}
        <div className="bg-[#D84E55] text-white px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
              <h3 className="font-black text-base sm:text-lg">{trip.operatorName}</h3>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white font-mono font-bold">
                {trip.busType}
              </span>
            </div>
            <p className="text-xs text-red-100 mt-0.5 font-medium">
              {trip.sourceCity} → {trip.destinationCity} • Departs {trip.departureTime}
            </p>
          </div>

          <button
            id="close-seat-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Live Concurrency Notification & TTL Banner */}
        {selectedSeatIds.length > 0 && (
          <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#D84E55] font-bold">
              <Lock className="w-4 h-4 text-[#D84E55] animate-bounce" />
              <span>
                <strong>Redis Distributed Lock Active:</strong> {selectedSeatIds.length} seat(s) reserved exclusively for your session.
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono font-black text-[#D84E55] bg-white border border-red-200 px-3 py-1 rounded-lg shadow-2xs">
              <Clock className="w-3.5 h-3.5" />
              <span>TTL: {formatTime(timeRemainingSec)}</span>
            </div>
          </div>
        )}

        {/* Conflict Alert Banner */}
        {conflictAlert && (
          <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 flex items-center justify-between text-xs text-[#D84E55]">
            <div className="flex items-center gap-2 font-bold">
              <ShieldAlert className="w-4 h-4 text-[#D84E55]" />
              <span>{conflictAlert}</span>
            </div>
            <button
              onClick={() => setConflictAlert(null)}
              className="text-[#D84E55] hover:underline font-extrabold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Body Container */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-[#FCFAFA]">
          {/* Deck Switcher & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            {/* Deck Switcher */}
            {hasUpperDeck ? (
              <div className="flex bg-red-50 border border-red-100 p-1 rounded-xl">
                <button
                  id="tab-lower-deck"
                  onClick={() => setActiveDeck('lower')}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    activeDeck === 'lower'
                      ? 'bg-[#D84E55] text-white shadow-sm'
                      : 'text-slate-700 hover:text-[#D84E55]'
                  }`}
                >
                  Lower Deck ({lowerDeckSeats.filter((s) => !s.isBooked).length} Free)
                </button>
                <button
                  id="tab-upper-deck"
                  onClick={() => setActiveDeck('upper')}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    activeDeck === 'upper'
                      ? 'bg-[#D84E55] text-white shadow-sm'
                      : 'text-slate-700 hover:text-[#D84E55]'
                  }`}
                >
                  Upper Deck ({upperDeckSeats.filter((s) => !s.isBooked).length} Free)
                </button>
              </div>
            ) : (
              <div className="text-xs font-extrabold text-[#D84E55] uppercase tracking-wider">
                Executive Seater Configuration
              </div>
            )}

            {/* Visual Legend (Red & White Theme) */}
            <div className="flex items-center gap-3 flex-wrap text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border-2 border-slate-300 bg-white"></div>
                <span className="text-slate-600">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-[#D84E55] text-white flex items-center justify-center text-[9px] font-black">
                  ✓
                </div>
                <span className="text-[#D84E55] font-bold">Selected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-red-200 border border-red-400 animate-pulse text-[#D84E55] flex items-center justify-center text-[9px]">
                  <Lock className="w-2.5 h-2.5" />
                </div>
                <span className="text-slate-600">Locked (Others)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-rose-200 border border-rose-300"></div>
                <span className="text-slate-600">Ladies</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-slate-300 border border-slate-400"></div>
                <span className="text-slate-500">Booked</span>
              </div>
            </div>
          </div>

          {/* Seat Layout Bus Frame */}
          <div className="bg-white border-2 border-red-100 rounded-3xl p-6 relative max-w-xl mx-auto shadow-sm">
            {/* Bus Front Driver Cabin Indicator */}
            <div className="flex items-center justify-between mb-8 pb-3 border-b border-red-100 text-xs text-slate-400 font-bold">
              <span className="uppercase tracking-widest text-[10px] text-[#D84E55]">Front / Driver Cabin</span>
              <div className="w-7 h-7 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-[#D84E55]">
                <span className="font-extrabold text-[10px]">ST</span>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-[#D84E55] font-bold">Loading seat layout...</div>
            ) : (
              /* Seat Grid Rows */
              <div className="space-y-4">
                {Array.from(new Set(currentDeckSeats.map((s) => s.row))).map((rowNum) => {
                  const rowSeats = currentDeckSeats.filter((s) => s.row === rowNum);
                  const isSleeper = rowSeats[0]?.type === 'sleeper';

                  return (
                    <div key={rowNum} className="flex items-center justify-between gap-2">
                      {/* Left Side */}
                      <div className="flex items-center gap-2">
                        {rowSeats
                          .filter((s) => s.col <= 1)
                          .map((seat) => renderSeatButton(seat, isSleeper))}
                      </div>

                      {/* Bus Gangway / Aisle */}
                      <div className="flex-1 text-center">
                        <span className="text-[10px] text-red-200 select-none font-mono font-bold">
                          {rowNum}
                        </span>
                      </div>

                      {/* Right Side */}
                      <div className="flex items-center gap-2">
                        {rowSeats
                          .filter((s) => s.col >= 2)
                          .map((seat) => renderSeatButton(seat, isSleeper))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Checkout Bar */}
        <div className="bg-white border-t-2 border-red-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 font-bold">Selected Seats:</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {selectedSeatIds.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No seats selected yet</span>
              ) : (
                selectedSeatObjects.map((s) => (
                  <span
                    key={s.id}
                    className="text-xs font-black bg-red-50 text-[#D84E55] border border-red-200 px-2.5 py-0.5 rounded-lg shadow-2xs"
                  >
                    {s.number} (₹{s.currentPrice || trip.currentFare})
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-5">
            <div className="text-right">
              <span className="text-xs text-slate-400 font-bold block">Total Fare</span>
              <span className="text-2xl sm:text-3xl font-black text-[#D84E55]">
                ₹{totalFare}
              </span>
            </div>

            <button
              id="proceed-checkout-btn"
              disabled={selectedSeatIds.length === 0}
              onClick={() => onProceedToCheckout(selectedSeatObjects, totalFare)}
              className={`px-6 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-md ${
                selectedSeatIds.length > 0
                  ? 'bg-[#D84E55] hover:bg-[#b52a31] text-white shadow-red-500/30 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Continue to Passenger Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  function renderSeatButton(seat: Seat, isSleeper: boolean) {
    const isSelected = selectedSeatIds.includes(seat.id);
    const isLockedByOther = seat.lockedBy && seat.lockedBy !== userId;
    const isLocking = lockingSeatId === seat.id;

    let bgClass = 'bg-white border-2 border-slate-200 text-slate-700 hover:border-[#D84E55] hover:text-[#D84E55]';

    if (seat.isBooked) {
      bgClass =
        seat.passengerGender === 'female'
          ? 'bg-rose-100 border-rose-300 text-rose-700 cursor-not-allowed'
          : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed';
    } else if (isSelected) {
      bgClass = 'bg-[#D84E55] border-[#D84E55] text-white shadow-md shadow-red-500/30 font-black';
    } else if (isLockedByOther) {
      bgClass = 'bg-red-50 border-red-300 text-[#D84E55] animate-pulse cursor-not-allowed';
    }

    const dims = isSleeper
      ? 'w-20 sm:w-24 h-11' // Sleeper horizontal bed berth
      : 'w-11 sm:w-12 h-11'; // Seater chair

    return (
      <button
        key={seat.id}
        id={`seat-btn-${seat.id}`}
        type="button"
        disabled={seat.isBooked || Boolean(isLockedByOther) || isLocking}
        onClick={() => handleSeatClick(seat)}
        title={
          seat.isBooked
            ? `Booked (${seat.passengerGender || 'General'})`
            : isLockedByOther
            ? `Temporarily locked by another passenger`
            : isSelected
            ? `Selected (Click to release lock)`
            : `Seat ${seat.number} - ₹${seat.currentPrice}`
        }
        className={`${dims} rounded-xl border flex flex-col items-center justify-center p-1 relative transition-all cursor-pointer ${bgClass}`}
      >
        {isLocking ? (
          <span className="w-3 h-3 border-2 border-[#D84E55] border-t-transparent rounded-full animate-spin"></span>
        ) : (
          <>
            <span className="text-[11px] font-black leading-tight">{seat.number}</span>
            <span className="text-[9px] opacity-80 font-mono leading-none font-bold">
              ₹{seat.currentPrice || trip.currentFare}
            </span>

            {/* Status Icons */}
            {isSelected && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white"></span>
            )}
            {isLockedByOther && (
              <Lock className="w-2.5 h-2.5 absolute top-1 right-1 text-[#D84E55]" />
            )}
            {seat.passengerGender === 'female' && seat.isBooked && (
              <span className="text-[8px] absolute bottom-0.5 text-rose-700 font-bold">F</span>
            )}
          </>
        )}
      </button>
    );
  }
};

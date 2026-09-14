import React, { useState, useEffect } from 'react';
import { Ticket, Radio, ArrowRight, QrCode, AlertCircle, Search, Calendar, User, Clock } from 'lucide-react';
import { Booking } from '../../backend/types.js';
import { useAuth } from '../context/AuthContext.js';

interface UserBookingsListProps {
  onViewTicket: (booking: Booking) => void;
  onTrackBus: (tripId: string) => void;
}

export const UserBookingsList: React.FC<UserBookingsListProps> = ({ onViewTicket, onTrackBus }) => {
  const { userId, role } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pnrSearch, setPnrSearch] = useState<string>('');
  const [pnrLookupResult, setPnrLookupResult] = useState<Booking | null>(null);
  const [pnrError, setPnrError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [userId, role]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const url =
        role === 'auditor' || role === 'admin'
          ? '/api/bookings/all'
          : userId
          ? `/api/bookings/user/${userId}`
          : '/api/bookings/user';

      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[UserBookings] Server responded with status: ${res.status}`);
        return;
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('[UserBookings] Expected JSON response, received:', contentType);
        return;
      }
      const data = await res.json();
      if (data && Array.isArray(data.bookings)) {
        setBookings(data.bookings);
      }
    } catch (e) {
      console.error('Failed to load bookings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePnrLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnrSearch.trim()) return;
    setPnrError(null);
    setPnrLookupResult(null);

    try {
      const res = await fetch(`/api/bookings/pnr/${pnrSearch.trim()}`);
      const data = await res.json();
      if (res.ok && data.booking) {
        setPnrLookupResult(data.booking);
      } else {
        setPnrError('No active booking found with that PNR code.');
      }
    } catch (err) {
      setPnrError('Error looking up PNR.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: PNR Rapid Lookup */}
      <div className="bg-white border-2 border-red-50 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#D84E55]" />
            <span>{role === 'auditor' ? 'Financial Audit: All System Bookings' : 'My Trips & E-Boarding Passes'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            View booking status, print boarding passes, track live GPS location, or claim sliding-scale refunds.
          </p>
        </div>

        {/* PNR Quick Search */}
        <form onSubmit={handlePnrLookup} className="flex items-center gap-2 w-full md:w-auto">
          <input
            id="pnr-lookup-input"
            type="text"
            value={pnrSearch}
            onChange={(e) => setPnrSearch(e.target.value.toUpperCase())}
            placeholder="Enter PNR (e.g. RR849201)"
            className="px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-mono font-black uppercase text-slate-900 focus:border-[#D84E55] focus:outline-none w-full md:w-52"
          />
          <button
            id="search-pnr-btn"
            type="submit"
            className="px-5 py-2.5 bg-[#D84E55] hover:bg-[#b52a31] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            Find
          </button>
        </form>
      </div>

      {pnrError && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-xs text-[#D84E55] font-bold">
          {pnrError}
        </div>
      )}

      {pnrLookupResult && (
        <div className="bg-white border-2 border-[#D84E55] rounded-3xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-[#D84E55] tracking-wider">PNR Search Result</span>
            <div className="font-mono font-black text-lg text-slate-900">
              {pnrLookupResult.pnr} - {pnrLookupResult.passengerName}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Seats: {pnrLookupResult.seatNumbers.join(', ')} • Total: ₹{pnrLookupResult.totalAmount}
            </div>
          </div>
          <button
            onClick={() => onViewTicket(pnrLookupResult)}
            className="px-5 py-2.5 bg-[#D84E55] hover:bg-[#b52a31] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-red-500/20 cursor-pointer"
          >
            Open Ticket
          </button>
        </div>
      )}

      {/* Bookings List */}
      {loading ? (
        <div className="py-16 text-center text-[#D84E55] font-bold">Loading bookings history...</div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border-2 border-red-50 shadow-xs">
          <Ticket className="w-12 h-12 text-red-200 mx-auto mb-3" />
          <h3 className="font-black text-base text-slate-800">No Bookings Yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
            Search for an intercity bus route, select your preferred seat, and complete checkout to generate your first E-ticket.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="bg-white border-2 border-red-50 hover:border-red-200 rounded-3xl p-5 shadow-sm hover:shadow-lg transition-all space-y-4"
            >
              <div className="flex items-center justify-between border-b border-red-50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm text-[#D84E55]">
                    {b.pnr}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                      b.status === 'confirmed'
                        ? 'bg-red-50 text-[#D84E55] border border-red-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>

                <span className="text-sm font-black text-[#D84E55]">
                  ₹{b.totalAmount}
                </span>
              </div>

              {/* Route snippet */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Passenger:</span>
                  <span className="font-black text-slate-900">{b.passengerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Reserved Seats:</span>
                  <span className="font-mono font-bold text-[#D84E55]">
                    {b.seatNumbers.join(', ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Boarding Point:</span>
                  <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                    {b.boardingPoint.name} ({b.boardingPoint.time})
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-red-50">
                <button
                  id={`open-ticket-${b.pnr}-btn`}
                  onClick={() => onViewTicket(b)}
                  className="flex-1 py-2.5 px-3 bg-[#D84E55] hover:bg-[#b52a31] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center cursor-pointer shadow-md shadow-red-500/25 hover:scale-[1.02] active:scale-[0.98]"
                >
                  View Boarding Pass
                </button>

                {b.status === 'confirmed' && (
                  <button
                    id={`track-trip-${b.tripId}-btn`}
                    onClick={() => onTrackBus(b.tripId)}
                    title="Live Bus GPS Radar"
                    className="p-2.5 bg-white hover:bg-red-50 border-2 border-red-100 hover:border-red-200 text-[#D84E55] rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Radio className="w-4 h-4 text-[#D84E55] animate-pulse" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

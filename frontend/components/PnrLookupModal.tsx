import React, { useState } from 'react';
import { X, Search, ShieldCheck, Ticket, AlertCircle, ArrowRight } from 'lucide-react';
import { Booking } from '../../backend/types.js';
import { apiUrl } from '../utils/api.js';

interface PnrLookupModalProps {
  onClose: () => void;
  onSelectBooking: (booking: Booking) => void;
}

export const PnrLookupModal: React.FC<PnrLookupModalProps> = ({ onClose, onSelectBooking }) => {
  const [pnrInput, setPnrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const pnr = pnrInput.trim().toUpperCase();
    if (!pnr) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/bookings/pnr/${pnr}`));
      const data = await res.json();

      if (!res.ok || !data.booking) {
        setError(data.error || 'No booking found for this PNR. Please check and try again.');
        return;
      }

      onSelectBooking(data.booking);
      onClose();
    } catch (err: any) {
      setError('Failed to look up PNR. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border-2 border-red-100 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-[#D84E55] rounded-full hover:bg-red-50 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-red-50 border-2 border-red-100 text-[#D84E55] flex items-center justify-center shadow-2xs">
            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">PNR Status & Cancellation</h3>
            <p className="text-xs text-slate-500 font-medium">Verify your bus reservation or check live refund quote</p>
          </div>
        </div>

        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
              Enter Your 8-character PNR Number
            </label>
            <div className="relative flex items-center">
              <Ticket className="w-5 h-5 text-red-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={pnrInput}
                onChange={(e) => setPnrInput(e.target.value.toUpperCase())}
                placeholder="e.g. RR492104"
                maxLength={10}
                className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 focus:border-[#D84E55] rounded-2xl font-mono font-black text-sm tracking-widest text-slate-900 uppercase focus:outline-none shadow-2xs"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Your PNR is sent via SMS/Email upon booking confirmation.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-[#D84E55] font-bold text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !pnrInput.trim()}
              className="px-6 py-2.5 rounded-xl bg-[#D84E55] hover:bg-[#b52a31] text-white text-xs font-black uppercase tracking-wider shadow-md shadow-red-500/25 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Check Status</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

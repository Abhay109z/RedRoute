import React from 'react';
import { Bus, Star, Radio, Wifi, Zap, ArrowRight, TrendingUp, Sparkles, Shield, Compass } from 'lucide-react';
import { EnrichedBusTrip } from '../types.js';

interface BusCardProps {
  trip: EnrichedBusTrip;
  onSelectSeats: (trip: EnrichedBusTrip) => void;
  onTrackBus: (trip: EnrichedBusTrip) => void;
}

export const BusCard: React.FC<BusCardProps> = ({ trip, onSelectSeats, onTrackBus }) => {
  const isSurging = trip.currentFare > trip.baseFare;
  const isDiscounted = trip.currentFare < trip.baseFare;

  return (
    <div className="bg-white border-2 border-red-50 hover:border-red-200 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden mb-4">
      {/* RedBus Header Strip */}
      <div className="bg-red-50/40 px-5 py-3 border-b border-red-100/70 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="font-black text-[#D84E55] text-base tracking-tight">{trip.operatorName}</span>
          <span className="text-red-200">•</span>
          <span className="text-slate-700 font-bold">{trip.busType}</span>
          <span className="font-mono text-[10px] bg-white border border-red-100 text-[#D84E55] px-2 py-0.5 rounded-md font-extrabold shadow-2xs">
            {trip.busNumber}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Primo Certified Badge */}
          {trip.rating >= 4.7 && (
            <span className="flex items-center gap-1 bg-white text-[#D84E55] border border-red-200 px-2.5 py-0.5 rounded-full font-black text-[10px] tracking-wide shadow-2xs">
              <Sparkles className="w-3 h-3 text-[#D84E55] fill-[#D84E55]" /> PRIMO
            </span>
          )}

          {/* Rating Badge (Red & White Pill) */}
          <div className="flex items-center gap-1 bg-[#D84E55] text-white px-2.5 py-1 rounded-lg font-black text-xs shadow-xs">
            <Star className="w-3 h-3 fill-white" />
            <span>{trip.rating.toFixed(1)}</span>
            <span className="text-[10px] text-red-100 font-medium">({trip.reviewCount})</span>
          </div>
        </div>
      </div>

      {/* Main Bus Timeline & Pricing Body */}
      <div className="p-5 sm:p-6 bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
          {/* Departure, Duration, Arrival */}
          <div className="lg:col-span-6 flex items-center justify-between gap-3">
            {/* Departure */}
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mb-1">
                {trip.departureTime}
              </div>
              <div className="text-xs font-black text-[#D84E55]">{trip.sourceCity}</div>
              <div className="text-[11px] text-slate-500 truncate max-w-[130px] sm:max-w-[160px]" title={trip.boardingPoints[0]?.name}>
                {trip.boardingPoints[0]?.name}
              </div>
            </div>

            {/* Travel Duration Graphic */}
            <div className="flex-1 flex flex-col items-center px-2">
              <span className="text-[11px] font-bold text-slate-400 mb-1">{trip.duration}</span>
              <div className="w-full flex items-center relative">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-[#D84E55] bg-white"></div>
                <div className="flex-1 border-t-2 border-dashed border-red-200"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#D84E55]"></div>
              </div>
              <span className="text-[10px] font-bold text-[#D84E55] mt-1">Express Route</span>
            </div>

            {/* Arrival */}
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mb-1">
                {trip.arrivalTime}
              </div>
              <div className="text-xs font-black text-[#D84E55]">{trip.destinationCity}</div>
              <div className="text-[11px] text-slate-500 truncate max-w-[130px] sm:max-w-[160px]" title={trip.droppingPoints[0]?.name}>
                {trip.droppingPoints[0]?.name}
              </div>
            </div>
          </div>

          {/* Amenities & Live Inventory Status */}
          <div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-red-50 pt-3 lg:pt-0 lg:pl-5">
            <div className="mb-2">
              <span
                className={`inline-block text-xs font-black px-2.5 py-1 rounded-full ${
                  trip.availableSeats <= 5
                    ? 'bg-red-50 text-[#D84E55] border border-red-300 animate-pulse'
                    : 'bg-red-50 text-[#D84E55] border border-red-100'
                }`}
              >
                {trip.availableSeats <= 5 ? `Only ${trip.availableSeats} Seats Left!` : `${trip.availableSeats} Seats Available`}
              </span>
            </div>

            {/* Amenities strip with Red highlights */}
            <div className="flex items-center gap-2 text-slate-500 text-xs flex-wrap font-medium">
              <span className="flex items-center gap-1" title="Live GPS Radar">
                <Radio className="w-3.5 h-3.5 text-[#D84E55]" /> GPS
              </span>
              <span className="text-red-200">•</span>
              <span className="flex items-center gap-1" title="USB Charging Port">
                <Zap className="w-3.5 h-3.5 text-[#D84E55]" /> USB
              </span>
              <span className="text-red-200">•</span>
              <span className="flex items-center gap-1" title="High-Speed WiFi">
                <Wifi className="w-3.5 h-3.5 text-[#D84E55]" /> WiFi
              </span>
            </div>
          </div>

          {/* Pricing & Call to Action (Red & White Theme) */}
          <div className="lg:col-span-3 flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 border-t lg:border-t-0 lg:border-l border-red-50 pt-3 lg:pt-0 lg:pl-5">
            <div className="text-left lg:text-right">
              {isSurging && (
                <div className="flex items-center gap-1 text-[11px] font-extrabold text-[#D84E55]">
                  <TrendingUp className="w-3 h-3" />
                  <span>High Demand</span>
                </div>
              )}
              {isDiscounted && (
                <div className="text-[11px] font-extrabold text-[#D84E55]">
                  Special RedRoute Offer
                </div>
              )}

              <div className="flex items-baseline gap-1.5 lg:justify-end">
                {isSurging && (
                  <span className="text-xs line-through text-slate-400 font-semibold">₹{trip.baseFare}</span>
                )}
                <span className="text-2xl sm:text-3xl font-black text-[#D84E55]">
                  ₹{trip.currentFare}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block font-medium">starting from / seat</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id={`track-bus-${trip.id}-btn`}
                type="button"
                onClick={() => onTrackBus(trip)}
                title="View live GPS telemetry and ETA"
                className="p-3 rounded-2xl border-2 border-red-100 hover:border-red-300 bg-white hover:bg-red-50 text-[#D84E55] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Compass className="w-4 h-4 text-[#D84E55]" />
                <span className="hidden sm:inline">Live Radar</span>
              </button>

              <button
                id={`select-seats-${trip.id}-btn`}
                type="button"
                onClick={() => onSelectSeats(trip)}
                className="px-6 py-3 rounded-2xl bg-[#D84E55] hover:bg-[#b52a31] text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-md shadow-red-500/30 hover:shadow-lg hover:shadow-red-500/40 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>View Seats</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

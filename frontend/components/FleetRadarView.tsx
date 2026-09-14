import React, { useState, useEffect } from 'react';
import { Radio, Navigation, Gauge, Clock, MapPin, Compass, Bus, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';
import { EnrichedBusTrip } from '../types.js';
import { apiUrl } from '../utils/api.js';

interface FleetRadarViewProps {
  trips: EnrichedBusTrip[];
  onOpenSeats: (trip: EnrichedBusTrip) => void;
}

export const FleetRadarView: React.FC<FleetRadarViewProps> = ({ trips, onOpenSeats }) => {
  const { subscribeTrip, unsubscribeTrip, lastEvent } = useSocket();
  const [selectedTripId, setSelectedTripId] = useState<string>(trips[0]?.id || 'trip_blr_hyd_101');
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulatingPing, setSimulatingPing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const currentTrip = trips.find((t) => t.id === selectedTripId) || trips[0];

  useEffect(() => {
    if (!selectedTripId) return;
    subscribeTrip(selectedTripId);
    fetchTelemetry(selectedTripId);

    return () => {
      unsubscribeTrip(selectedTripId);
    };
  }, [selectedTripId]);

  const fetchTelemetry = async (tripId: string) => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/gps/${tripId}`));
      const data = await res.json();
      if (!data.error) {
        setTelemetry(data);
      }
    } catch (e) {
      console.error('Failed to fetch GPS telemetry:', e);
    } finally {
      setLoading(false);
    }
  };

  // Real-time WebSocket updates
  useEffect(() => {
    if (lastEvent?.type === 'GPS_TELEMETRY_UPDATE' && lastEvent.tripId === selectedTripId) {
      setTelemetry(lastEvent.telemetry);
    }
  }, [lastEvent, selectedTripId]);

  const handleSimulatePing = async () => {
    if (!telemetry) return;
    setSimulatingPing(true);

    try {
      const newLat = parseFloat((telemetry.lat + 0.006).toFixed(6));
      const newLng = parseFloat((telemetry.lng + 0.006).toFixed(6));
      const newSpeed = Math.floor(68 + Math.random() * 22);

      const res = await fetch(apiUrl('/api/gps/driver-update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: selectedTripId,
          lat: newLat,
          lng: newLng,
          speed: newSpeed,
          bearing: (telemetry.bearing + 15) % 360,
        }),
      });

      const data = await res.json();
      if (data.telemetry) {
        setTelemetry(data.telemetry);
        setStatusMsg(`Live GPS Beacon Broadcasted: Lat ${newLat}, Lng ${newLng} @ ${newSpeed} km/h`);
        setTimeout(() => setStatusMsg(null), 3500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSimulatingPing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Title Strip */}
      <div className="bg-white border-2 border-red-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#D84E55] border border-red-200 flex items-center justify-center shadow-sm">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">RedRoute Live Fleet Radar</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-[#D84E55] border border-red-200 font-bold text-[10px] uppercase tracking-wider">
                Live GPS Highway Feed
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Real-time vehicle telemetry, satellite positioning, speedometers, and estimated highway arrival times
            </p>
          </div>
        </div>

        {/* Bus Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Select Bus:
          </label>
          <select
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            className="w-full md:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#D84E55] cursor-pointer"
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.operatorName} • {t.sourceCity} → {t.destinationCity} ({t.busNumber})
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-[#D84E55] rounded-2xl text-xs font-mono flex items-center gap-2 font-semibold animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-[#D84E55] animate-ping"></span>
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Main Radar Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Telemetry HUD */}
        <div className="lg:col-span-8 space-y-5">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                <Gauge className="w-3.5 h-3.5 text-[#D84E55]" /> Current Speed
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900">
                  {telemetry ? telemetry.speed : 75}
                </span>
                <span className="text-xs text-slate-400 font-semibold">km/h</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-[#D84E55]" /> Next Stop ETA
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-[#D84E55]">
                  {telemetry ? telemetry.etaMinutes : 45}
                </span>
                <span className="text-xs text-slate-400 font-semibold">mins</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                <Compass className="w-3.5 h-3.5 text-[#D84E55]" /> Direction
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900">
                  {telemetry ? `${telemetry.bearing}°` : '15°'}
                </span>
                <span className="text-xs text-slate-400 font-semibold">N/NE</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D84E55]" /> Schedule Status
              </span>
              <span className="text-sm font-black text-[#D84E55] block mt-1 tracking-wide uppercase">
                ON TIME
              </span>
            </div>
          </div>

          {/* Highway Simulation Canvas */}
          <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 relative overflow-hidden shadow-xl">
            {/* Background Radar grid effect */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:16px_16px]"></div>

            <div className="relative z-10 flex items-center justify-between mb-4 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D84E55]" />
                <span className="text-slate-300 font-medium">
                  Current Sector:{' '}
                  <strong className="text-white font-bold">
                    {telemetry?.currentLocationName || 'Highway NH44 Corridor'}
                  </strong>
                </span>
              </div>
              <div className="font-mono text-[11px] text-white/90 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                GPS: {telemetry ? `${telemetry.lat.toFixed(4)}, ${telemetry.lng.toFixed(4)}` : '14.6819, 77.6006'}
              </div>
            </div>

            {/* Visual Highway Corridor */}
            <div className="relative z-10 bg-slate-900/90 rounded-2xl p-6 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-semibold">
                <span>{currentTrip?.sourceCity} (Boarded)</span>
                <span className="text-white flex items-center gap-1.5 font-bold">
                  <Radio className="w-3.5 h-3.5 text-[#D84E55] animate-pulse" /> Approaching {telemetry?.nextStop || 'Toll Plaza'}
                </span>
                <span>{currentTrip?.destinationCity} (Terminal)</span>
              </div>

              {/* Highway track */}
              <div className="relative w-full h-8 bg-slate-950 rounded-full border border-slate-700 flex items-center px-4 overflow-hidden">
                {/* Road dashed center line */}
                <div className="w-full border-t border-dashed border-slate-600"></div>

                {/* Bus marker */}
                <div
                  className="absolute transition-all duration-700 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D84E55] text-white text-xs font-black shadow-lg shadow-red-500/50"
                  style={{ left: '55%' }}
                >
                  <Bus className="w-3.5 h-3.5" />
                  <span>{telemetry?.busNumber || currentTrip?.busNumber}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                <span>Driver: {currentTrip?.driverName || 'Rajesh Patil'}</span>
                <span>Direct Driver Line: {currentTrip?.driverPhone || '+91 98450 12345'}</span>
              </div>
            </div>

            {/* Interactive Driver Beacon Simulation */}
            <div className="relative z-10 mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-400 font-medium text-center sm:text-left">
                Test real-time transit telemetry by transmitting a mock GPS beacon:
              </span>
              <button
                type="button"
                onClick={handleSimulatePing}
                disabled={simulatingPing}
                className="px-4 py-2 bg-[#D84E55] hover:bg-[#c43e45] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-red-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-white ${simulatingPing ? 'animate-spin' : ''}`} />
                <span>Transmit GPS Beacon</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Bus Info & Seat Booking CTA */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#D84E55] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200 inline-block mb-3">
              Active Vehicle Overview
            </span>

            <h3 className="text-lg font-black text-slate-900">
              {currentTrip?.operatorName}
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">{currentTrip?.busType}</p>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Route:</span>
                <span className="font-bold text-slate-900">
                  {currentTrip?.sourceCity} → {currentTrip?.destinationCity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Departure:</span>
                <span className="font-bold text-slate-900">{currentTrip?.departureTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Arrival:</span>
                <span className="font-bold text-slate-900">{currentTrip?.arrivalTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Seats Available:</span>
                <span className="font-extrabold text-[#D84E55]">
                  {currentTrip?.availableSeats} Seats
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Fare:</span>
                <span className="font-black text-lg text-slate-900">
                  ₹{currentTrip?.currentFare}
                </span>
              </div>
            </div>

            {currentTrip && (
              <button
                type="button"
                onClick={() => onOpenSeats(currentTrip)}
                className="mt-6 w-full py-3 bg-[#D84E55] hover:bg-[#c43e45] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-red-500/25 transition-all cursor-pointer"
              >
                Select Seats on this Bus
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

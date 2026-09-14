import React, { useState, useEffect } from 'react';
import { X, Radio, Navigation, Gauge, Clock, MapPin, Compass, Send, ShieldCheck, Bus } from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';
import { GpsTelemetry } from '../../backend/services/gpsTrackingService.js';
import { apiUrl } from '../utils/api.js';

interface LiveTrackingModalProps {
  tripId: string;
  onClose: () => void;
}

export const LiveTrackingModal: React.FC<LiveTrackingModalProps> = ({ tripId, onClose }) => {
  const { subscribeTrip, unsubscribeTrip, lastEvent } = useSocket();
  const [telemetry, setTelemetry] = useState<GpsTelemetry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulatingPing, setSimulatingPing] = useState<boolean>(false);
  const [pingStatusMsg, setPingStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    subscribeTrip(tripId);
    fetchTelemetry();

    return () => {
      unsubscribeTrip(tripId);
    };
  }, [tripId]);

  const fetchTelemetry = async () => {
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

  // Listen for live WebSocket GPS updates
  useEffect(() => {
    if (lastEvent?.type === 'GPS_TELEMETRY_UPDATE' && lastEvent.tripId === tripId) {
      setTelemetry(lastEvent.telemetry);
    }
  }, [lastEvent, tripId]);

  // Simulate driver GPS update ping
  const handleDriverGpsPing = async () => {
    if (!telemetry) return;
    setSimulatingPing(true);

    try {
      // Advance coordinates slightly
      const newLat = parseFloat((telemetry.lat + 0.005).toFixed(6));
      const newLng = parseFloat((telemetry.lng + 0.005).toFixed(6));
      const newSpeed = Math.floor(70 + Math.random() * 20);

      const res = await fetch(apiUrl('/api/gps/driver-update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          lat: newLat,
          lng: newLng,
          speed: newSpeed,
          bearing: (telemetry.bearing + 10) % 360,
        }),
      });
      const data = await res.json();
      if (data.telemetry) {
        setTelemetry(data.telemetry);
        setPingStatusMsg(`Driver beacon ingested: Redis GEOADD bus_fleet ${data.telemetry.busNumber} ${newLat}, ${newLng} | Broadcast to clients.`);
        setTimeout(() => setPingStatusMsg(null), 4000);
      }
    } catch (e) {
      console.error('Ping failed:', e);
    } finally {
      setSimulatingPing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border-2 border-red-100 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col text-slate-900 my-auto">
        {/* Header */}
        <div className="bg-[#D84E55] px-6 py-4 flex items-center justify-between text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-xs">
              <Radio className="w-5 h-5 text-[#D84E55] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">Live Bus GPS Radar & ETA Engine</h3>
                <span className="text-[10px] bg-white text-[#D84E55] font-black px-2 py-0.5 rounded-full font-mono shadow-xs">
                  Redis Geo Active
                </span>
              </div>
              <p className="text-xs text-white/85 font-medium">
                {telemetry ? `${telemetry.operatorName} (${telemetry.busNumber})` : 'Telemetry Synchronizing...'}
              </p>
            </div>
          </div>

          <button
            id="close-gps-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white text-white hover:text-[#D84E55] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status Toast */}
        {pingStatusMsg && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 text-xs font-mono text-[#D84E55] flex items-center gap-2 font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#D84E55] animate-ping"></span>
            <span>{pingStatusMsg}</span>
          </div>
        )}

        {/* Main Body */}
        <div className="p-6 overflow-y-auto space-y-5 bg-white">
          {loading && !telemetry ? (
            <div className="py-16 text-center text-slate-400 font-medium">Connecting to Redis Geo tracker...</div>
          ) : telemetry ? (
            <>
              {/* Telemetry Metrics HUD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-red-100 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mb-1">
                    <Gauge className="w-3.5 h-3.5 text-[#D84E55]" /> Current Speed
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">{telemetry.speed}</span>
                    <span className="text-xs text-slate-400 font-semibold">km/h</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-red-100 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mb-1">
                    <Clock className="w-3.5 h-3.5 text-[#D84E55]" /> Next Stop ETA
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-[#D84E55]">{telemetry.etaMinutes}</span>
                    <span className="text-xs text-slate-400 font-semibold">mins</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-red-100 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mb-1">
                    <Compass className="w-3.5 h-3.5 text-[#D84E55]" /> Bearing & Heading
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">{telemetry.bearing}°</span>
                    <span className="text-xs text-slate-400 font-semibold">N/NE</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-red-100 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#D84E55]" /> Route Status
                  </span>
                  <div className="text-sm font-black text-[#D84E55] mt-1 uppercase tracking-wide">
                    ON SCHEDULE
                  </div>
                </div>
              </div>

              {/* Highway Radar View (SVG Simulation) */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 relative overflow-hidden text-white">
                <div className="flex items-center justify-between mb-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#D84E55]" />
                    <span>Location: <strong className="text-white">{telemetry.currentLocationName}</strong></span>
                  </div>
                  <div className="font-mono text-[11px] text-white/80">
                    Lat: {telemetry.lat.toFixed(4)}, Lng: {telemetry.lng.toFixed(4)}
                  </div>
                </div>

                {/* Simulated Radar Visual */}
                <div className="h-44 sm:h-52 w-full bg-slate-900 rounded-xl border border-slate-800 relative flex items-center justify-center overflow-hidden">
                  {/* Radar concentric circles */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
                    <div className="w-24 h-24 rounded-full border border-red-500 animate-ping"></div>
                    <div className="w-48 h-48 rounded-full border border-slate-600 absolute"></div>
                    <div className="w-72 h-72 rounded-full border border-slate-700 absolute"></div>
                  </div>

                  {/* Curving Highway Line */}
                  <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none">
                    <path
                      d="M 20,160 Q 150,40 380,80"
                      fill="none"
                      stroke="#334155"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 20,160 Q 150,40 380,80"
                      fill="none"
                      stroke="#D84E55"
                      strokeWidth="3"
                      strokeDasharray="6 6"
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Stops on Highway */}
                  <div className="absolute left-8 bottom-6 flex items-center gap-1.5 text-[10px] text-slate-300 font-semibold">
                    <div className="w-3 h-3 rounded-full bg-[#D84E55] border-2 border-white"></div>
                    <span>Boarding Hub</span>
                  </div>

                  <div className="absolute right-8 top-10 flex items-center gap-1.5 text-[10px] text-slate-300 font-semibold">
                    <div className="w-3 h-3 rounded-full bg-white border-2 border-[#D84E55]"></div>
                    <span>Destination Terminal</span>
                  </div>

                  {/* Live Moving Bus Marker */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-[#D84E55] text-white flex items-center justify-center shadow-lg shadow-red-600/50 border-2 border-white animate-bounce">
                        <Bus className="w-6 h-6" />
                      </div>
                      <span className="w-3 h-3 rounded-full bg-white absolute -top-1 -right-1 border-2 border-[#D84E55] animate-ping"></span>
                    </div>

                    <div className="mt-2 bg-white/95 text-slate-900 px-3 py-1 rounded-lg border border-red-200 text-center shadow-md">
                      <span className="text-xs font-black text-slate-900">{telemetry.busNumber}</span>
                      <span className="text-[10px] text-[#D84E55] block font-mono font-bold">
                        {telemetry.speed} km/h • LIVE
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span>Next Stop: <strong className="text-white">{telemetry.nextStopName}</strong></span>
                    <span>280 km of 560 km covered (50%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-[#D84E55] h-full w-1/2 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Driver Mobile App GPS Simulation Control */}
              <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block mb-0.5">
                    Driver Mobile App GPS Broadcast Simulator
                  </span>
                  <p className="text-xs text-slate-500">
                    Emulates the on-board driver Android app transmitting live telemetry over WebSockets to the Go/Node GPS Hub.
                  </p>
                </div>

                <button
                  id="simulate-driver-gps-btn"
                  disabled={simulatingPing}
                  onClick={handleDriverGpsPing}
                  className="px-5 py-2.5 bg-[#D84E55] hover:bg-[#c43e45] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-red-500/25 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{simulatingPing ? 'Transmitting...' : 'Simulate Driver GPS Ping'}</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

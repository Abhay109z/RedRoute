import React, { useState, useEffect } from 'react';
import { Bus, Users, TrendingUp, DollarSign, Clock, Settings, Edit3, CheckCircle2, ShieldAlert } from 'lucide-react';
import { EnrichedBusTrip } from '../types.js';
import { apiUrl } from '../utils/api.js';

interface OperatorFleetData {
  metrics: {
    totalFleetBuses: number;
    activeOnRoute: number;
    totalRevenue: number;
    totalPassengers: number;
    averageOccupancy: number;
  };
  buses: EnrichedBusTrip[];
}

export const OperatorPortal: React.FC = () => {
  const [data, setData] = useState<OperatorFleetData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingTrip, setEditingTrip] = useState<EnrichedBusTrip | null>(null);
  const [editFare, setEditFare] = useState<number>(1000);
  const [editTime, setEditTime] = useState<string>('21:00');
  const [editDriverName, setEditDriverName] = useState<string>('');
  const [editDriverPhone, setEditDriverPhone] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchFleetData();
  }, []);

  const fetchFleetData = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/operator/fleet'));
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Failed to load fleet data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (trip: EnrichedBusTrip) => {
    setEditingTrip(trip);
    setEditFare(trip.baseFare);
    setEditTime(trip.departureTime);
    setEditDriverName(trip.driverName);
    setEditDriverPhone(trip.driverPhone);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrip) return;
    setIsSaving(true);

    try {
      const res = await fetch(apiUrl(`/api/operator/buses/${editingTrip.id}/schedule`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departureTime: editTime,
          baseFare: editFare,
          driverName: editDriverName,
          driverPhone: editDriverPhone,
        }),
      });

      if (res.ok) {
        setSuccessMsg(`Bus ${editingTrip.busNumber} schedule & tariff updated successfully!`);
        setTimeout(() => setSuccessMsg(null), 3500);
        setEditingTrip(null);
        fetchFleetData();
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-slate-400">
        Loading Multi-Tenant Operator Fleet Portal...
      </div>
    );
  }

  const { metrics, buses } = data || {
    metrics: { totalFleetBuses: 0, activeOnRoute: 0, totalRevenue: 0, totalPassengers: 0, averageOccupancy: 0 },
    buses: [],
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <h2 className="text-xl font-black">Multi-Tenant Fleet Dispatcher Console</h2>
            <span className="text-[10px] bg-red-600/30 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-mono">
              RBAC: Operator Access
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time fleet scheduling, driver telemetry assignments, dynamic tariff control, and revenue analytics.
          </p>
        </div>

        <button
          onClick={fetchFleetData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl border border-slate-700 transition-colors self-start md:self-auto"
        >
          Refresh Live Fleet
        </button>
      </div>

      {successMsg && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs text-[#D84E55] font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#D84E55]" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-xs">
          <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
            <Bus className="w-3.5 h-3.5 text-[#D84E55]" /> Total Fleet
          </span>
          <span className="text-2xl font-black text-slate-900">{metrics.totalFleetBuses}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Commercial buses</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-xs">
          <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-[#D84E55]" /> Active On-Route
          </span>
          <span className="text-2xl font-black text-[#D84E55]">{metrics.activeOnRoute}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Live GPS tracking</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-xs">
          <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-[#D84E55]" /> Gross Revenue
          </span>
          <span className="text-2xl font-black text-slate-900">₹{metrics.totalRevenue}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">ACID settled</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-xs">
          <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-[#D84E55]" /> Passengers
          </span>
          <span className="text-2xl font-black text-slate-900">{metrics.totalPassengers}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Booked seats</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-xs col-span-2 lg:col-span-1">
          <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#D84E55]" /> Avg Occupancy
          </span>
          <span className="text-2xl font-black text-[#D84E55]">{metrics.averageOccupancy}%</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Load factor</span>
        </div>
      </div>

      {/* Fleet Vehicles Table */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-red-50 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900">Active Vehicle Fleet</h3>
          <span className="text-xs text-slate-400 font-medium">Live Telemetry & Schedules</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-red-50/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-red-100">
              <tr>
                <th className="px-5 py-3 font-bold">Bus & Operator</th>
                <th className="px-5 py-3 font-bold">Route</th>
                <th className="px-5 py-3 font-bold">Departure</th>
                <th className="px-5 py-3 font-bold">Occupancy</th>
                <th className="px-5 py-3 font-bold">Driver Assigned</th>
                <th className="px-5 py-3 font-bold">Tariff</th>
                <th className="px-5 py-3 font-bold">Revenue</th>
                <th className="px-5 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-50">
              {buses.map((b) => (
                <tr key={b.id} className="hover:bg-red-50/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-slate-900">{b.operatorName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{b.busNumber} • {b.busType}</div>
                  </td>

                  <td className="px-5 py-3.5">
                    <span className="font-semibold">{b.sourceCity} → {b.destinationCity}</span>
                  </td>

                  <td className="px-5 py-3.5 font-mono font-bold">
                    {b.departureTime}
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#D84E55] h-full"
                          style={{ width: `${b.occupancyRate || 30}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-slate-900">{b.occupancyRate || 0}%</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{b.bookedSeatsCount || 0} / {b.totalSeats} seats</span>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-900">{b.driverName}</div>
                    <div className="text-[10px] text-slate-400">{b.driverPhone}</div>
                  </td>

                  <td className="px-5 py-3.5 font-bold text-slate-900">
                    ₹{b.baseFare}
                  </td>

                  <td className="px-5 py-3.5 font-bold text-[#D84E55]">
                    ₹{b.tripRevenue || 0}
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <button
                      id={`edit-schedule-${b.id}-btn`}
                      onClick={() => handleOpenEdit(b)}
                      className="px-3 py-1.5 bg-white hover:bg-red-50 text-slate-700 hover:text-[#D84E55] border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Configure</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingTrip && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
              Configure Bus Schedule & Tariff
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {editingTrip.operatorName} • {editingTrip.busNumber}
            </p>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Departure Time (24-hour)
                </label>
                <input
                  type="text"
                  required
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  placeholder="e.g. 21:30"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Base Fare (₹)
                </label>
                <input
                  type="number"
                  required
                  min="200"
                  max="10000"
                  value={editFare}
                  onChange={(e) => setEditFare(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Driver Name
                </label>
                <input
                  type="text"
                  required
                  value={editDriverName}
                  onChange={(e) => setEditDriverName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Driver Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={editDriverPhone}
                  onChange={(e) => setEditDriverPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTrip(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '../frontend/context/AuthContext.js';
import { SocketProvider, useSocket } from '../frontend/context/SocketContext.js';
import { Navbar } from '../frontend/components/Navbar.js';
import { RouteSearch } from '../frontend/components/RouteSearch.js';
import { BusCard } from '../frontend/components/BusCard.js';
import { SeatLayoutModal } from '../frontend/components/SeatLayoutModal.js';
import { CheckoutModal } from '../frontend/components/CheckoutModal.js';
import { TicketModal } from '../frontend/components/TicketModal.js';
import { LiveTrackingModal } from '../frontend/components/LiveTrackingModal.js';
import { OperatorPortal } from '../frontend/components/OperatorPortal.js';
import { ArchitectureLab } from '../frontend/components/ArchitectureLab.js';
import { UserBookingsList } from '../frontend/components/UserBookingsList.js';
import { FleetRadarView } from '../frontend/components/FleetRadarView.js';
import { PnrLookupModal } from '../frontend/components/PnrLookupModal.js';
import { EnrichedBusTrip } from '../frontend/types.js';
import { Seat, Booking } from '../backend/types.js';
import { Bus, ShieldAlert, Sparkles, CheckCircle2, Radio, Server, Layers, Cpu, ShieldCheck, Database, Phone, Mail } from 'lucide-react';

function RedRouteAppContent() {
  const { role } = useAuth();
  const { isConnected, lastEvent } = useSocket();

  const [activeTab, setActiveTab] = useState<'routes' | 'bookings' | 'operator' | 'architecture' | 'radar'>('routes');

  // Search state
  const [source, setSource] = useState('Bangalore');
  const [destination, setDestination] = useState('Hyderabad');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Trips data
  const [trips, setTrips] = useState<EnrichedBusTrip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  // Modals state
  const [seatModalTrip, setSeatModalTrip] = useState<EnrichedBusTrip | null>(null);
  const [checkoutData, setCheckoutData] = useState<{
    trip: EnrichedBusTrip;
    seats: Seat[];
    totalFare: number;
  } | null>(null);
  const [ticketModalBooking, setTicketModalBooking] = useState<Booking | null>(null);
  const [trackingTripId, setTrackingTripId] = useState<string | null>(null);
  const [showPnrModal, setShowPnrModal] = useState(false);

  // MongoDB status
  const [mongoInfo, setMongoInfo] = useState<{ connected: boolean; database: string | null; error: string | null } | null>(null);

  // Discreet bottom floating toast notification
  const [liveToast, setLiveToast] = useState<string | null>(null);

  // Fetch trips on search or mount
  useEffect(() => {
    fetchTrips();
    fetchMongoStatus();
  }, [source, destination, date]);

  // Fetch MongoDB status
  const fetchMongoStatus = async () => {
    try {
      const res = await fetch('/api/mongodb/status');
      const data = await res.json();
      setMongoInfo(data);
    } catch (e) {
      console.warn('Could not fetch mongo status:', e);
    }
  };

  // Listen for real-time WebSocket inventory and trip changes
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'SEAT_LOCKED') {
      setLiveToast(`Seat ${lastEvent.seatId} locked on trip ${lastEvent.tripId.slice(-6)}`);
      setTimeout(() => setLiveToast(null), 3500);
    } else if (lastEvent.type === 'SEATS_BOOKED') {
      setLiveToast(`Seats confirmed on trip ${lastEvent.tripId.slice(-6)}`);
      setTimeout(() => setLiveToast(null), 4000);
      fetchTrips();
    } else if (lastEvent.type === 'SEATS_RELEASED') {
      fetchTrips();
    }
  }, [lastEvent]);

  const fetchTrips = async () => {
    try {
      setLoadingTrips(true);
      const params = new URLSearchParams();
      if (source) params.append('source', source);
      if (destination) params.append('destination', destination);
      if (date) params.append('date', date);

      const res = await fetch(`/api/routes/search?${params.toString()}`);
      const data = await res.json();
      if (data.trips) {
        setTrips(data.trips);
      }
    } catch (e) {
      console.error('Error fetching trips:', e);
    } finally {
      setLoadingTrips(false);
    }
  };

  // Filter trips client-side
  const filteredTrips = trips.filter((t) => {
    if (selectedFilter === 'sleeper') return t.busType.toLowerCase().includes('sleeper');
    if (selectedFilter === 'volvo') return t.busType.toLowerCase().includes('volvo') || t.operatorName.toLowerCase().includes('volvo');
    if (selectedFilter === 'electric') return t.busType.toLowerCase().includes('electric') || t.operatorName.toLowerCase().includes('electric');
    if (selectedFilter === 'budget') return t.currentFare <= 1000;
    if (selectedFilter === 'rated') return t.rating >= 4.8;
    return true;
  });

  // Modal transitions
  const handleOpenSeats = (trip: EnrichedBusTrip) => {
    setSeatModalTrip(trip);
  };

  const handleProceedToCheckout = (selectedSeats: Seat[], totalFare: number) => {
    if (!seatModalTrip) return;
    const currentTrip = seatModalTrip;
    setSeatModalTrip(null);
    setCheckoutData({
      trip: currentTrip,
      seats: selectedSeats,
      totalFare,
    });
  };

  const handleBookingSuccess = (booking: Booking) => {
    setCheckoutData(null);
    setTicketModalBooking(booking);
    fetchTrips();
  };

  const handleOpenLiveTracking = (tripOrTripId: EnrichedBusTrip | string) => {
    const tripId = typeof tripOrTripId === 'string' ? tripOrTripId : tripOrTripId.id;
    setTrackingTripId(tripId);
  };

  return (
    <div className="min-h-screen bg-[#FDFBFB] text-slate-900 flex flex-col font-sans">
      {/* Authentic Clean Red & White Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPnrLookup={() => setShowPnrModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* VIEW 1: BOOK BUSES / ROUTE SEARCH (RED BUS DEFAULT) */}
        {activeTab === 'routes' && (
          <div>
            {/* Authentic Red & White Hero & Connected Search Bar */}
            <RouteSearch
              source={source}
              setSource={setSource}
              destination={destination}
              setDestination={setDestination}
              date={date}
              setDate={setDate}
              selectedFilter={selectedFilter}
              setSelectedFilter={setSelectedFilter}
              onSearch={fetchTrips}
              totalTripsCount={filteredTrips.length}
            />

            {/* Bus Results List */}
            {loadingTrips ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-[#D84E55] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-[#D84E55] font-bold uppercase tracking-wider">
                  Loading RedRoute Verified Routes & Seat Maps...
                </p>
              </div>
            ) : filteredTrips.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-red-100 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-red-50 text-[#D84E55] flex items-center justify-center mx-auto mb-3">
                  <Bus className="w-8 h-8" />
                </div>
                <h3 className="font-black text-lg text-slate-900">No Buses Found for this Route</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Try searching for popular routes like Bangalore → Hyderabad, Mumbai → Goa, or Delhi → Manali.
                </p>
                <button
                  onClick={() => {
                    setSource('Bangalore');
                    setDestination('Hyderabad');
                    setSelectedFilter('all');
                  }}
                  className="mt-4 px-6 py-2.5 bg-[#D84E55] hover:bg-[#c43e45] text-white rounded-xl text-xs font-bold shadow-md shadow-red-500/25 cursor-pointer transition-colors"
                >
                  Reset to Bangalore → Hyderabad
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3 text-xs text-slate-600 font-semibold px-1">
                  <span>Showing <strong className="text-[#D84E55] font-black">{filteredTrips.length}</strong> available buses with instant seat maps</span>
                  <span>Sort by: <strong className="text-slate-800">Relevance & Best Value</strong></span>
                </div>

                <div className="space-y-4">
                  {filteredTrips.map((trip) => (
                    <BusCard
                      key={trip.id}
                      trip={trip}
                      onSelectSeats={handleOpenSeats}
                      onTrackBus={handleOpenLiveTracking}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: LIVE FLEET RADAR */}
        {activeTab === 'radar' && (
          <FleetRadarView
            trips={trips}
            onOpenSeats={handleOpenSeats}
          />
        )}

        {/* VIEW 3: MY BOOKINGS & PASSES */}
        {activeTab === 'bookings' && (
          <UserBookingsList
            onViewTicket={(b) => setTicketModalBooking(b)}
            onTrackBus={(tripId) => setTrackingTripId(tripId)}
          />
        )}

        {/* VIEW 4: OPERATOR DISPATCHER PORTAL */}
        {activeTab === 'operator' && <OperatorPortal />}

        {/* VIEW 5: ARCHITECTURE & CONCURRENCY LAB */}
        {activeTab === 'architecture' && <ArchitectureLab />}
      </main>

      {/* Floating Real-Time Toast Notification (Red & White) */}
      {liveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#D84E55] text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-2xl shadow-red-500/40 border border-red-400/40 flex items-center gap-2.5 animate-fadeIn">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
          <span>{liveToast}</span>
        </div>
      )}

      {/* Red & White Footer */}
      <footer className="bg-[#D84E55] text-white pt-12 pb-10 text-xs mt-14 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 pb-8 border-b border-white/20">
            {/* Column 1: Brand & Support */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#D84E55] shadow-md">
                  <Bus className="w-5 h-5" />
                </div>
                <span className="text-2xl font-black text-white">Red<span className="text-white/90 font-light">Route</span></span>
              </div>
              <p className="text-[11px] text-white/85 leading-relaxed">
                RedRoute is the high-concurrency online bus ticket booking service trusted by millions of happy travelers across India.
              </p>
              <div className="pt-2 text-[11px] space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Phone className="w-3.5 h-3.5 text-white" />
                  <span>24x7 Customer Care: 1800-419-4287</span>
                </div>
                <div className="flex items-center gap-2 text-white/90">
                  <Mail className="w-3.5 h-3.5 text-white" />
                  <span>support@redroute.in</span>
                </div>
              </div>
            </div>

            {/* Column 2: Popular Bus Routes */}
            <div>
              <h4 className="font-black text-white text-xs uppercase tracking-wider mb-3">
                Top Bus Routes
              </h4>
              <ul className="space-y-1.5 text-[11px] text-white/85">
                <li>
                  <button onClick={() => { setSource('Bangalore'); setDestination('Hyderabad'); setActiveTab('routes'); }} className="hover:text-white hover:underline transition-colors cursor-pointer font-medium">
                    Bangalore to Hyderabad Bus
                  </button>
                </li>
                <li>
                  <button onClick={() => { setSource('Mumbai'); setDestination('Goa'); setActiveTab('routes'); }} className="hover:text-white hover:underline transition-colors cursor-pointer font-medium">
                    Mumbai to Goa Bus
                  </button>
                </li>
                <li>
                  <button onClick={() => { setSource('Delhi'); setDestination('Manali'); setActiveTab('routes'); }} className="hover:text-white hover:underline transition-colors cursor-pointer font-medium">
                    Delhi to Manali Bus
                  </button>
                </li>
                <li>
                  <button onClick={() => { setSource('Pune'); setDestination('Mumbai'); setActiveTab('routes'); }} className="hover:text-white hover:underline transition-colors cursor-pointer font-medium">
                    Pune to Mumbai Bus
                  </button>
                </li>
                <li>
                  <button onClick={() => { setSource('Chennai'); setDestination('Bangalore'); setActiveTab('routes'); }} className="hover:text-white hover:underline transition-colors cursor-pointer font-medium">
                    Chennai to Bangalore Bus
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Top Bus Operators */}
            <div>
              <h4 className="font-black text-white text-xs uppercase tracking-wider mb-3">
                Top Operators
              </h4>
              <ul className="space-y-1.5 text-[11px] text-white/85">
                <li className="font-medium hover:text-white cursor-pointer hover:underline">Orange Travels Gold Class</li>
                <li className="font-medium hover:text-white cursor-pointer hover:underline">VRL Logistics Luxury</li>
                <li className="font-medium hover:text-white cursor-pointer hover:underline">SRS Travels Volvo Multi-Axle</li>
                <li className="font-medium hover:text-white cursor-pointer hover:underline">Zingbus Electric Express</li>
                <li className="font-medium hover:text-white cursor-pointer hover:underline">IntrCity SmartBus Primo</li>
              </ul>
            </div>

            {/* Column 4: Quick Portals & DB State */}
            <div>
              <h4 className="font-black text-white text-xs uppercase tracking-wider mb-3">
                Quick Access
              </h4>
              <div className="space-y-2 text-[11px]">
                <button
                  onClick={() => setShowPnrModal(true)}
                  className="block text-white font-bold hover:underline cursor-pointer transition-colors"
                >
                  → Check PNR Status & Cancellation
                </button>
                <button
                  onClick={() => setActiveTab('radar')}
                  className="block text-white font-bold hover:underline cursor-pointer transition-colors"
                >
                  → Live GPS Highway Radar
                </button>
                <button
                  onClick={() => setActiveTab('operator')}
                  className="block text-white font-bold hover:underline cursor-pointer transition-colors"
                >
                  → Fleet Operator Dispatcher
                </button>
                <button
                  onClick={() => setActiveTab('architecture')}
                  className="block text-white font-bold hover:underline cursor-pointer transition-colors"
                >
                  → Stress Test & Concurrency Lab
                </button>

                {/* MongoDB Status Pill */}
                <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                    <Database className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-[10px] text-white/90 font-medium">
                    Database: {mongoInfo?.connected ? 'Atlas Cluster Online' : 'Active (Local Data Engine)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/80">
            <div>
              © 2026 RedRoute India. All rights reserved. Red & White edition.
            </div>
            <div className="flex items-center gap-3 font-semibold">
              <span className="hover:text-white cursor-pointer">Privacy Policy</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer">Terms of Service</span>
              <span>•</span>
              <span className="bg-white text-[#D84E55] px-2 py-0.5 rounded-md font-mono text-[10px] font-black">
                WS: {isConnected ? 'Online' : 'Connecting'}
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Seat Layout Modal */}
      {seatModalTrip && (
        <SeatLayoutModal
          trip={seatModalTrip}
          onClose={() => setSeatModalTrip(null)}
          onProceedToCheckout={handleProceedToCheckout}
        />
      )}

      {/* 2. Checkout & Payment Modal */}
      {checkoutData && (
        <CheckoutModal
          trip={checkoutData.trip}
          selectedSeats={checkoutData.seats}
          totalFare={checkoutData.totalFare}
          onClose={() => setCheckoutData(null)}
          onBookingSuccess={handleBookingSuccess}
        />
      )}

      {/* 3. Confirmed Ticket / Boarding Pass Modal */}
      {ticketModalBooking && (
        <TicketModal
          booking={ticketModalBooking}
          onClose={() => setTicketModalBooking(null)}
          onTrackBus={(tripId) => {
            setTicketModalBooking(null);
            setTrackingTripId(tripId);
          }}
          onBookingCancelled={fetchTrips}
        />
      )}

      {/* 4. Live GPS Radar Tracking Modal */}
      {trackingTripId && (
        <LiveTrackingModal
          tripId={trackingTripId}
          onClose={() => setTrackingTripId(null)}
        />
      )}

      {/* 5. PNR Status & Cancellation Lookup Modal */}
      {showPnrModal && (
        <PnrLookupModal
          onClose={() => setShowPnrModal(false)}
          onSelectBooking={(b) => setTicketModalBooking(b)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <RedRouteAppContent />
      </SocketProvider>
    </AuthProvider>
  );
}

import React from 'react';
import { Search, ArrowRightLeft, Calendar, MapPin, Filter, Sparkles, Shield, RotateCcw, Clock, Award } from 'lucide-react';

interface RouteSearchProps {
  source: string;
  setSource: (val: string) => void;
  destination: string;
  setDestination: (val: string) => void;
  date: string;
  setDate: (val: string) => void;
  selectedFilter: string;
  setSelectedFilter: (val: string) => void;
  onSearch: () => void;
  totalTripsCount: number;
}

export const RouteSearch: React.FC<RouteSearchProps> = ({
  source,
  setSource,
  destination,
  setDestination,
  date,
  setDate,
  selectedFilter,
  setSelectedFilter,
  onSearch,
  totalTripsCount,
}) => {
  const handleSwap = () => {
    const temp = source;
    setSource(destination);
    setDestination(temp);
  };

  const setDateToday = () => {
    setDate(new Date().toISOString().split('T')[0]);
  };

  const setDateTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="mb-8">
      {/* RedBus Hero Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#D84E55] via-[#cc3c43] to-[#b3262d] text-white p-6 sm:p-10 shadow-xl overflow-hidden mb-6">
        {/* Subtle decorative background circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5 pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center mb-6 sm:mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-xs mb-3">
            <Award className="w-3.5 h-3.5 text-white" /> India's No. 1 Online Bus Booking Platform
          </span>
          <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-black tracking-tight leading-tight">
            Book Bus Tickets Online
          </h1>
          <p className="text-red-100 text-xs sm:text-sm mt-1 max-w-xl mx-auto font-medium">
            Over 36 Million Happy Travelers • Zero Booking Fees • Guaranteed Instant Refunds
          </p>
        </div>

        {/* Connected Search Container (Authentic RedBus Search Bar) */}
        <div className="relative z-10 max-w-5xl mx-auto bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xl border border-red-100 text-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3 items-center">
            {/* From City */}
            <div className="md:col-span-4 relative group">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 ml-1">
                From City
              </label>
              <div className="relative flex items-center bg-white rounded-2xl border-2 border-red-50 hover:border-red-300 focus-within:border-[#D84E55] transition-all shadow-xs">
                <MapPin className="w-5 h-5 text-[#D84E55] absolute left-3.5 pointer-events-none" />
                <input
                  id="search-source-input"
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Enter source city"
                  className="w-full pl-11 pr-3 py-3 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Swap Button */}
            <div className="hidden md:flex md:col-span-1 justify-center pt-5">
              <button
                id="swap-cities-btn"
                type="button"
                onClick={handleSwap}
                title="Swap source and destination"
                className="w-10 h-10 rounded-full bg-white hover:bg-red-50 text-[#D84E55] border border-red-200 flex items-center justify-center transition-all shadow-sm hover:shadow-md cursor-pointer hover:rotate-180 duration-300"
              >
                <ArrowRightLeft className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* To City */}
            <div className="md:col-span-4 relative group">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 ml-1">
                To Destination
              </label>
              <div className="relative flex items-center bg-white rounded-2xl border-2 border-red-50 hover:border-red-300 focus-within:border-[#D84E55] transition-all shadow-xs">
                <MapPin className="w-5 h-5 text-[#D84E55] absolute left-3.5 pointer-events-none" />
                <input
                  id="search-destination-input"
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Enter destination city"
                  className="w-full pl-11 pr-3 py-3 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Date */}
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1 px-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Date
                </label>
                <div className="flex gap-2 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={setDateToday}
                    className="text-[#D84E55] hover:underline cursor-pointer"
                  >
                    Today
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={setDateTomorrow}
                    className="text-[#D84E55] hover:underline cursor-pointer"
                  >
                    Tomorrow
                  </button>
                </div>
              </div>

              <div className="relative flex items-center bg-white rounded-2xl border-2 border-red-50 hover:border-red-300 focus-within:border-[#D84E55] transition-all shadow-xs">
                <Calendar className="w-4 h-4 text-[#D84E55] absolute left-3.5 pointer-events-none" />
                <input
                  id="search-date-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Big RedBus SEARCH BUSES button */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-red-50">
            {/* Quick Popular Route Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs pb-1 sm:pb-0">
              <span className="text-slate-400 font-bold text-[11px] whitespace-nowrap">Popular:</span>
              {[
                { s: 'Bangalore', d: 'Hyderabad' },
                { s: 'Mumbai', d: 'Goa' },
                { s: 'Delhi', d: 'Manali' },
                { s: 'Pune', d: 'Mumbai' },
                { s: 'Chennai', d: 'Bangalore' },
              ].map((rt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSource(rt.s);
                    setDestination(rt.d);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-red-50/60 hover:bg-red-100 text-slate-700 hover:text-[#D84E55] border border-red-100 font-semibold text-[11px] whitespace-nowrap transition-colors cursor-pointer"
                >
                  {rt.s} → {rt.d}
                </button>
              ))}
            </div>

            <button
              id="search-buses-submit-btn"
              type="button"
              onClick={onSearch}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#D84E55] hover:bg-[#b52a31] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-500/35 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Search className="w-4 h-4 stroke-[3]" />
              <span>Search Buses</span>
            </button>
          </div>
        </div>

        {/* RedBus Trust Feature Badges */}
        <div className="relative z-10 max-w-5xl mx-auto mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-white">
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-xs rounded-xl px-3 py-2 border border-white/20">
            <Sparkles className="w-4 h-4 text-white shrink-0" />
            <span className="font-bold text-[11px] leading-tight">Primo Certified Buses</span>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-xs rounded-xl px-3 py-2 border border-white/20">
            <RotateCcw className="w-4 h-4 text-white shrink-0" />
            <span className="font-bold text-[11px] leading-tight">Free Cancellation</span>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-xs rounded-xl px-3 py-2 border border-white/20">
            <Clock className="w-4 h-4 text-white shrink-0" />
            <span className="font-bold text-[11px] leading-tight">Live Bus Tracking</span>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-xs rounded-xl px-3 py-2 border border-white/20">
            <Shield className="w-4 h-4 text-white shrink-0" />
            <span className="font-bold text-[11px] leading-tight">24/7 Customer Care</span>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar (Red & White Theme) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-red-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full text-xs">
          <span className="flex items-center gap-1 text-[#D84E55] font-extrabold uppercase tracking-wider text-[10px] whitespace-nowrap">
            <Filter className="w-3.5 h-3.5 text-[#D84E55]" /> Filter:
          </span>

          {[
            { id: 'all', label: 'All Buses' },
            { id: 'sleeper', label: 'AC Sleeper' },
            { id: 'volvo', label: 'Volvo Multi-Axle' },
            { id: 'electric', label: 'Electric Luxury' },
            { id: 'budget', label: 'Under ₹1000' },
            { id: 'rated', label: 'Primo Rated 4.8+' },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSelectedFilter(chip.id)}
              className={`px-3.5 py-1.5 rounded-full font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                selectedFilter === chip.id
                  ? 'bg-[#D84E55] text-white shadow-sm shadow-red-500/30'
                  : 'bg-white text-slate-700 hover:bg-red-50 hover:text-[#D84E55] border border-slate-200 hover:border-red-300'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-bold text-slate-600 whitespace-nowrap hidden sm:block">
          <span className="text-[#D84E55] font-extrabold text-sm">{totalTripsCount}</span> buses available
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useSocket } from '../context/SocketContext.js';
import { Bus, Ticket, Radio, HelpCircle, ShieldCheck, User, ChevronDown, Cpu, Sparkles, Navigation, Layers } from 'lucide-react';
import { UserRole } from '../types.js';

interface NavbarProps {
  activeTab: 'routes' | 'bookings' | 'operator' | 'architecture' | 'radar';
  setActiveTab: (tab: 'routes' | 'bookings' | 'operator' | 'architecture' | 'radar') => void;
  onOpenPnrLookup?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenPnrLookup }) => {
  const { role, setRole, userName } = useAuth();
  const { isConnected } = useSocket();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#D84E55] shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* RedRoute Brand Logo */}
          <div
            id="redroute-brand-logo"
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => setActiveTab('routes')}
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white flex items-center justify-center shadow-md">
              <Bus className="w-6 h-6 text-[#D84E55]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline">
                <span className="text-2xl sm:text-[26px] font-black tracking-tight text-white">
                  Red<span className="text-white/95 font-medium">Route</span>
                </span>
                <span className="ml-1.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white text-[#D84E55] shadow-xs">
                  Live
                </span>
              </div>
              <span className="text-[10px] -mt-1 text-white/80 font-medium hidden sm:inline">
                India's No. 1 Bus Booking
              </span>
            </div>
          </div>

          {/* Primary Red & White Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 sm:gap-2">
            <button
              id="nav-bus-tickets-tab"
              onClick={() => setActiveTab('routes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'routes'
                  ? 'bg-white text-[#D84E55] shadow-md'
                  : 'text-white/90 hover:text-white hover:bg-white/15'
              }`}
            >
              <Bus className={`w-4 h-4 ${activeTab === 'routes' ? 'text-[#D84E55]' : 'text-white'}`} />
              <span>Bus Tickets</span>
            </button>

            <button
              id="nav-live-radar-tab"
              onClick={() => setActiveTab('radar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'radar'
                  ? 'bg-white text-[#D84E55] shadow-md'
                  : 'text-white/90 hover:text-white hover:bg-white/15'
              }`}
            >
              <Radio className={`w-4 h-4 ${activeTab === 'radar' ? 'text-[#D84E55]' : 'text-white'}`} />
              <span>Live Radar & GPS</span>
            </button>

            <button
              id="nav-my-bookings-tab"
              onClick={() => setActiveTab('bookings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'bookings'
                  ? 'bg-white text-[#D84E55] shadow-md'
                  : 'text-white/90 hover:text-white hover:bg-white/15'
              }`}
            >
              <Ticket className={`w-4 h-4 ${activeTab === 'bookings' ? 'text-[#D84E55]' : 'text-white'}`} />
              <span>My Bookings</span>
            </button>
          </nav>

          {/* Right Action Menu (Help, PNR, User Account) */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Quick PNR Status Button */}
            {onOpenPnrLookup && (
              <button
                id="header-pnr-status-btn"
                onClick={onOpenPnrLookup}
                className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-white text-[#D84E55] hover:bg-white/90 transition-all cursor-pointer shadow-sm"
              >
                <ShieldCheck className="w-4 h-4 text-[#D84E55]" />
                <span>PNR Status</span>
              </button>
            )}

            {/* Help / Customer Care */}
            <button
              id="header-help-btn"
              onClick={() => {
                alert('RedRoute 24x7 Customer Care: Call 1800-419-4287 or email support@redroute.in');
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-white/95 hover:text-white px-2.5 py-2 rounded-xl hover:bg-white/15 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-white" />
              <span className="hidden sm:inline">Help</span>
            </button>

            {/* Account & Profile Menu */}
            <div className="relative">
              <button
                id="header-account-btn"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl bg-white text-[#D84E55] hover:bg-white/90 shadow-sm transition-all cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-[#D84E55] text-white flex items-center justify-center text-xs font-black shadow-xs">
                  {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="max-w-[90px] truncate hidden sm:inline text-slate-800 font-bold">{userName || 'Account'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#D84E55]" />
              </button>

              {/* Account Dropdown */}
              {accountMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-red-100 rounded-2xl shadow-xl py-2 z-50 text-xs animate-fadeIn">
                  <div className="px-4 py-2 border-b border-red-50">
                    <p className="font-bold text-slate-900">{userName}</p>
                    <p className="text-[#D84E55] text-[11px] font-semibold capitalize">{role} Account</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setActiveTab('bookings');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-red-50/70 flex items-center gap-2 text-slate-700 hover:text-[#D84E55] font-medium cursor-pointer"
                    >
                      <Ticket className="w-4 h-4 text-[#D84E55]" />
                      <span>Show My Bookings</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('radar');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-red-50/70 flex items-center gap-2 text-slate-700 hover:text-[#D84E55] font-medium cursor-pointer"
                    >
                      <Radio className="w-4 h-4 text-[#D84E55]" />
                      <span>Live Fleet Radar</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('operator');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-red-50/70 flex items-center gap-2 text-slate-700 hover:text-[#D84E55] font-medium cursor-pointer"
                    >
                      <Bus className="w-4 h-4 text-[#D84E55]" />
                      <span>Operator Dispatcher Portal</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('architecture');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-red-50/70 flex items-center gap-2 text-slate-700 hover:text-[#D84E55] font-medium cursor-pointer"
                    >
                      <Cpu className="w-4 h-4 text-[#D84E55]" />
                      <span>Stress & Concurrency Lab</span>
                    </button>
                  </div>

                  <div className="px-4 pt-2 pb-1 border-t border-red-50">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      Switch Role (RBAC)
                    </label>
                    <select
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value as UserRole);
                        setAccountMenuOpen(false);
                      }}
                      className="w-full bg-red-50/50 border border-red-200 rounded-lg p-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#D84E55]"
                    >
                      <option value="passenger">Passenger</option>
                      <option value="operator">Fleet Operator</option>
                      <option value="auditor">Financial Auditor</option>
                      <option value="admin">Platform Admin</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Red & White Nav Strip */}
      <div className="md:hidden flex items-center justify-around border-t border-white/20 px-2 py-2 bg-[#C8434A] text-xs text-white">
        <button
          onClick={() => setActiveTab('routes')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg font-bold transition-colors ${
            activeTab === 'routes' ? 'text-[#D84E55] bg-white shadow-xs' : 'text-white/80 hover:text-white'
          }`}
        >
          <Bus className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Buses</span>
        </button>

        <button
          onClick={() => setActiveTab('radar')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg font-bold transition-colors ${
            activeTab === 'radar' ? 'text-[#D84E55] bg-white shadow-xs' : 'text-white/80 hover:text-white'
          }`}
        >
          <Radio className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Radar</span>
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg font-bold transition-colors ${
            activeTab === 'bookings' ? 'text-[#D84E55] bg-white shadow-xs' : 'text-white/80 hover:text-white'
          }`}
        >
          <Ticket className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Bookings</span>
        </button>

        <button
          onClick={() => setActiveTab('operator')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg font-bold transition-colors ${
            activeTab === 'operator' ? 'text-[#D84E55] bg-white shadow-xs' : 'text-white/80 hover:text-white'
          }`}
        >
          <Layers className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Operator</span>
        </button>
      </div>
    </header>
  );
};

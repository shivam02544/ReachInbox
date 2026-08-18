'use client';

import React from 'react';

export interface UserProfile {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface EmailStats {
  scheduledCount: number;
  processingCount: number;
  sentCount: number;
  failedCount: number;
  totalCount: number;
  sendersCount: number;
}

interface SidebarProps {
  user: UserProfile;
  stats: EmailStats | null;
  activeView: 'SCHEDULED' | 'SENT' | 'COMPOSE';
  scheduledCount: number;
  sentCount: number;
  onNavigate: (view: 'SCHEDULED' | 'SENT' | 'COMPOSE') => void;
  onLogout: () => void;
}

export function Sidebar({
  user,
  stats,
  activeView,
  scheduledCount,
  sentCount,
  onNavigate,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="w-56 h-screen sticky top-0 bg-white border-r border-slate-200 flex flex-col justify-between p-4 font-sans select-none z-20">
      <div className="space-y-6">
        {/* OMB Dark Logo */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-slate-900">OMB</span>
          </div>
        </div>

        {/* User Profile Bar */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between group">
          <div className="flex items-center gap-2.5 min-w-0">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-slate-300 object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-slate-500 truncate font-mono">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Logout"
            className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Green Outlined Compose Button */}
        <button
          onClick={() => onNavigate('COMPOSE')}
          className={`w-full py-2 px-3 rounded-xl border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] ${
            activeView === 'COMPOSE' ? 'bg-emerald-50 font-extrabold' : ''
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>Compose</span>
        </button>

        {/* Navigation CORE Section */}
        <div className="space-y-1">
          <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Core
          </p>

          {/* Scheduled Nav Item */}
          <button
            onClick={() => onNavigate('SCHEDULED')}
            className={`w-full px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-all ${
              activeView === 'SCHEDULED'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border-l-4 border-emerald-600 pl-2'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Scheduled</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
              {scheduledCount}
            </span>
          </button>

          {/* Sent Nav Item */}
          <button
            onClick={() => onNavigate('SENT')}
            className={`w-full px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-all ${
              activeView === 'SENT'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border-l-4 border-emerald-600 pl-2'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Sent</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
              {sentCount}
            </span>
          </button>
        </div>
      </div>

      {/* Subtle Sidebar Footer Stats Summary */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1.5">
        <div className="flex justify-between text-slate-500">
          <span>Total Emails:</span>
          <span className="font-bold text-slate-900">{stats ? stats.totalCount : '-'}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Active Senders:</span>
          <span className="font-bold text-emerald-600">{stats ? stats.sendersCount : '-'}</span>
        </div>
      </div>
    </aside>
  );
}

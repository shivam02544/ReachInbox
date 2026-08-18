'use client';

import React from 'react';

export interface EmailStatsData {
  scheduledCount: number;
  processingCount: number;
  sentCount: number;
  failedCount: number;
  totalCount: number;
  sendersCount: number;
}

interface AnalyticsCardsProps {
  stats: EmailStatsData | null;
  loading: boolean;
  onRefresh: () => void;
}

export function AnalyticsCards({ stats, loading, onRefresh }: AnalyticsCardsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Current Dashboard Analytics (Live-on-Refresh)
        </h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all disabled:opacity-50"
        >
          <svg
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh Analytics
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Scheduled Card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Scheduled</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-sky-400">{stats ? stats.scheduledCount : '-'}</span>
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
          </div>
        </div>

        {/* Processing Card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Processing</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{stats ? stats.processingCount : '-'}</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          </div>
        </div>

        {/* Sent Card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Sent</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{stats ? stats.sentCount : '-'}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
        </div>

        {/* Failed Card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Failed</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-400">{stats ? stats.failedCount : '-'}</span>
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
          </div>
        </div>

        {/* Total Emails Card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Emails</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-400">{stats ? stats.totalCount : '-'}</span>
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
          </div>
        </div>

        {/* Active Senders Card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Senders</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-400">{stats ? stats.sendersCount : '-'}</span>
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
          </div>
        </div>
      </div>
    </div>
  );
}

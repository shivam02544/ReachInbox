'use client';

import React, { useState } from 'react';
import { EmailRecord } from './ScheduledList';

interface SentListProps {
  sentEmails: EmailRecord[];
  failedEmails: EmailRecord[];
  loading: boolean;
  onRefresh: () => void;
  onSelectEmail: (email: EmailRecord) => void;
}

export function SentList({ sentEmails, failedEmails, loading, onRefresh, onSelectEmail }: SentListProps) {
  const [filter, setFilter] = useState<'ALL' | 'SENT' | 'FAILED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allRecords = [...sentEmails, ...failedEmails].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredRecords = allRecords
    .filter((item) => {
      if (filter === 'SENT') return item.status === 'SENT';
      if (filter === 'FAILED') return item.status === 'FAILED';
      return true;
    })
    .filter(
      (item) =>
        item.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.body && item.body.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  return (
    <div className="flex-1 min-h-screen bg-white flex flex-col font-sans">
      {/* Top Bar with Filter Tabs and Search */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'ALL' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All ({allRecords.length})
            </button>
            <button
              onClick={() => setFilter('SENT')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'SENT' ? 'bg-emerald-50 text-emerald-700 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sent ({sentEmails.length})
            </button>
            <button
              onClick={() => setFilter('FAILED')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'FAILED' ? 'bg-rose-50 text-rose-700 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Failed ({failedEmails.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search in delivery history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Email List Content */}
      <div className="flex-1 divide-y divide-slate-100">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <span>Loading delivery history...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            {searchTerm ? 'No history emails match your search filter.' : 'No sent or failed email history found.'}
          </div>
        ) : (
          filteredRecords.map((email) => (
            <div
              key={email.id}
              onClick={() => onSelectEmail(email)}
              className="p-4 hover:bg-slate-50/80 cursor-pointer transition-colors flex items-center justify-between gap-4 group"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 truncate">To: {email.recipient}</span>
                  {email.status === 'SENT' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                      Sent {email.sentAt ? new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">
                      Failed
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {email.subject}
                </p>
                <p className="text-xs text-slate-500 truncate max-w-2xl leading-relaxed">
                  {email.body || 'No preview available'}
                </p>
              </div>

              {/* Star / Favorite Action */}
              <button
                onClick={(e) => toggleStar(e, email.id)}
                className="text-slate-300 hover:text-amber-400 transition-colors p-1"
                title="Star message"
              >
                <svg
                  className={`w-4 h-4 ${starredIds.has(email.id) ? 'fill-amber-400 text-amber-400' : 'fill-none'}`}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

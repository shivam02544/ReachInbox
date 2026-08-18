'use client';

import React, { useState } from 'react';
import { EmailRecord } from './ScheduledTable';

interface SentTableProps {
  sentEmails: EmailRecord[];
  failedEmails: EmailRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export function SentTable({ sentEmails, failedEmails, loading, onRefresh }: SentTableProps) {
  const [filter, setFilter] = useState<'ALL' | 'SENT' | 'FAILED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

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
        item.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Sent & Failed Delivery History</h3>
          <p className="text-xs text-slate-400">Historical delivery outcomes logged by Nodemailer SMTP service.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filter === 'ALL' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({allRecords.length})
            </button>
            <button
              onClick={() => setFilter('SENT')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filter === 'SENT' ? 'bg-emerald-500/20 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sent ({sentEmails.length})
            </button>
            <button
              onClick={() => setFilter('FAILED')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filter === 'FAILED' ? 'bg-rose-500/20 text-rose-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Failed ({failedEmails.length})
            </button>
          </div>

          <input
            type="text"
            placeholder="Search recipient or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all w-48 sm:w-64"
          />

          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span>Fetching delivery history...</span>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
          {searchTerm ? 'No history records match your search filter.' : 'No sent or failed email history found for your account.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Scheduled At</th>
                <th className="py-3 px-4">Sent / Closed At</th>
                <th className="py-3 px-4 text-center">Attempts</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredRecords.map((email) => (
                <tr key={email.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-slate-200 font-medium">{email.recipient}</td>
                  <td className="py-3 px-4 text-slate-300 max-w-xs truncate">{email.subject}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {new Date(email.scheduledAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {email.sentAt ? new Date(email.sentAt).toLocaleString() : new Date(email.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px]">
                      {email.attempts} / 3
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {email.status === 'SENT' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-sans text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

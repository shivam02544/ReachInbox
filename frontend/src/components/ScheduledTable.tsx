'use client';

import React, { useState } from 'react';

export interface EmailRecord {
  id: string;
  senderId: string;
  recipient: string;
  subject: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
  scheduledAt: string;
  sentAt?: string | null;
  attempts: number;
  createdAt: string;
}

interface ScheduledTableProps {
  emails: EmailRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export function ScheduledTable({ emails, loading, onRefresh }: ScheduledTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmails = emails.filter(
    (item) =>
      item.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Scheduled Emails</h3>
          <p className="text-xs text-slate-400">Emails queued for future delivery by BullMQ and rate limited by Redis.</p>
        </div>

        <div className="flex items-center gap-3">
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
          <span>Fetching scheduled emails...</span>
        </div>
      ) : filteredEmails.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
          {searchTerm ? 'No scheduled emails match your search filter.' : 'No scheduled emails found for your account.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Scheduled At</th>
                <th className="py-3 px-4 text-center">Attempts</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredEmails.map((email) => (
                <tr key={email.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-slate-200 font-medium">{email.recipient}</td>
                  <td className="py-3 px-4 text-slate-300 max-w-xs truncate">{email.subject}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {new Date(email.scheduledAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px]">
                      {email.attempts} / 3
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {email.status === 'SCHEDULED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-sans text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                        Scheduled
                      </span>
                    )}
                    {email.status === 'PROCESSING' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-sans text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        Processing
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

'use client';

import React from 'react';
import { EmailRecord } from './ScheduledList';

interface EmailDetailViewProps {
  email: EmailRecord;
  onBack: () => void;
}

export function EmailDetailView({ email, onBack }: EmailDetailViewProps) {
  return (
    <div className="flex-1 min-h-screen bg-white flex flex-col font-sans">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors flex-shrink-0"
            title="Back to list"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-base font-bold text-slate-900 truncate">{email.subject}</h2>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Action icons */}
          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-500 transition-colors" title="Star">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Archive">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors" title="Delete">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Message Content Container */}
      <div className="p-6 max-w-4xl space-y-6">
        {/* Sender Information Header */}
        <div className="flex items-start justify-between pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center flex-shrink-0">
              {email.recipient.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{email.recipient}</span>
                <span className="text-xs text-slate-400 font-mono">&lt;{email.recipient}&gt;</span>
              </div>
              <p className="text-xs text-slate-500">to me</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 font-mono">
              {new Date(email.scheduledAt).toLocaleString()}
            </span>
            <div className="mt-1">
              {email.status === 'SCHEDULED' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                  Scheduled
                </span>
              )}
              {email.status === 'SENT' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                  Sent
                </span>
              )}
              {email.status === 'FAILED' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">
                  Failed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Email Body Reader */}
        <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
          {email.body || 'No message content available.'}
        </div>
      </div>
    </div>
  );
}

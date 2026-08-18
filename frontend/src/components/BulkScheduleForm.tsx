'use client';

import React, { useEffect, useState } from 'react';

interface SenderItem {
  id: string;
  email: string;
  displayName: string;
}

interface ScheduleResult {
  message: string;
  summary: {
    totalRequested: number;
    scheduledCount: number;
    alreadyExistsCount: number;
    invalidRecipientsCount: number;
    failedEnqueueCount: number;
  };
  scheduledEmails: Array<{ id: string; recipient: string; scheduledAt: string; status: string }>;
  skippedDuplicates: string[];
  invalidRecipients: string[];
}

interface BulkScheduleFormProps {
  validRecipients: string[];
}

export function BulkScheduleForm({ validRecipients }: BulkScheduleFormProps) {
  const [senders, setSenders] = useState<SenderItem[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [startTime, setStartTime] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16);
  });
  const [delayMs, setDelayMs] = useState<number>(2000);

  const [loadingSenders, setLoadingSenders] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScheduleResult | null>(null);

  useEffect(() => {
    async function fetchSenders() {
      try {
        const res = await fetch('http://localhost:5000/api/senders', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load user senders');
        const data = await res.json();
        if (data.senders && data.senders.length > 0) {
          setSenders(data.senders);
          setSelectedSenderId(data.senders[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching senders');
      } finally {
        setLoadingSenders(false);
      }
    }
    fetchSenders();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSenderId) {
      setError('Please select a sender address.');
      return;
    }
    if (!subject.trim()) {
      setError('Please enter an email subject.');
      return;
    }
    if (!body.trim()) {
      setError('Please enter the email body.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        senderId: selectedSenderId,
        subject: subject.trim(),
        body: body.trim(),
        startTime: new Date(startTime).toISOString(),
        delayMs: Number(delayMs),
        recipients: validRecipients,
      };

      const res = await fetch('http://localhost:5000/api/emails/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to schedule campaign.');
      }

      setResult(data as ScheduleResult);
    } catch (err: any) {
      setError(err.message || 'Error scheduling email campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
      <h3 className="text-base font-bold text-white pb-3 border-b border-slate-800">
        Campaign Setup & Scheduling
      </h3>

      {loadingSenders ? (
        <div className="text-xs text-slate-400">Loading available senders...</div>
      ) : (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Select Sender Address</label>
          <select
            id="sender-select"
            value={selectedSenderId}
            onChange={(e) => setSelectedSenderId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
          >
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} ({s.email})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-300">Email Subject</label>
        <input
          id="subject-input"
          type="text"
          placeholder="e.g. Q3 Outreach Campaign"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={500}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-300">Email Body</label>
        <textarea
          id="body-textarea"
          rows={4}
          placeholder="Write your email template body here..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Start Delivery Time</label>
          <input
            id="start-time-input"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Inter-Recipient Delay (ms)</label>
          <input
            id="delay-ms-input"
            type="number"
            min={1000}
            max={86400000}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      <button
        id="schedule-campaign-button"
        type="submit"
        disabled={submitting || validRecipients.length === 0}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            <span>Enqueuing {validRecipients.length} Email Jobs...</span>
          </>
        ) : (
          <span>Schedule Campaign ({validRecipients.length} Recipients)</span>
        )}
      </button>

      {result && (
        <div className="mt-4 p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{result.message}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Scheduled Jobs</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">{result.summary.scheduledCount}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Skipped Duplicates</span>
              <span className="text-sm font-bold text-amber-400 font-mono">{result.summary.alreadyExistsCount}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Failed Enqueues</span>
              <span className="text-sm font-bold text-red-400 font-mono">{result.summary.failedEnqueueCount}</span>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

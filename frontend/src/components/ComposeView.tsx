'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SendLaterPopover } from './SendLaterPopover';

interface SenderOption {
  id: string;
  email: string;
  displayName: string;
}

export interface CsvPreviewData {
  filename: string;
  summary: {
    totalRows: number;
    validRecipientsCount: number;
    invalidRecipientsCount: number;
    duplicateRecipientsCount: number;
    skippedRowsCount: number;
  };
  validRecipients: string[];
  invalidRecipients: string[];
  duplicateRecipients: string[];
}

interface ComposeViewProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function ComposeView({ onBack, onSuccess }: ComposeViewProps) {
  // Senders & Selection
  const [senders, setSenders] = useState<SenderOption[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [loadingSenders, setLoadingSenders] = useState<boolean>(true);

  // Recipient State
  const [toInput, setToInput] = useState<string>('');
  const [recipientList, setRecipientList] = useState<string[]>([]);

  // CSV Upload State & Modal
  const [csvPreview, setCsvPreview] = useState<CsvPreviewData | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState<boolean>(false);
  const [showCsvModal, setShowCsvModal] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Content
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [delayMs, setDelayMs] = useState<number>(2000);
  const [hourlyLimit] = useState<number>(200); // Display-only informational field

  // Scheduling & Send Later
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [isSendLaterOpen, setIsSendLaterOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Fetch Senders on Mount
  useEffect(() => {
    async function fetchSenders() {
      try {
        setLoadingSenders(true);
        const res = await fetch('http://localhost:5000/api/senders', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to fetch senders (${res.status})`);
        const data = await res.json();
        setSenders(data.senders || []);
        if (data.senders && data.senders.length > 0) {
          setSelectedSenderId(data.senders[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load senders');
      } finally {
        setLoadingSenders(false);
      }
    }

    fetchSenders();
  }, []);

  // Handle Manual Email Keydown (Enter or comma to add recipient)
  const handleKeyDownTo = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = toInput.trim().toLowerCase();
      if (val && !recipientList.includes(val)) {
        setRecipientList((prev) => [...prev, val]);
        setToInput('');
      }
    }
  };

  const removeRecipient = (email: string) => {
    setRecipientList((prev) => prev.filter((r) => r !== email));
  };

  // Handle CSV File Select & Upload (POST /api/emails/parse-csv)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('CSV file exceeds hard limit of 5 MB.');
      return;
    }

    try {
      setUploadingCsv(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:5000/api/emails/parse-csv', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || `CSV Upload failed (${res.status})`);
      }

      setCsvPreview(data);
      if (data.validRecipients && data.validRecipients.length > 0) {
        // Merge valid recipients into recipientList uniquely
        setRecipientList((prev) => Array.from(new Set([...prev, ...data.validRecipients])));
      }
      setShowCsvModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to upload CSV file.');
    } finally {
      setUploadingCsv(false);
    }
  };

  // Handle Form Submission (POST /api/emails/schedule)
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Determine final recipient list
    let finalRecipients = [...recipientList];
    if (toInput.trim()) {
      const typedVal = toInput.trim().toLowerCase();
      if (!finalRecipients.includes(typedVal)) {
        finalRecipients.push(typedVal);
      }
    }

    if (!selectedSenderId) {
      setError('Please select a sender account.');
      return;
    }

    if (finalRecipients.length === 0) {
      setError('Please provide at least one valid recipient email address.');
      return;
    }

    if (!subject.trim()) {
      setError('Subject is required.');
      return;
    }

    if (!body.trim()) {
      setError('Body content is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setStatusMessage(null);

      const payload = {
        senderId: selectedSenderId,
        subject: subject.trim(),
        body: body.trim(),
        startTime: scheduledAt ? scheduledAt : new Date().toISOString(),
        delayMs: Number(delayMs) || 2000,
        recipients: finalRecipients,
      };

      const res = await fetch('http://localhost:5000/api/emails/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || `Scheduling failed (${res.status})`);
      }

      setStatusMessage(`Successfully scheduled ${data.summary?.scheduledCount || finalRecipients.length} email(s).`);
      setTimeout(() => {
        onSuccess();
        onBack();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to schedule campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  // Formatting helper mock toggles
  const applyFormatting = (tag: string) => {
    setBody((prev) => `${prev} <${tag}>${tag}</${tag}>`);
  };

  return (
    <div className="flex-1 min-h-screen bg-white flex flex-col font-sans text-slate-900">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-base font-bold text-slate-900">Compose New Email</h2>
        </div>

        {/* Send / Send Later Actions */}
        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-colors"
            title="Send Later"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Green Send / Send Later Button */}
          <button
            onClick={handleScheduleSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>{scheduledAt ? 'Schedule Send' : 'Send'}</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>

          {/* Anchored Send Later Popover */}
          <SendLaterPopover
            isOpen={isSendLaterOpen}
            onClose={() => setIsSendLaterOpen(false)}
            onSelectTime={(isoStr) => setScheduledAt(isoStr)}
          />
        </div>
      </div>

      {/* Hidden File Input for CSV Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Composer Form */}
      <form onSubmit={handleScheduleSubmit} className="p-6 max-w-5xl space-y-4 text-xs">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
            {error}
          </div>
        )}

        {statusMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
            {statusMessage}
          </div>
        )}

        {/* Scheduled Time Banner */}
        {scheduledAt && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between">
            <span className="font-semibold">Scheduled for: {new Date(scheduledAt).toLocaleString()}</span>
            <button
              type="button"
              onClick={() => setScheduledAt('')}
              className="text-amber-700 hover:text-amber-900 text-xs font-bold underline"
            >
              Clear Schedule
            </button>
          </div>
        )}

        {/* From Field */}
        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-24 text-slate-400 font-medium">From</label>
          {loadingSenders ? (
            <span className="text-slate-400">Loading senders...</span>
          ) : (
            <select
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value)}
              className="flex-1 py-1 text-xs bg-transparent text-slate-900 font-semibold focus:outline-none"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} &lt;{s.email}&gt;
                </option>
              ))}
            </select>
          )}
        </div>

        {/* To Field with Recipient Chips & Upload List */}
        <div className="flex items-start border-b border-slate-100 pb-3">
          <label className="w-24 pt-1.5 text-slate-400 font-medium">To</label>
          <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
            {/* Recipient Chips */}
            {recipientList.slice(0, 5).map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium"
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  className="hover:text-emerald-900 font-bold"
                >
                  ✕
                </button>
              </span>
            ))}

            {/* Overflow Chip (+N) */}
            {recipientList.length > 5 && (
              <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
                +{recipientList.length - 5}
              </span>
            )}

            {/* Manual Email Input */}
            <input
              type="email"
              placeholder={recipientList.length === 0 ? 'Type email address and press Enter...' : 'Add another email...'}
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={handleKeyDownTo}
              className="flex-1 min-w-[200px] py-1 text-xs bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Upload List CSV Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingCsv}
            className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ml-2"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{uploadingCsv ? 'Parsing...' : 'Upload List'}</span>
          </button>
        </div>

        {/* Subject Field */}
        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-24 text-slate-400 font-medium">Subject</label>
          <input
            type="text"
            placeholder="Subject..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 py-1 text-xs bg-transparent text-slate-900 font-medium placeholder-slate-400 focus:outline-none"
          />
        </div>

        {/* Configuration Row: Delay & Hourly Limit */}
        <div className="flex items-center gap-6 py-2 border-b border-slate-100 text-slate-600">
          <div className="flex items-center gap-2">
            <label className="text-slate-400 font-medium">Delay between 2 emails</label>
            <input
              type="number"
              min="1000"
              step="500"
              value={delayMs}
              onChange={(e) => setDelayMs(Number(e.target.value))}
              className="w-20 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-xs font-mono font-bold text-center focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-400">ms</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-400 font-medium">Hourly Limit</label>
            <input
              type="number"
              disabled
              value={hourlyLimit}
              className="w-16 px-2 py-1 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 text-xs font-mono font-bold text-center cursor-not-allowed"
              title="Informational hourly quota limit enforced by Redis rate limiter"
            />
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className="flex items-center gap-1 py-2 border-b border-slate-100 text-slate-500">
          <button type="button" onClick={() => applyFormatting('b')} className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 font-bold" title="Bold">B</button>
          <button type="button" onClick={() => applyFormatting('i')} className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 italic font-bold" title="Italic">I</button>
          <button type="button" onClick={() => applyFormatting('u')} className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 underline font-bold" title="Underline">U</button>
          <span className="w-px h-4 bg-slate-200 mx-1" />
          <button type="button" onClick={() => applyFormatting('ul')} className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900" title="Bullet List">• List</button>
          <button type="button" onClick={() => applyFormatting('a')} className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900" title="Link">🔗 Link</button>
        </div>

        {/* Email Body Editor */}
        <div>
          <textarea
            rows={12}
            placeholder="Type Your Reply..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full p-3 text-xs bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none leading-relaxed resize-y font-sans"
          />
        </div>
      </form>

      {/* CSV Parsing Summary Modal */}
      {showCsvModal && csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="max-w-md w-full p-5 rounded-2xl bg-white border border-slate-200 shadow-2xl space-y-4 text-xs text-slate-900">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">CSV List Summary — {csvPreview.filename}</h3>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="block text-lg font-bold text-emerald-700">{csvPreview.summary.validRecipientsCount}</span>
                <span className="text-[10px] text-emerald-600 font-medium">Valid</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="block text-lg font-bold text-amber-700">{csvPreview.summary.duplicateRecipientsCount}</span>
                <span className="text-[10px] text-amber-600 font-medium">Duplicates</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <span className="block text-lg font-bold text-rose-700">{csvPreview.summary.invalidRecipientsCount}</span>
                <span className="text-[10px] text-rose-600 font-medium">Invalid</span>
              </div>
            </div>

            {csvPreview.invalidRecipients.length > 0 && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-tight">
                <span className="font-bold">Skipped Invalid Emails: </span>
                {csvPreview.invalidRecipients.join(', ')}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              >
                Apply Recipients
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

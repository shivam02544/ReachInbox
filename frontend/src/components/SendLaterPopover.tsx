'use client';

import React, { useState } from 'react';

interface SendLaterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTime: (isoString: string) => void;
}

export function SendLaterPopover({ isOpen, onClose, onSelectTime }: SendLaterPopoverProps) {
  const [customDateTime, setCustomDateTime] = useState<string>('');

  if (!isOpen) return null;

  const handlePresetSelect = (hoursToAdd: number, specificHour?: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Tomorrow
    if (specificHour !== undefined) {
      d.setHours(specificHour, 0, 0, 0);
    }
    onSelectTime(d.toISOString());
    onClose();
  };

  const handleCustomDone = () => {
    if (customDateTime) {
      onSelectTime(new Date(customDateTime).toISOString());
    } else {
      onSelectTime(new Date().toISOString());
    }
    onClose();
  };

  return (
    <div className="absolute right-0 top-12 z-50 w-72 p-4 rounded-xl bg-white border border-slate-200 shadow-xl font-sans text-slate-900 animate-fadeIn">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Send Later
        </h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">
          ✕
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Quick Presets</p>
        <button
          onClick={() => handlePresetSelect(24, 9)}
          className="w-full px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-left font-medium transition-colors flex justify-between items-center"
        >
          <span>Tomorrow</span>
          <span className="text-[10px] text-slate-400">9:00 AM</span>
        </button>
        <button
          onClick={() => handlePresetSelect(24, 10)}
          className="w-full px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-left font-medium transition-colors flex justify-between items-center"
        >
          <span>Tomorrow, 10:00 AM</span>
        </button>
        <button
          onClick={() => handlePresetSelect(24, 11)}
          className="w-full px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-left font-medium transition-colors flex justify-between items-center"
        >
          <span>Tomorrow, 11:00 AM</span>
        </button>
        <button
          onClick={() => handlePresetSelect(24, 15)}
          className="w-full px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-left font-medium transition-colors flex justify-between items-center"
        >
          <span>Tomorrow, 3:00 PM</span>
        </button>

        <div className="pt-2 border-t border-slate-100 space-y-1">
          <label className="block text-[10px] font-semibold text-slate-400 uppercase">Pick Date & Time</label>
          <input
            type="datetime-local"
            value={customDateTime}
            onChange={(e) => setCustomDateTime(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleCustomDone}
            className="px-3 py-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

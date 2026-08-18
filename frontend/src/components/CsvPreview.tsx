'use client';

import React, { useState } from 'react';
import { CsvPreviewData } from './CsvUploader';

interface CsvPreviewProps {
  data: CsvPreviewData;
  onClear: () => void;
}

export function CsvPreview({ data, onClear }: CsvPreviewProps) {
  const [showInvalid, setShowInvalid] = useState<boolean>(false);
  const [showDuplicates, setShowDuplicates] = useState<boolean>(false);

  return (
    <div className="w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">{data.filename}</h3>
            <p className="text-xs text-slate-400">CSV Structure Validated</p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700"
        >
          Upload Different File
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 text-center text-xs">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-slate-500 block mb-1">Total Rows</span>
          <span className="text-base font-bold text-slate-200 font-mono">{data.summary.totalRows}</span>
        </div>
        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
          <span className="text-emerald-400/80 block mb-1">Valid Emails</span>
          <span className="text-base font-bold text-emerald-400 font-mono">{data.summary.validRecipientsCount}</span>
        </div>
        <div
          onClick={() => data.summary.invalidRecipientsCount > 0 && setShowInvalid(!showInvalid)}
          className={`p-3 rounded-xl border transition-all ${
            data.summary.invalidRecipientsCount > 0 ? 'cursor-pointer hover:bg-red-950/40' : ''
          } bg-red-950/20 border-red-500/20`}
        >
          <span className="text-red-400/80 block mb-1">Invalid</span>
          <span className="text-base font-bold text-red-400 font-mono">{data.summary.invalidRecipientsCount}</span>
        </div>
        <div
          onClick={() => data.summary.duplicateRecipientsCount > 0 && setShowDuplicates(!showDuplicates)}
          className={`p-3 rounded-xl border transition-all ${
            data.summary.duplicateRecipientsCount > 0 ? 'cursor-pointer hover:bg-amber-950/40' : ''
          } bg-amber-950/20 border-amber-500/20`}
        >
          <span className="text-amber-400/80 block mb-1">Duplicates</span>
          <span className="text-base font-bold text-amber-400 font-mono">{data.summary.duplicateRecipientsCount}</span>
        </div>
      </div>

      {showInvalid && data.invalidRecipients.length > 0 && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-xs">
          <span className="font-semibold text-red-400 block mb-2">Invalid Recipients Skipped:</span>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {data.invalidRecipients.map((email, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded bg-red-900/40 text-red-300 font-mono text-[11px]">
                {email}
              </span>
            ))}
          </div>
        </div>
      )}

      {showDuplicates && data.duplicateRecipients.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs">
          <span className="font-semibold text-amber-400 block mb-2">Duplicate Emails Deduplicated:</span>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {data.duplicateRecipients.map((email, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 font-mono text-[11px]">
                {email}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

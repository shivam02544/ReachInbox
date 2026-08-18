import React from 'react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl w-full p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Step 0 Foundation Active
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
          ReachInbox Email Scheduler
        </h1>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Project Initialization & Architecture Contract step completed. Infrastructure services (PostgreSQL, Redis, Express Backend API, and BullMQ Worker container) are running in Docker Compose.
        </p>
        <div className="grid grid-cols-2 gap-4 text-left text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div>
            <span className="text-slate-500 block">Frontend Port:</span>
            <span className="text-slate-200 font-mono">3000</span>
          </div>
          <div>
            <span className="text-slate-500 block">Backend API Port:</span>
            <span className="text-slate-200 font-mono">5000</span>
          </div>
          <div>
            <span className="text-slate-500 block">Database:</span>
            <span className="text-slate-200 font-mono">PostgreSQL (5432)</span>
          </div>
          <div>
            <span className="text-slate-500 block">Queue Storage:</span>
            <span className="text-slate-200 font-mono">Redis (6379)</span>
          </div>
        </div>
      </div>
    </main>
  );
}

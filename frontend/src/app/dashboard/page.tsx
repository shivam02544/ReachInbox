'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CsvUploader, CsvPreviewData } from '../../components/CsvUploader';
import { CsvPreview } from '../../components/CsvPreview';
import { BulkScheduleForm } from '../../components/BulkScheduleForm';

interface UserProfile {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewData | null>(null);

  useEffect(() => {
    async function checkAuthStatus() {
      try {
        const res = await fetch('http://localhost:5000/api/auth/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (res.status === 401) {
          router.push('/login');
          return;
        }

        if (!res.ok) {
          throw new Error(`Auth check failed with status: ${res.status}`);
        }

        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          router.push('/login');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to check authentication');
      } finally {
        setLoading(false);
      }
    }

    checkAuthStatus();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:5000/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span>Verifying authentication session...</span>
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-950 text-white">
        <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <p className="text-red-400 text-sm mb-4">{error || 'Unauthenticated'}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all"
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 md:p-10 bg-slate-950 text-white">
      <div className="max-w-4xl w-full space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-11 h-11 rounded-full border-2 border-indigo-500/30 object-cover"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-base border border-indigo-500/20">
                {user.name.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-white leading-tight">{user.name}</h2>
              <p className="text-xs text-slate-400 font-mono">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Authenticated Session
            </span>
            <button
              id="logout-button"
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Step 6 Bulk Email Scheduling Workflow */}
        <div className="space-y-6">
          {!csvPreview ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Bulk Email Campaign Upload</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload a contacts CSV file containing an <code className="text-indigo-300 font-mono">email</code> header column to parse, validate, and preview recipients before scheduling.
                </p>
              </div>
              <CsvUploader onPreviewSuccess={(data) => setCsvPreview(data)} />
            </div>
          ) : (
            <div className="space-y-6">
              <CsvPreview data={csvPreview} onClear={() => setCsvPreview(null)} />
              <BulkScheduleForm validRecipients={csvPreview.validRecipients} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-950 text-white">
      <div className="max-w-lg w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-12 h-12 rounded-full border-2 border-indigo-500/30 object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/20">
                {user.name.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">{user.name}</h2>
              <p className="text-xs text-slate-400 font-mono">{user.email}</p>
            </div>
          </div>
          <button
            id="logout-button"
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
          >
            Logout
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Authentication Verification Status
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Authenticated
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">PostgreSQL User ID:</span>
                <span className="text-slate-300 font-mono text-[11px]">{user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Google ID:</span>
                <span className="text-slate-300 font-mono text-[11px]">{user.googleId}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-400/90 leading-relaxed">
            Step 5 Real Google OAuth foundation active. Server-side Redis session created, HTTP-only cookie set, and Express auth middleware verified.
          </div>
        </div>
      </div>
    </main>
  );
}

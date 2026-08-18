'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, UserProfile, EmailStats } from '../../components/Sidebar';
import { ScheduledList, EmailRecord } from '../../components/ScheduledList';
import { SentList } from '../../components/SentList';
import { EmailDetailView } from '../../components/EmailDetailView';
import { ComposeView } from '../../components/ComposeView';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View & Selected Email State
  const [activeView, setActiveView] = useState<'SCHEDULED' | 'SENT' | 'COMPOSE'>('SCHEDULED');
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);

  // Dashboard Data State
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [failedEmails, setFailedEmails] = useState<EmailRecord[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Fetch Dashboard Data Function
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoadingData(true);
      const [statsRes, scheduledRes, sentRes, failedRes] = await Promise.all([
        fetch('http://localhost:5000/api/emails/stats', { credentials: 'include' }),
        fetch('http://localhost:5000/api/emails/scheduled', { credentials: 'include' }),
        fetch('http://localhost:5000/api/emails/sent', { credentials: 'include' }),
        fetch('http://localhost:5000/api/emails/failed', { credentials: 'include' }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json();
        setScheduledEmails(scheduledData.emails || []);
      }

      if (sentRes.ok) {
        const sentData = await sentRes.json();
        setSentEmails(sentData.emails || []);
      }

      if (failedRes.ok) {
        const failedData = await failedRes.json();
        setFailedEmails(failedData.emails || []);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    async function checkAuthStatus() {
      try {
        const res = await fetch('http://localhost:5000/api/auth/me', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (res.status === 401) {
          router.push('/login');
          return;
        }

        if (!res.ok) throw new Error(`Auth check failed (${res.status})`);

        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          fetchDashboardData();
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
  }, [router, fetchDashboardData]);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:5000/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      router.push('/login');
    }
  };

  const handleNavigate = (view: 'SCHEDULED' | 'SENT' | 'COMPOSE') => {
    setActiveView(view);
    setSelectedEmail(null);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-slate-900 font-sans">
        <div className="flex items-center gap-3 text-slate-500 text-xs font-medium">
          <div className="w-4 h-4 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          <span>Verifying authentication session...</span>
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-white text-slate-900 font-sans">
        <div className="max-w-md w-full p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
          <p className="text-rose-600 text-xs mb-4 font-medium">{error || 'Unauthenticated'}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all"
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans">
      {/* Figma Narrow Sidebar */}
      <Sidebar
        user={user}
        stats={stats}
        activeView={activeView}
        scheduledCount={scheduledEmails.length}
        sentCount={sentEmails.length + failedEmails.length}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      {/* Main Email Content Viewport */}
      <main className="flex-1 min-w-0 bg-white flex flex-col">
        {selectedEmail ? (
          <EmailDetailView
            email={selectedEmail}
            onBack={() => setSelectedEmail(null)}
          />
        ) : activeView === 'SCHEDULED' ? (
          <ScheduledList
            emails={scheduledEmails}
            loading={loadingData}
            onRefresh={fetchDashboardData}
            onSelectEmail={(email) => setSelectedEmail(email)}
          />
        ) : activeView === 'SENT' ? (
          <SentList
            sentEmails={sentEmails}
            failedEmails={failedEmails}
            loading={loadingData}
            onRefresh={fetchDashboardData}
            onSelectEmail={(email) => setSelectedEmail(email)}
          />
        ) : (
          <ComposeView
            onBack={() => handleNavigate('SCHEDULED')}
            onSuccess={() => {
              fetchDashboardData();
              handleNavigate('SCHEDULED');
            }}
          />
        )}
      </main>
    </div>
  );
}

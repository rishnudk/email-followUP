'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Settings,
  FileText,
  Pause,
  Play,
  XCircle,
  LogOut,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Inbox,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Check,
  Zap,
  Search,
  Sliders,
  X,
  SlidersHorizontal,
} from 'lucide-react';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState<'emails' | 'upcoming' | 'templates' | 'settings'>('emails');

  // Stats & Email data
  const [stats, setStats] = useState<any>({
    sentCount: 0,
    waitingCount: 0,
    repliedCount: 0,
    bouncedCount: 0,
    dueSoonCount: 0,
  });
  const [threads, setThreads] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  // Filters & State
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Template Modal
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Toast / feedback message
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Load User Session
  const loadUser = useCallback(async () => {
    try {
      setLoadingUser(true);
      const res = await api.getMe();
      setCurrentUser(res.user);
    } catch {
      setCurrentUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  // Load Dashboard Data
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [statsRes, threadsRes, upcomingRes, templatesRes, settingsRes] = await Promise.all([
        api.getDashboardStats().catch(() => ({ stats: {} })),
        api.getEmails(statusFilter).catch(() => ({ threads: [] })),
        api.getUpcomingFollowUps().catch(() => ({ upcoming: [] })),
        api.getTemplates().catch(() => ({ templates: [] })),
        api.getSettings().catch(() => ({ settings: {} })),
      ]);

      setStats(statsRes.stats || {});
      setThreads(threadsRes.threads || []);
      setUpcoming(upcomingRes.upcoming || []);
      setTemplates(templatesRes.templates || []);
      setSettings(settingsRes.settings || {});
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }, [currentUser, statusFilter]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, loadData]);

  // Sync Emails from Gmail
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.syncEmails();
      await loadData();
      showToast(
        `Synced successfully: ${res.stats?.threadsSynced ?? 0} threads processed`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Toggle Automation
  const handleToggleAutomation = async (threadId: string, currentEnabled: boolean) => {
    setActionLoading(threadId);
    try {
      if (currentEnabled) {
        await api.disableFollowUp(threadId);
        showToast('Automation paused for this thread', 'info');
      } else {
        await api.enableFollowUp(threadId);
        showToast('Automation resumed for this thread', 'success');
      }
      await loadData();
      if (selectedThread?.id === threadId) {
        const detail = await api.getEmailDetails(threadId);
        setSelectedThread(detail.thread);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Stop Automation Permanently
  const handleStopAutomation = async (threadId: string) => {
    if (!confirm('Permanently stop all scheduled follow-ups for this thread?')) return;
    setActionLoading(threadId);
    try {
      await api.stopFollowUp(threadId);
      showToast('Follow-up schedule stopped permanently', 'info');
      await loadData();
      if (selectedThread?.id === threadId) {
        const detail = await api.getEmailDetails(threadId);
        setSelectedThread(detail.thread);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Trigger Send Follow-up Now
  const handleSendNow = async (threadId: string) => {
    if (!confirm('Send follow-up email immediately through Gmail?')) return;
    setActionLoading(threadId);
    try {
      const res = await api.sendFollowUpNow(threadId);
      if (res.result?.skipped) {
        showToast(`Skipped: ${res.result.reason}`, 'info');
        return;
      }
      if (res.result?.isDraft) {
        showToast('Gmail draft generated! (Draft-First safety mode)', 'success');
      } else if (res.result?.simulated) {
        showToast('Follow-up dispatched successfully! (Demo simulated)', 'success');
      } else {
        showToast('Follow-up dispatched successfully to recipient!', 'success');
      }
      await loadData();
      if (selectedThread?.id === threadId) {
        const detail = await api.getEmailDetails(threadId);
        setSelectedThread(detail.thread);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Open Thread Details
  const handleOpenThread = async (id: string) => {
    try {
      const res = await api.getEmailDetails(id);
      setSelectedThread(res.thread);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSettings(settings);
      showToast('Automation settings saved successfully', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Filtered Threads
  const filteredThreads = threads.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.recipientEmail?.toLowerCase().includes(q) ||
      t.recipientName?.toLowerCase().includes(q)
    );
  });

  // =========================================================================
  // UNAUTHENTICATED STATE — Linear Minimalist Landing Page
  // =========================================================================
  if (!loadingUser && !currentUser) {
    return (
      <div className="min-h-screen bg-[#08090A] text-[#F7F8F8] selection:bg-[#5E6AD2]/30 flex flex-col relative overflow-hidden">
        {/* Subtle Linear radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#5E6AD2]/10 via-[#08090A]/40 to-transparent blur-[140px] pointer-events-none -z-10" />

        {/* Global Navigation */}
        <header className="h-[72px] border-b border-[rgba(255,255,255,0.05)] bg-[#08090A]/80 backdrop-blur-md sticky top-0 z-40 px-6 sm:px-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0F1011] border border-[rgba(255,255,255,0.08)] flex items-center justify-center shadow-[rgba(0,0,0,0.4)_0px_2px_4px]">
              <Mail className="w-4 h-4 text-[#F7F8F8]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[15px] tracking-tight text-[#FFFFFF]">
                Auto Follow-Up
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.04)] text-[#8A8F98] border border-[rgba(255,255,255,0.06)]">
                v1.4
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="http://localhost:4000/auth/dev-login"
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#5E6AD2]" />
              Demo Mode
            </a>
            <a
              href={api.getGoogleAuthUrl()}
              className="linear-btn-secondary inline-flex items-center gap-2 h-8 px-3.5 text-[13px] font-medium"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Sign In
            </a>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 pt-16 pb-24 flex flex-col items-center text-center">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] mb-8 text-[12px] text-[#8A8F98] shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00BA7C] animate-pulse" />
            <span>Autonomous Gmail follow-ups with instant reply cessation</span>
            <ChevronRight className="w-3 h-3 text-[#62666D]" />
          </div>

          {/* Display Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-[68px] font-medium tracking-[-0.03em] leading-[1.05] text-[#FFFFFF] max-w-4xl mb-6">
            Follow up with clarity. <br />
            <span className="text-[#8A8F98]">Halt instantly on reply.</span>
          </h1>

          {/* Body Copy */}
          <p className="text-[16px] sm:text-[18px] text-[#8A8F98] max-w-2xl font-normal leading-[1.6] mb-10">
            A precision email cadence engine for high-output professionals. Detects outbound emails, orchestrates personalized multi-touch follow-ups, and guarantees zero awkward double-emails.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mb-16">
            <a
              href={api.getGoogleAuthUrl()}
              className="w-full sm:w-auto h-11 px-6 rounded-full bg-[#E5E5E6] hover:bg-[#FFFFFF] text-[#08090A] font-medium text-[14px] flex items-center justify-center gap-2.5 transition-all shadow-[rgba(0,0,0,0.1)_0px_4px_12px]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Connect Gmail Account
            </a>

            <a
              href="http://localhost:4000/auth/dev-login"
              className="linear-btn-primary w-full sm:w-auto h-11 px-5 flex items-center justify-center gap-2 text-[14px]"
            >
              <Sparkles className="w-4 h-4 text-[#5E6AD2]" />
              Enter Demo Mode
            </a>
          </div>

          {/* Interactive Hero UI Card Showcase */}
          <div className="w-full max-w-4xl bg-[#0F1011] border border-[rgba(255,255,255,0.06)] rounded-xl p-1 shadow-[rgba(0,0,0,0.6)_0px_20px_50px] relative text-left mb-20 overflow-hidden">
            {/* Top Bar of Card */}
            <div className="bg-[#141517] px-4 py-3 rounded-t-lg border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#3E3E44]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#3E3E44]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#3E3E44]" />
                <span className="ml-2 font-mono text-[11px] text-[#8A8F98]">
                  gmail-stream // thread-38491
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="linear-badge bg-[rgba(0,186,124,0.08)] text-[#00BA7C] border-[rgba(0,186,124,0.2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00BA7C]" />
                  REPLY DETECTED — STOPPED
                </span>
              </div>
            </div>

            {/* Inner Content Showcase */}
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.04)] gap-2">
                <div>
                  <h3 className="text-[16px] font-medium text-[#F7F8F8]">
                    Q3 Enterprise Infrastructure Partnership Proposal
                  </h3>
                  <div className="text-[13px] text-[#8A8F98] mt-0.5">
                    To: <span className="text-[#D0D6E0]">sarah.chen@acme.corp</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-[#8A8F98]">Sent Oct 4, 09:15 AM</div>
                  <div className="text-[11px] font-mono text-[#00BA7C]">Cadence Halted Safely</div>
                </div>
              </div>

              {/* Message nodes */}
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                  <div className="flex items-center justify-between text-[11px] text-[#8A8F98] mb-1.5">
                    <span className="font-medium text-[#F7F8F8]">You (Initial Outreach)</span>
                    <span>3 days ago</span>
                  </div>
                  <p className="text-[13px] text-[#8A8F98] leading-relaxed">
                    "Hi Sarah, following our sync last week, sharing our Q3 proposal notes for the migration roadmap..."
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[rgba(94,106,210,0.04)] border border-[rgba(94,106,210,0.15)] ml-4">
                  <div className="flex items-center justify-between text-[11px] text-[#8A8F98] mb-1.5">
                    <span className="font-medium text-[#FFFFFF] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00BA7C]" />
                      Sarah Chen (Direct Reply)
                    </span>
                    <span>Yesterday, 04:22 PM</span>
                  </div>
                  <p className="text-[13px] text-[#D0D6E0] leading-relaxed">
                    "Thanks for checking in! Our team reviewed the specs and we’d love to proceed with the pilot next Tuesday."
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-[rgba(255,255,255,0.05)] flex items-center justify-between text-[11px]">
                    <span className="text-[#8A8F98]">
                      Trigger action: <strong className="text-[#00BA7C]">Follow-up #1 canceled automatically</strong>
                    </span>
                    <span className="font-mono text-[#62666D]">latency: 180ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3-Column Features Grid — Linear Dark Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
            <div className="linear-card p-6">
              <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center mb-5">
                <CheckCircle2 className="w-5 h-5 text-[#00BA7C]" />
              </div>
              <h3 className="text-[16px] font-medium text-[#FFFFFF] mb-2">
                Automatic Reply Intercept
              </h3>
              <p className="text-[14px] text-[#8A8F98] leading-relaxed">
                Smart reply detection scans inbound threads in real-time. The moment a human replies, scheduled follow-ups are disengaged instantly.
              </p>
            </div>

            <div className="linear-card p-6">
              <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center mb-5">
                <ShieldCheck className="w-5 h-5 text-[#5E6AD2]" />
              </div>
              <h3 className="text-[16px] font-medium text-[#FFFFFF] mb-2">
                Draft-First Safety Mode
              </h3>
              <p className="text-[14px] text-[#8A8F98] leading-relaxed">
                Stage follow-ups as native Gmail drafts instead of sending directly. Inspect, personalize, or edit before releasing with complete peace of mind.
              </p>
            </div>

            <div className="linear-card p-6">
              <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center mb-5">
                <Sliders className="w-5 h-5 text-[#F91880]" />
              </div>
              <h3 className="text-[16px] font-medium text-[#FFFFFF] mb-2">
                Strict Business-Day Cadences
              </h3>
              <p className="text-[14px] text-[#8A8F98] leading-relaxed">
                Dispatches strictly during morning business hours (9:00 AM recipient time), skipping weekends and preventing unseemly midnight alerts.
              </p>
            </div>
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-[rgba(255,255,255,0.05)] py-8 px-6 sm:px-12 text-center text-[13px] text-[#62666D]">
          Built with Linear design principles. Encrypted Gmail API integration.
        </footer>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED STATE — Linear Dashboard & Workflow Engine
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#08090A] text-[#F7F8F8] selection:bg-[#5E6AD2]/30 flex flex-col font-sans">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg border text-[13px] font-medium shadow-[rgba(0,0,0,0.6)_0px_8px_24px] flex items-center gap-2.5 transition-all ${
            toastMsg.type === 'success'
              ? 'bg-[#0F1011] border-[rgba(0,186,124,0.3)] text-[#F7F8F8]'
              : toastMsg.type === 'error'
              ? 'bg-[#0F1011] border-[rgba(249,24,128,0.3)] text-[#F7F8F8]'
              : 'bg-[#0F1011] border-[rgba(255,255,255,0.1)] text-[#F7F8F8]'
          }`}
        >
          {toastMsg.type === 'success' && <span className="w-2 h-2 rounded-full bg-[#00BA7C]" />}
          {toastMsg.type === 'error' && <span className="w-2 h-2 rounded-full bg-[#F91880]" />}
          {toastMsg.type === 'info' && <span className="w-2 h-2 rounded-full bg-[#5E6AD2]" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Linear Sticky Header */}
      <header className="h-16 border-b border-[rgba(255,255,255,0.05)] bg-[#08090A]/90 backdrop-blur-md sticky top-0 z-40 px-6 sm:px-8 flex items-center justify-between">
        {/* Brand Monogram */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0F1011] border border-[rgba(255,255,255,0.08)] flex items-center justify-center">
            <Mail className="w-4 h-4 text-[#F7F8F8]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-[#FFFFFF] tracking-tight">
              Auto Follow-Up
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#18191A] text-[#8A8F98] border border-[rgba(255,255,255,0.04)]">
              WORKSPACE
            </span>
          </div>
        </div>

        {/* Linear Segmented Pill Nav */}
        <nav className="hidden md:flex items-center p-1 bg-[#0F1011] border border-[rgba(255,255,255,0.05)] rounded-full gap-0.5">
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-3.5 py-1 rounded-full text-[13px] font-medium transition-all ${
              activeTab === 'emails'
                ? 'bg-[rgba(255,255,255,0.08)] text-[#FFFFFF] shadow-sm'
                : 'text-[#8A8F98] hover:text-[#F7F8F8]'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-3.5 py-1 rounded-full text-[13px] font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'upcoming'
                ? 'bg-[rgba(255,255,255,0.08)] text-[#FFFFFF] shadow-sm'
                : 'text-[#8A8F98] hover:text-[#F7F8F8]'
            }`}
          >
            <span>Upcoming</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#18191A] text-[#8A8F98]">
              {upcoming.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3.5 py-1 rounded-full text-[13px] font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'templates'
                ? 'bg-[rgba(255,255,255,0.08)] text-[#FFFFFF] shadow-sm'
                : 'text-[#8A8F98] hover:text-[#F7F8F8]'
            }`}
          >
            <span>Templates</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#18191A] text-[#8A8F98]">
              {templates.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1 rounded-full text-[13px] font-medium transition-all ${
              activeTab === 'settings'
                ? 'bg-[rgba(255,255,255,0.08)] text-[#FFFFFF] shadow-sm'
                : 'text-[#8A8F98] hover:text-[#F7F8F8]'
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Header Right Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="linear-btn-primary h-8 px-3.5 flex items-center gap-2 text-[13px] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#5E6AD2] ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Gmail'}</span>
          </button>

          <div className="h-4 w-px bg-[rgba(255,255,255,0.08)]" />

          {/* User Email Pill */}
          <div className="flex items-center gap-2 text-[12px] text-[#8A8F98]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00BA7C]" />
            <span className="hidden sm:inline font-mono">{currentUser?.email}</span>
          </div>

          <button
            onClick={async () => {
              await api.logout();
              setCurrentUser(null);
            }}
            title="Log Out"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A8F98] hover:text-[#F91880] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Container — 1440px max-width conforming to Linear layout */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 sm:px-8 py-8 space-y-8">
        {/* Metric Cards Banner — 5 Columns, Linear Dark Cards with 8px radius */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Sent */}
          <div className="linear-card p-5">
            <div className="text-[12px] text-[#8A8F98] font-medium flex items-center justify-between mb-2">
              <span>Tracked Sent</span>
              <Inbox className="w-3.5 h-3.5 text-[#62666D]" />
            </div>
            <div className="text-[26px] font-semibold tracking-tight text-[#FFFFFF]">
              {stats.sentCount ?? 0}
            </div>
            <div className="text-[11px] text-[#62666D] mt-1.5">Outbound threads monitored</div>
          </div>

          {/* 2. Waiting */}
          <div className="linear-card p-5 border-[rgba(245,158,11,0.15)]">
            <div className="text-[12px] text-[#F59E0B] font-medium flex items-center justify-between mb-2">
              <span>Waiting for Reply</span>
              <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
            </div>
            <div className="text-[26px] font-semibold tracking-tight text-[#F59E0B]">
              {stats.waitingCount ?? 0}
            </div>
            <div className="text-[11px] text-[#62666D] mt-1.5">Pending response cadence</div>
          </div>

          {/* 3. Replied */}
          <div className="linear-card p-5 border-[rgba(0,186,124,0.15)]">
            <div className="text-[12px] text-[#00BA7C] font-medium flex items-center justify-between mb-2">
              <span>Replied & Stopped</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00BA7C]" />
            </div>
            <div className="text-[26px] font-semibold tracking-tight text-[#00BA7C]">
              {stats.repliedCount ?? 0}
            </div>
            <div className="text-[11px] text-[#62666D] mt-1.5">Halted without spam</div>
          </div>

          {/* 4. Due Soon */}
          <div className="linear-card p-5 border-[rgba(94,106,210,0.15)]">
            <div className="text-[12px] text-[#5E6AD2] font-medium flex items-center justify-between mb-2">
              <span>Due Soon</span>
              <Calendar className="w-3.5 h-3.5 text-[#5E6AD2]" />
            </div>
            <div className="text-[26px] font-semibold tracking-tight text-[#5E6AD2]">
              {stats.dueSoonCount ?? 0}
            </div>
            <div className="text-[11px] text-[#62666D] mt-1.5">Scheduled next 24h</div>
          </div>

          {/* 5. Bounced */}
          <div className="linear-card p-5 border-[rgba(249,24,128,0.15)]">
            <div className="text-[12px] text-[#F91880] font-medium flex items-center justify-between mb-2">
              <span>Bounced</span>
              <AlertCircle className="w-3.5 h-3.5 text-[#F91880]" />
            </div>
            <div className="text-[26px] font-semibold tracking-tight text-[#F91880]">
              {stats.bouncedCount ?? 0}
            </div>
            <div className="text-[11px] text-[#62666D] mt-1.5">Filtered delivery errors</div>
          </div>
        </section>

        {/* TAB 1: EMAILS / DASHBOARD */}
        {activeTab === 'emails' && (
          <div className="linear-card overflow-hidden">
            {/* Filter and Search Bar */}
            <div className="px-5 py-3.5 border-b border-[rgba(255,255,255,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0F1011]">
              {/* Linear Status Pill Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'WAITING', 'REPLIED', 'COMPLETED', 'STOPPED', 'BOUNCED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`h-7 px-3 rounded-full text-[12px] font-medium transition-all ${
                      statusFilter === st
                        ? 'bg-[rgba(255,255,255,0.1)] text-[#FFFFFF] border border-[rgba(255,255,255,0.12)]'
                        : 'text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[rgba(255,255,255,0.03)]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#62666D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter by subject or recipient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="linear-input h-8 pl-8 pr-3 w-full sm:w-64 text-[12px]"
                />
              </div>
            </div>

            {/* Linear Threads Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#141517] text-[#8A8F98] text-[10px] uppercase font-medium tracking-[0.05em] border-b border-[rgba(255,255,255,0.05)]">
                  <tr>
                    <th className="py-3 px-5">Recipient</th>
                    <th className="py-3 px-5">Subject</th>
                    <th className="py-3 px-5">Sent Date</th>
                    <th className="py-3 px-5">Cadence Status</th>
                    <th className="py-3 px-5">Touchpoints</th>
                    <th className="py-3 px-5">Next Follow-Up</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {filteredThreads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-[#8A8F98]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Inbox className="w-6 h-6 text-[#62666D]" />
                          <span className="text-[14px] text-[#F7F8F8]">No matching email threads</span>
                          <span className="text-[12px] text-[#62666D]">
                            Sync your Gmail account or adjust filter filters to view tracked messages.
                          </span>
                          <button
                            onClick={handleSync}
                            className="linear-btn-primary h-8 px-3.5 mt-2 text-[12px]"
                          >
                            Sync Gmail Now
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredThreads.map((thread) => (
                      <tr
                        key={thread.id}
                        onClick={() => handleOpenThread(thread.id)}
                        className="hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer group"
                      >
                        {/* Recipient */}
                        <td className="py-3.5 px-5 max-w-[220px] truncate">
                          <div className="font-medium text-[#F7F8F8] truncate">
                            {thread.recipientName || thread.recipientEmail}
                          </div>
                          {thread.recipientName && (
                            <div className="text-[11px] text-[#62666D] font-mono truncate">
                              {thread.recipientEmail}
                            </div>
                          )}
                        </td>

                        {/* Subject */}
                        <td className="py-3.5 px-5 text-[#D0D6E0] max-w-[300px] truncate">
                          <span className="hover:text-[#FFFFFF] transition-colors">
                            {thread.subject || '(No Subject)'}
                          </span>
                        </td>

                        {/* Sent At */}
                        <td className="py-3.5 px-5 text-[#8A8F98] whitespace-nowrap text-[12px]">
                          {thread.sentAt ? new Date(thread.sentAt).toLocaleDateString() : '—'}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          {thread.status === 'WAITING' && (
                            <span className="linear-badge bg-[rgba(245,158,11,0.08)] text-[#F59E0B] border-[rgba(245,158,11,0.2)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                              WAITING
                            </span>
                          )}
                          {thread.status === 'REPLIED' && (
                            <span className="linear-badge bg-[rgba(0,186,124,0.08)] text-[#00BA7C] border-[rgba(0,186,124,0.2)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00BA7C]" />
                              REPLIED
                            </span>
                          )}
                          {thread.status === 'BOUNCED' && (
                            <span className="linear-badge bg-[rgba(249,24,128,0.08)] text-[#F91880] border-[rgba(249,24,128,0.2)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#F91880]" />
                              BOUNCED
                            </span>
                          )}
                          {thread.status === 'STOPPED' && (
                            <span className="linear-badge bg-[rgba(255,255,255,0.04)] text-[#8A8F98] border-[rgba(255,255,255,0.06)]">
                              STOPPED
                            </span>
                          )}
                          {thread.status === 'COMPLETED' && (
                            <span className="linear-badge bg-[rgba(94,106,210,0.08)] text-[#5E6AD2] border-[rgba(94,106,210,0.2)]">
                              COMPLETED
                            </span>
                          )}
                        </td>

                        {/* Follow-up count */}
                        <td className="py-3.5 px-5 text-[#8A8F98] whitespace-nowrap font-mono text-[12px]">
                          {thread.followUpCount} / {thread.maxFollowUps}
                        </td>

                        {/* Next Scheduled */}
                        <td className="py-3.5 px-5 whitespace-nowrap text-[12px]">
                          {thread.nextFollowUpAt ? (
                            <div className="flex items-center gap-1.5 text-[#5E6AD2]">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(thread.nextFollowUpAt).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#3E3E44]">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td
                          className="py-3.5 px-5 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            {thread.status === 'WAITING' && (
                              <>
                                <button
                                  onClick={() =>
                                    handleToggleAutomation(thread.id, thread.followUpEnabled)
                                  }
                                  disabled={actionLoading === thread.id}
                                  title={thread.followUpEnabled ? 'Pause Automation' : 'Resume Automation'}
                                  className="w-7 h-7 rounded-full bg-[#18191A] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.05)] flex items-center justify-center text-[#8A8F98] hover:text-[#FFFFFF] transition-colors"
                                >
                                  {thread.followUpEnabled ? (
                                    <Pause className="w-3 h-3 text-[#F59E0B]" />
                                  ) : (
                                    <Play className="w-3 h-3 text-[#00BA7C]" />
                                  )}
                                </button>

                                <button
                                  onClick={() => handleSendNow(thread.id)}
                                  disabled={actionLoading === thread.id}
                                  title="Send Follow-Up Now"
                                  className="w-7 h-7 rounded-full bg-[#18191A] hover:bg-[#5E6AD2] border border-[rgba(255,255,255,0.05)] flex items-center justify-center text-[#5E6AD2] hover:text-[#FFFFFF] transition-colors disabled:opacity-50"
                                >
                                  {actionLoading === thread.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-[#FFFFFF]" />
                                  ) : (
                                    <Send className="w-3 h-3" />
                                  )}
                                </button>

                                <button
                                  onClick={() => handleStopAutomation(thread.id)}
                                  disabled={actionLoading === thread.id}
                                  title="Stop Permanently"
                                  className="w-7 h-7 rounded-full bg-[#18191A] hover:bg-[#F91880] border border-[rgba(255,255,255,0.05)] flex items-center justify-center text-[#62666D] hover:text-[#FFFFFF] transition-colors"
                                >
                                  <XCircle className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: UPCOMING SCHEDULE */}
        {activeTab === 'upcoming' && (
          <div className="linear-card p-6">
            <div className="pb-5 border-b border-[rgba(255,255,255,0.05)] mb-6">
              <h2 className="text-[18px] font-medium text-[#FFFFFF]">Upcoming Follow-Up Queue</h2>
              <p className="text-[13px] text-[#8A8F98] mt-1">
                Deterministic follow-ups scheduled for automatic dispatch during morning recipient hours.
              </p>
            </div>

            {upcoming.length === 0 ? (
              <div className="text-center py-16 text-[#8A8F98]">
                <Clock className="w-6 h-6 text-[#62666D] mx-auto mb-2" />
                <div className="text-[14px] text-[#F7F8F8]">No follow-ups currently queued</div>
                <div className="text-[12px] text-[#62666D] mt-1">
                  Once sent emails reach their target business delay, they will appear here.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg bg-[#141517] border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.08)] flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-lg bg-[rgba(94,106,210,0.08)] border border-[rgba(94,106,210,0.2)] flex items-center justify-center text-[#5E6AD2]">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-[#FFFFFF] text-[14px]">
                          {item.recipientEmail}
                        </div>
                        <div className="text-[12px] text-[#8A8F98]">{item.subject}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-[13px] font-medium text-[#5E6AD2]">
                          {new Date(item.nextFollowUpAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-[11px] font-mono text-[#62666D]">
                          Attempt #{item.followUpCount + 1}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSendNow(item.id)}
                        disabled={actionLoading === item.id}
                        className="linear-btn-indigo h-8 px-3.5 flex items-center gap-1.5 text-[12px] disabled:opacity-50"
                      >
                        {actionLoading === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Send Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="linear-card p-6">
            <div className="flex items-center justify-between pb-5 border-b border-[rgba(255,255,255,0.05)] mb-6">
              <div>
                <h2 className="text-[18px] font-medium text-[#FFFFFF]">Cadence Templates</h2>
                <p className="text-[13px] text-[#8A8F98] mt-1">
                  Engineered follow-up templates with automated token substitution.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingTemplate({ name: '', subject: '', body: '', isDefault: false });
                  setIsTemplateModalOpen(true);
                }}
                className="linear-btn-secondary h-8 px-4 flex items-center gap-1.5 text-[13px]"
              >
                <FileText className="w-3.5 h-3.5" />
                New Template
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-5 rounded-lg bg-[#141517] border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.08)] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="font-medium text-[#FFFFFF] text-[14px]">{tmpl.name}</h3>
                      {tmpl.isDefault && (
                        <span className="linear-badge bg-[rgba(0,186,124,0.08)] text-[#00BA7C] border-[rgba(0,186,124,0.2)]">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] font-mono text-[#5E6AD2] mb-3 bg-[#08090A] px-3 py-1.5 rounded border border-[rgba(255,255,255,0.04)]">
                      Subject: {tmpl.subject}
                    </div>
                    <pre className="text-[12px] text-[#8A8F98] whitespace-pre-wrap font-sans bg-[#08090A] p-3.5 rounded border border-[rgba(255,255,255,0.04)] max-h-36 overflow-y-auto leading-relaxed">
                      {tmpl.body}
                    </pre>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-[rgba(255,255,255,0.04)] flex items-center justify-between text-[12px]">
                    {!tmpl.isDefault ? (
                      <button
                        onClick={async () => {
                          await api.setDefaultTemplate(tmpl.id);
                          await loadData();
                          showToast('Template set as workspace default', 'success');
                        }}
                        className="text-[#8A8F98] hover:text-[#00BA7C] transition-colors"
                      >
                        Set as Default
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#62666D]">Primary Dispatch</span>
                    )}

                    <div className="flex items-center gap-3 ml-auto">
                      <button
                        onClick={() => {
                          setEditingTemplate(tmpl);
                          setIsTemplateModalOpen(true);
                        }}
                        className="text-[#8A8F98] hover:text-[#FFFFFF] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Delete this template?')) {
                            await api.deleteTemplate(tmpl.id);
                            await loadData();
                            showToast('Template deleted', 'info');
                          }
                        }}
                        className="text-[#62666D] hover:text-[#F91880] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="linear-card p-6 max-w-2xl mx-auto">
            <div className="pb-5 border-b border-[rgba(255,255,255,0.05)] mb-6">
              <h2 className="text-[18px] font-medium text-[#FFFFFF]">Cadence Engine Parameters</h2>
              <p className="text-[13px] text-[#8A8F98] mt-1">
                Configure timing delays, dispatch limits, and safety interception settings.
              </p>
            </div>

            {settings && (
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[#F7F8F8]">
                    First Follow-Up Interval (Business Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.defaultFirstFollowUpDays || 3}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultFirstFollowUpDays: parseInt(e.target.value, 10) })
                    }
                    className="linear-input h-9 px-3 w-full"
                  />
                  <p className="text-[11px] text-[#62666D]">
                    Delay between outbound message and first cadence check.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[#F7F8F8]">
                    Second Follow-Up Interval (Business Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.defaultSecondFollowUpDays || 5}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultSecondFollowUpDays: parseInt(e.target.value, 10) })
                    }
                    className="linear-input h-9 px-3 w-full"
                  />
                  <p className="text-[11px] text-[#62666D]">
                    Additional delay before touchpoint #2 if no reply received.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[#F7F8F8]">
                    Maximum Cadence Cap
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={settings.defaultMaxFollowUps || 2}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultMaxFollowUps: parseInt(e.target.value, 10) })
                    }
                    className="linear-input h-9 px-3 w-full"
                  />
                  <p className="text-[11px] text-[#62666D]">
                    Strict ceiling on follow-up emails sent to a single recipient.
                  </p>
                </div>

                <div className="pt-3 border-t border-[rgba(255,255,255,0.05)] space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoTrackSentEmails || false}
                      onChange={(e) =>
                        setSettings({ ...settings, autoTrackSentEmails: e.target.checked })
                      }
                      className="mt-0.5 rounded bg-[#18191A] border-[rgba(255,255,255,0.1)] text-[#5E6AD2]"
                    />
                    <div>
                      <div className="text-[13px] font-medium text-[#FFFFFF]">
                        Continuous Sentinel Polling
                      </div>
                      <div className="text-[11px] text-[#62666D]">
                        Automatically poll sent box every 5 minutes to capture new outreach threads.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoEnableFollowUp || false}
                      onChange={(e) =>
                        setSettings({ ...settings, autoEnableFollowUp: e.target.checked })
                      }
                      className="mt-0.5 rounded bg-[#18191A] border-[rgba(255,255,255,0.1)] text-[#5E6AD2]"
                    />
                    <div>
                      <div className="text-[13px] font-medium text-[#FFFFFF]">
                        Auto-Engage Cadence by Default
                      </div>
                      <div className="text-[11px] text-[#62666D]">
                        Activate follow-up tracking immediately upon sync without requiring manual opt-in.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.createAsDraft || false}
                      onChange={(e) =>
                        setSettings({ ...settings, createAsDraft: e.target.checked })
                      }
                      className="mt-0.5 rounded bg-[#18191A] border-[rgba(255,255,255,0.1)] text-[#5E6AD2]"
                    />
                    <div>
                      <div className="text-[13px] font-medium text-[#FFFFFF] flex items-center gap-2">
                        <span>Draft-First Review Mode</span>
                        <span className="linear-badge bg-[rgba(0,186,124,0.08)] text-[#00BA7C] border-[rgba(0,186,124,0.2)]">
                          RECOMMENDED
                        </span>
                      </div>
                      <div className="text-[11px] text-[#62666D]">
                        Staging follow-ups as native Gmail drafts for human confirmation before dispatch.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="pt-4 border-t border-[rgba(255,255,255,0.05)]">
                  <button
                    type="submit"
                    className="linear-btn-secondary w-full h-10 flex items-center justify-center text-[13px] font-medium"
                  >
                    Save Engine Configuration
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* THREAD DETAIL MODAL / DRAWER (Linear High-Elevation Layering) */}
      {selectedThread && (
        <div className="fixed inset-0 z-50 bg-[#08090A]/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-[#0F1011] border-l border-[rgba(255,255,255,0.08)] h-full p-6 flex flex-col justify-between shadow-[rgba(0,0,0,0.6)_0px_0px_0px_1px,rgba(0,0,0,0.1)_0px_4px_4px_0px] overflow-y-auto">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.05)]">
                <div>
                  <span className="text-[10px] text-[#62666D] font-mono">
                    THREAD // {selectedThread.id}
                  </span>
                  <h3 className="text-[16px] font-medium text-[#FFFFFF] mt-1 leading-snug">
                    {selectedThread.subject || '(No Subject)'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedThread(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#8A8F98] hover:text-[#FFFFFF] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Recipient & Status Strip */}
              <div className="py-4 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between text-[12px]">
                <div>
                  <span className="text-[#8A8F98]">Recipient: </span>
                  <span className="text-[#F7F8F8] font-medium">
                    {selectedThread.recipientName || selectedThread.recipientEmail}
                  </span>
                </div>
                <div>
                  {selectedThread.status === 'WAITING' && (
                    <span className="linear-badge bg-[rgba(245,158,11,0.08)] text-[#F59E0B] border-[rgba(245,158,11,0.2)]">
                      WAITING
                    </span>
                  )}
                  {selectedThread.status === 'REPLIED' && (
                    <span className="linear-badge bg-[rgba(0,186,124,0.08)] text-[#00BA7C] border-[rgba(0,186,124,0.2)]">
                      REPLIED
                    </span>
                  )}
                  {selectedThread.status === 'BOUNCED' && (
                    <span className="linear-badge bg-[rgba(249,24,128,0.08)] text-[#F91880] border-[rgba(249,24,128,0.2)]">
                      BOUNCED
                    </span>
                  )}
                  {selectedThread.status === 'STOPPED' && (
                    <span className="linear-badge bg-[rgba(255,255,255,0.04)] text-[#8A8F98] border-[rgba(255,255,255,0.06)]">
                      STOPPED
                    </span>
                  )}
                </div>
              </div>

              {/* Message Timeline */}
              <div className="py-5 space-y-3.5">
                <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#62666D]">
                  Conversation Messages
                </div>

                {selectedThread.messages?.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-lg border text-[12px] ${
                      msg.direction === 'SENT'
                        ? 'bg-[#141517] border-[rgba(255,255,255,0.04)] ml-3'
                        : 'bg-[#18191A] border-[rgba(94,106,210,0.25)] mr-3'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 text-[11px] text-[#8A8F98]">
                      <span className="font-medium text-[#F7F8F8]">
                        {msg.direction === 'SENT' ? 'You' : msg.senderEmail}
                      </span>
                      <span>{new Date(msg.sentAt).toLocaleString()}</span>
                    </div>
                    {msg.isAutoReply && (
                      <span className="linear-badge bg-[rgba(245,158,11,0.08)] text-[#F59E0B] border-[rgba(245,158,11,0.2)] mb-2">
                        Out-of-Office / Auto-Reply Filtered
                      </span>
                    )}
                    <p className="text-[#8A8F98] leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.snippet || '(Message body)'}
                    </p>
                  </div>
                ))}
              </div>

              {/* Scheduled parameters */}
              <div className="pt-4 border-t border-[rgba(255,255,255,0.05)] space-y-2 text-[12px]">
                <div className="flex justify-between text-[#8A8F98]">
                  <span>Follow-Up Attempts:</span>
                  <span className="text-[#F7F8F8] font-mono">
                    {selectedThread.followUpCount} / {selectedThread.maxFollowUps}
                  </span>
                </div>
                <div className="flex justify-between text-[#8A8F98]">
                  <span>Next Scheduled Touchpoint:</span>
                  <span className="text-[#5E6AD2]">
                    {selectedThread.nextFollowUpAt
                      ? new Date(selectedThread.nextFollowUpAt).toLocaleString()
                      : 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-6 border-t border-[rgba(255,255,255,0.05)] flex items-center justify-end gap-2.5">
              {selectedThread.status === 'WAITING' && (
                <>
                  <button
                    onClick={() =>
                      handleToggleAutomation(selectedThread.id, selectedThread.followUpEnabled)
                    }
                    className="linear-btn-primary h-9 px-4 text-[13px]"
                  >
                    {selectedThread.followUpEnabled ? 'Pause Cadence' : 'Resume Cadence'}
                  </button>
                  <button
                    onClick={() => handleSendNow(selectedThread.id)}
                    disabled={actionLoading === selectedThread.id}
                    className="linear-btn-indigo h-9 px-4 text-[13px] flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoading === selectedThread.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Send Follow-Up Now
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE EDIT MODAL */}
      {isTemplateModalOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 bg-[#08090A]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0F1011] border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-[rgba(0,0,0,0.6)_0px_20px_50px] space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(255,255,255,0.05)]">
              <h3 className="font-medium text-[#FFFFFF] text-[16px]">
                {editingTemplate.id ? 'Edit Cadence Template' : 'Create Cadence Template'}
              </h3>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#8A8F98] hover:text-[#FFFFFF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-[13px]">
              <div>
                <label className="text-[#F7F8F8] font-medium block mb-1.5">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Executive Follow-Up #1"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="linear-input h-9 px-3 w-full"
                />
              </div>

              <div>
                <label className="text-[#F7F8F8] font-medium block mb-1.5">Subject</label>
                <input
                  type="text"
                  placeholder="Re: {{originalSubject}}"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  className="linear-input h-9 px-3 w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[#F7F8F8] font-medium">Message Body</label>
                  <span className="text-[11px] text-[#62666D]">Insert variable:</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {['{{recipientName}}', '{{company}}', '{{position}}', '{{senderName}}'].map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() =>
                        setEditingTemplate({
                          ...editingTemplate,
                          body: (editingTemplate.body || '') + ' ' + v,
                        })
                      }
                      className="px-2 py-0.5 rounded bg-[#18191A] text-[11px] font-mono text-[#5E6AD2] hover:bg-[#5E6AD2] hover:text-[#FFFFFF] transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={6}
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  className="linear-input p-3 w-full leading-relaxed"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editingTemplate.isDefault || false}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, isDefault: e.target.checked })
                  }
                  className="rounded bg-[#18191A] border-[rgba(255,255,255,0.1)] text-[#5E6AD2]"
                />
                <span className="text-[#8A8F98]">Set as default template for new outreach</span>
              </label>
            </div>

            <div className="pt-4 border-t border-[rgba(255,255,255,0.05)] flex justify-end gap-2.5 text-[13px]">
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="linear-btn-ghost h-8 px-4"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (editingTemplate.id) {
                    await api.updateTemplate(editingTemplate.id, editingTemplate);
                    showToast('Template updated', 'success');
                  } else {
                    await api.createTemplate(editingTemplate);
                    showToast('Template created', 'success');
                  }
                  setIsTemplateModalOpen(false);
                  await loadData();
                }}
                className="linear-btn-secondary h-8 px-4 font-medium"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  User,
  Inbox,
  Calendar,
  Layers,
  ArrowRight,
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

      setStats(statsRes.stats);
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
      await api.syncEmails();
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Sync failed');
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
      } else {
        await api.enableFollowUp(threadId);
      }
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Stop Automation Permanently
  const handleStopAutomation = async (threadId: string) => {
    if (!confirm('Are you sure you want to permanently stop all follow-ups for this email?')) return;
    setActionLoading(threadId);
    try {
      await api.stopFollowUp(threadId);
      await loadData();
      if (selectedThread?.id === threadId) {
        const detail = await api.getEmailDetails(threadId);
        setSelectedThread(detail.thread);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Trigger Send Follow-up Now
  const handleSendNow = async (threadId: string) => {
    if (!confirm('Send follow-up email immediately through Gmail?')) return;
    setActionLoading(threadId);
    try {
      await api.sendFollowUpNow(threadId);
      alert('Follow-up sent successfully!');
      await loadData();
      if (selectedThread?.id === threadId) {
        const detail = await api.getEmailDetails(threadId);
        setSelectedThread(detail.thread);
      }
    } catch (err: any) {
      alert(err.message);
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
      alert(err.message);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSettings(settings);
      alert('Settings saved successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtered Threads
  const filteredThreads = threads.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      t.subject?.toLowerCase().includes(q) ||
      t.recipientEmail?.toLowerCase().includes(q) ||
      t.recipientName?.toLowerCase().includes(q);
    return matchesQuery;
  });

  // Render Unauthenticated State
  if (!loadingUser && !currentUser) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-500/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="max-w-md w-full bg-[#11131c] border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative z-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/25">
            <Mail className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Auto Email Follow-Up
          </h1>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Personal follow-up automation for Gmail. Detects sent emails, tracks replies, and automatically stops when you get a response.
          </p>

          <a
            href={api.getGoogleAuthUrl()}
            className="w-full py-3.5 px-6 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-white/10 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            Connect with Google
          </a>

          <a
            href="http://localhost:4000/auth/dev-login"
            id="demo-mode-btn"
            className="mt-3 w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-2 border border-slate-700/60 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Enter Demo Mode (Pre-seeded Workspace)
          </a>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Zero database leaks — AES-256 encrypted at rest
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 bg-[#11131c]/70 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-semibold text-white tracking-tight">Auto Follow-Up</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Personal
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <nav className="hidden md:flex items-center gap-1 bg-[#181a26] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'emails'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'upcoming'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'templates'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1e2235] hover:bg-[#272c44] border border-slate-700/60 text-slate-200 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Gmail'}
          </button>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="hidden sm:inline font-mono">{currentUser?.email}</span>
          </div>

          <button
            onClick={async () => {
              await api.logout();
              setCurrentUser(null);
            }}
            title="Log Out"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-[#11131c] border border-slate-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="text-xs text-slate-400 font-medium mb-1 flex items-center justify-between">
              Sent Threads
              <Inbox className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.sentCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Tracked outbound emails</div>
          </div>

          <div className="bg-[#11131c] border border-amber-500/20 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="text-xs text-amber-400/90 font-medium mb-1 flex items-center justify-between">
              Waiting for Reply
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">{stats.waitingCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Pending recipient response</div>
          </div>

          <div className="bg-[#11131c] border border-emerald-500/20 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="text-xs text-emerald-400/90 font-medium mb-1 flex items-center justify-between">
              Replied
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{stats.repliedCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Automation stopped safely</div>
          </div>

          <div className="bg-[#11131c] border border-indigo-500/20 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="text-xs text-indigo-400 font-medium mb-1 flex items-center justify-between">
              Due Soon
              <Calendar className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-indigo-400">{stats.dueSoonCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Scheduled in next 24h</div>
          </div>

          <div className="bg-[#11131c] border border-rose-500/20 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="text-xs text-rose-400/90 font-medium mb-1 flex items-center justify-between">
              Bounced
              <AlertCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400">{stats.bouncedCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Delivery errors filtered</div>
          </div>
        </div>

        {/* TAB 1: EMAILS / DASHBOARD */}
        {activeTab === 'emails' && (
          <div className="bg-[#11131c] border border-slate-800/80 rounded-2xl overflow-hidden shadow-md">
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'WAITING', 'REPLIED', 'COMPLETED', 'STOPPED', 'BOUNCED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      statusFilter === st
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#181a26] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search subject or recipient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#181a26] border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-full sm:w-64"
                />
              </div>
            </div>

            {/* Threads Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141724] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Sent At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Follow-Up Count</th>
                    <th className="py-3 px-4">Next Follow-Up</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredThreads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        No email threads found. Click "Sync Gmail" to pull recently sent emails!
                      </td>
                    </tr>
                  ) : (
                    filteredThreads.map((thread) => (
                      <tr
                        key={thread.id}
                        onClick={() => handleOpenThread(thread.id)}
                        className="hover:bg-[#181a26]/70 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-medium text-white max-w-[200px] truncate">
                          <div>{thread.recipientName || thread.recipientEmail}</div>
                          {thread.recipientName && (
                            <div className="text-[10px] text-slate-500">{thread.recipientEmail}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-[280px] truncate font-medium">
                          {thread.subject}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {new Date(thread.sentAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              thread.status === 'WAITING'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : thread.status === 'REPLIED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : thread.status === 'BOUNCED'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-slate-700/20 text-slate-400 border-slate-700/40'
                            }`}
                          >
                            {thread.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {thread.followUpCount} / {thread.maxFollowUps}
                        </td>
                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                          {thread.nextFollowUpAt ? (
                            <div className="flex items-center gap-1.5 text-indigo-400">
                              <Clock className="w-3 h-3" />
                              {new Date(thread.nextFollowUpAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {thread.status === 'WAITING' && (
                              <>
                                <button
                                  onClick={() => handleToggleAutomation(thread.id, thread.followUpEnabled)}
                                  disabled={actionLoading === thread.id}
                                  title={thread.followUpEnabled ? 'Pause Automation' : 'Resume Automation'}
                                  className="p-1.5 rounded-lg bg-[#1e2235] hover:bg-[#272c44] text-slate-300 transition-all"
                                >
                                  {thread.followUpEnabled ? (
                                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleSendNow(thread.id)}
                                  disabled={actionLoading === thread.id}
                                  title="Send Follow-Up Now"
                                  className="p-1.5 rounded-lg bg-[#1e2235] hover:bg-indigo-600 text-indigo-400 hover:text-white transition-all"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleStopAutomation(thread.id)}
                                  disabled={actionLoading === thread.id}
                                  title="Stop Permanently"
                                  className="p-1.5 rounded-lg bg-[#1e2235] hover:bg-rose-600 text-slate-400 hover:text-white transition-all"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
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
          <div className="bg-[#11131c] border border-slate-800/80 rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold text-white mb-1">Upcoming Follow-Up Queue</h2>
            <p className="text-xs text-slate-400 mb-6">
              Automated messages scheduled to dispatch during morning business hours.
            </p>

            {upcoming.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No follow-ups currently scheduled. Enable follow-ups on an email to schedule one!
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-[#141724] border border-slate-800/80 hover:border-indigo-500/40 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm">{item.recipientEmail}</div>
                        <div className="text-xs text-slate-400">{item.subject}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-xs font-semibold text-indigo-400">
                          {new Date(item.nextFollowUpAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-500">Attempt #{item.followUpCount + 1}</div>
                      </div>

                      <button
                        onClick={() => handleSendNow(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
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
          <div className="bg-[#11131c] border border-slate-800/80 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Follow-Up Templates</h2>
                <p className="text-xs text-slate-400">
                  Customizable templates with automatic variable substitution.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingTemplate({ name: '', subject: '', body: '', isDefault: false });
                  setIsTemplateModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
              >
                <FileText className="w-4 h-4" />
                New Template
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-5 rounded-2xl bg-[#141724] border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-white text-sm">{tmpl.name}</h3>
                      {tmpl.isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-indigo-400 mb-3 bg-[#181a26] px-2.5 py-1 rounded-md border border-slate-800">
                      Subject: {tmpl.subject}
                    </div>
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans bg-[#0c0d14] p-3 rounded-xl border border-slate-800/60 max-h-40 overflow-y-auto">
                      {tmpl.body}
                    </pre>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                    {!tmpl.isDefault && (
                      <button
                        onClick={async () => {
                          await api.setDefaultTemplate(tmpl.id);
                          await loadData();
                        }}
                        className="text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        Set as Default
                      </button>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => {
                          setEditingTemplate(tmpl);
                          setIsTemplateModalOpen(true);
                        }}
                        className="text-slate-400 hover:text-indigo-400 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Delete this template?')) {
                            await api.deleteTemplate(tmpl.id);
                            await loadData();
                          }
                        }}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
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
          <div className="bg-[#11131c] border border-slate-800/80 rounded-2xl p-6 shadow-md max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold text-white mb-1">Automation Settings</h2>
            <p className="text-xs text-slate-400 mb-6">
              Configure intervals and automatic tracking behavior.
            </p>

            {settings && (
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    First Follow-Up Delay (Business Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.defaultFirstFollowUpDays || 3}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultFirstFollowUpDays: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-[#181a26] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Days to wait after sending initial email before follow-up #1.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Second Follow-Up Delay (Business Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.defaultSecondFollowUpDays || 5}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultSecondFollowUpDays: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-[#181a26] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Days to wait before sending follow-up #2 if no reply.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Maximum Follow-Ups Limit</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={settings.defaultMaxFollowUps || 2}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultMaxFollowUps: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-[#181a26] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Automation halts permanently after reaching this limit.</p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoTrackSentEmails || false}
                      onChange={(e) => setSettings({ ...settings, autoTrackSentEmails: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-medium text-white">Automatically track newly sent emails</div>
                      <div className="text-[11px] text-slate-500">Sync sent emails from Gmail every 5 minutes</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoEnableFollowUp || false}
                      onChange={(e) => setSettings({ ...settings, autoEnableFollowUp: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-medium text-white">Automatically schedule follow-up by default</div>
                      <div className="text-[11px] text-slate-500">Auto-schedule follow-ups without manual button press</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.createAsDraft || false}
                      onChange={(e) => setSettings({ ...settings, createAsDraft: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-medium text-white flex items-center gap-1.5">
                        <span>Draft First Safety Mode</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          Recommended
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Create follow-up as a Gmail Draft instead of directly sending, allowing manual review
                      </div>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-md shadow-indigo-600/20"
                >
                  Save Configuration
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      {/* THREAD DETAIL MODAL / DRAWER */}
      {selectedThread && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-[#11131c] border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono">ID: {selectedThread.id}</span>
                  <h3 className="text-base font-bold text-white mt-1">{selectedThread.subject}</h3>
                </div>
                <button
                  onClick={() => setSelectedThread(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Status Header */}
              <div className="py-4 border-b border-slate-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Recipient: </span>
                  <span className="text-white font-medium">
                    {selectedThread.recipientName} ({selectedThread.recipientEmail})
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    selectedThread.status === 'WAITING'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : selectedThread.status === 'REPLIED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {selectedThread.status}
                </span>
              </div>

              {/* Message Timeline */}
              <div className="py-5 space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Conversation History
                </h4>

                {selectedThread.messages?.map((msg: any, i: number) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-xl border text-xs ${
                      msg.direction === 'SENT'
                        ? 'bg-[#181a26] border-slate-800 ml-4'
                        : 'bg-[#151c28] border-indigo-500/30 mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 text-[11px] text-slate-400">
                      <span className="font-semibold text-white">
                        {msg.direction === 'SENT' ? 'You' : msg.senderEmail}
                      </span>
                      <span>{new Date(msg.sentAt).toLocaleString()}</span>
                    </div>
                    {msg.isAutoReply && (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold mb-1">
                        Out-of-Office Auto Reply
                      </span>
                    )}
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.snippet || '(Message body)'}</p>
                  </div>
                ))}
              </div>

              {/* Follow-Up Schedule info */}
              <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Follow-Up Attempts:</span>
                  <span className="text-white font-medium">
                    {selectedThread.followUpCount} / {selectedThread.maxFollowUps}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Next Scheduled:</span>
                  <span className="text-indigo-400 font-medium">
                    {selectedThread.nextFollowUpAt
                      ? new Date(selectedThread.nextFollowUpAt).toLocaleString()
                      : 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-2">
              {selectedThread.status === 'WAITING' && (
                <>
                  <button
                    onClick={() => handleToggleAutomation(selectedThread.id, selectedThread.followUpEnabled)}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-[#1e2235] hover:bg-[#272c44] text-slate-200 transition-all"
                  >
                    {selectedThread.followUpEnabled ? 'Pause Automation' : 'Resume Automation'}
                  </button>
                  <button
                    onClick={() => handleSendNow(selectedThread.id)}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#11131c] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">
                {editingTemplate.id ? 'Edit Template' : 'Create Template'}
              </h3>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Job Follow-Up #1"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full bg-[#181a26] border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Re: {{originalSubject}}"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  className="w-full bg-[#181a26] border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Body</label>
                  <span className="text-[10px] text-slate-500">Variables available:</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {['{{recipientName}}', '{{company}}', '{{position}}', '{{senderName}}'].map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() =>
                        setEditingTemplate({
                          ...editingTemplate,
                          body: editingTemplate.body + ' ' + v,
                        })
                      }
                      className="px-2 py-0.5 rounded bg-[#1e2235] text-[10px] font-mono text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={6}
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  className="w-full bg-[#181a26] border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={editingTemplate.isDefault || false}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, isDefault: e.target.checked })
                  }
                  className="rounded text-indigo-600 bg-slate-900 border-slate-700"
                />
                <span className="text-slate-300">Set as default follow-up template</span>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (editingTemplate.id) {
                    await api.updateTemplate(editingTemplate.id, editingTemplate);
                  } else {
                    await api.createTemplate(editingTemplate);
                  }
                  setIsTemplateModalOpen(false);
                  await loadData();
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
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

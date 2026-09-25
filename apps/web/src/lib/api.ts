const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetcher<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `Request failed: ${res.statusText}`;
    try {
      const data = await res.json();
      errorMsg = data.error?.message || data.error || errorMsg;
    } catch {
      // ignore
    }
    const error: any = new Error(errorMsg);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export const api = {
  // Auth
  getMe: () => fetcher<{ user: any }>('/auth/me'),
  logout: () => fetcher<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  getGoogleAuthUrl: () => `${API_BASE}/auth/google`,

  // Dashboard & Metrics
  getDashboardStats: () => fetcher<{ stats: any }>('/dashboard/stats'),

  // Emails & Threads
  getEmails: (status?: string, page = 1) => {
    const q = new URLSearchParams({ page: String(page) });
    if (status && status !== 'ALL') q.set('status', status);
    return fetcher<{ threads: any[]; pagination: any }>(`/emails?${q.toString()}`);
  },
  getEmailDetails: (id: string) => fetcher<{ thread: any }>(`/emails/${id}`),
  syncEmails: () => fetcher<{ success: boolean; stats: any }>('/emails/sync', { method: 'POST' }),
  enableFollowUp: (id: string) => fetcher<{ success: boolean; thread: any }>(`/emails/${id}/enable`, { method: 'POST' }),
  disableFollowUp: (id: string) => fetcher<{ success: boolean; thread: any }>(`/emails/${id}/disable`, { method: 'POST' }),
  stopFollowUp: (id: string) => fetcher<{ success: boolean; thread: any }>(`/emails/${id}/stop`, { method: 'POST' }),

  // Follow-ups
  getUpcomingFollowUps: () => fetcher<{ upcoming: any[] }>('/followups/upcoming'),
  sendFollowUpNow: (threadId: string) =>
    fetcher<{ success: boolean; result: any }>(`/followups/${threadId}/send-now`, { method: 'POST' }),

  // Templates
  getTemplates: () => fetcher<{ templates: any[] }>('/templates'),
  createTemplate: (data: { name: string; subject: string; body: string; isDefault?: boolean }) =>
    fetcher<{ template: any }>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: Partial<{ name: string; subject: string; body: string; isDefault?: boolean }>) =>
    fetcher<{ template: any }>(`/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) => fetcher<{ success: boolean }>(`/templates/${id}`, { method: 'DELETE' }),
  setDefaultTemplate: (id: string) => fetcher<{ success: boolean }>(`/templates/${id}/set-default`, { method: 'POST' }),

  // Settings
  getSettings: () => fetcher<{ settings: any }>('/settings'),
  updateSettings: (data: any) => fetcher<{ settings: any }>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};

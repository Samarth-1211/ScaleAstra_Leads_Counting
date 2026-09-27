import { queryOptions } from '@tanstack/react-query';
import { CONFIG, isConfigured } from './config';

export type Stats = {
  today: string;
  todayTotal: number;
  todayByPerson: Record<string, number>;
  allTimeByPerson: Record<string, number>;
  serverTime: string;
};

export type Duplicate = {
  leadId: string;
  addedBy: string;
  business: string;
  dateAdded: string;
};

export type LeadInput = {
  addedBy: string;
  business: string;
  contactName: string;
  designation: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  businessType: string;
  leadSource: string;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public duplicate?: Duplicate,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 30_000;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  if (!isConfigured()) {
    throw new ApiError(
      'not_configured',
      'The app is not connected to the Google Sheet yet. Add the Apps Script URL in src/config.ts.',
    );
  }
  if (!navigator.onLine) {
    throw new ApiError('offline', "You're offline. Check your internet connection and try again.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError(
      'network',
      controller.signal.aborted
        ? 'The server took too long to reply. Check your internet and try again.'
        : "Couldn't reach the server. Check your internet and try again.",
    );
  } finally {
    clearTimeout(timer);
  }

  let data: { ok: boolean; error?: string; message?: string; duplicate?: Duplicate };
  try {
    data = await res.json();
  } catch {
    throw new ApiError('server_error', 'The server sent an unexpected reply. Please try again.');
  }
  if (!data.ok) {
    throw new ApiError(data.error ?? 'server_error', data.message ?? 'Something went wrong.', data.duplicate);
  }
  return data as T;
}

function getUrl(params: Record<string, string>) {
  const q = new URLSearchParams({ passcode: CONFIG.PASSCODE, ...params, t: String(Date.now()) });
  return `${CONFIG.APPS_SCRIPT_URL}?${q}`;
}

export const fetchStats = () => request<Stats>(getUrl({}));

export const checkPhone = (phone: string) =>
  request<{ duplicate: Duplicate | null }>(getUrl({ action: 'check', phone }));

/** Sent as text/plain so the browser skips the CORS preflight Apps Script can't answer. */
export const saveLead = (lead: LeadInput) =>
  request<Stats & { leadId: string }>(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ passcode: CONFIG.PASSCODE, lead }),
  });

/** Shared by the header and leaderboard, so they read the same cached data. */
export const statsQuery = queryOptions({
  queryKey: ['stats'],
  queryFn: fetchStats,
  enabled: isConfigured(),
  refetchInterval: CONFIG.REFRESH_SECONDS * 1000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
});

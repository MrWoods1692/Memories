import { API_BASE_URL } from './config';

const TOKEN_KEY = 'admin_token';

function token(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const t = token();
  const h: Record<string, string> = { ...extra };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const r = await fetch(API_BASE_URL + path, { headers: headers() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  try { return JSON.parse(text) as T; } catch { return text as T; }
}

export async function apiPost<T = string>(path: string, data?: Record<string, string>): Promise<T> {
  const r = await fetch(API_BASE_URL + path, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: data ? new URLSearchParams(data) : undefined,
  });
  const text = await r.text();
  try { return JSON.parse(text) as T; } catch { return text as T; }
}

export async function apiDelete(path: string): Promise<string> {
  const r = await fetch(API_BASE_URL + path, { method: 'DELETE', headers: headers() });
  return r.text();
}

export async function oauthLogin(): Promise<void> {
  const redirectUri = window.location.origin + '/oauth/callback';
  window.location.href = `${API_BASE_URL}/oauth/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export async function oauthExchange(code: string): Promise<{ token: string; qq: string; role: 1 | 2; nickname?: string } | null> {
  const r = await fetch(`${API_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, redirect_uri: window.location.origin + '/oauth/callback' }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const t = data.access_token || data.token;
  if (!t) return null;

  // 获取用户信息
  const meR = await fetch(`${API_BASE_URL}/oauth/me`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!meR.ok) return null;
  const me = await meR.json();

  return {
    token: t,
    qq: String(me.qq || ''),
    role: me.role || 0,
    nickname: me.nickname,
  };
}

export function saveAuth(token: string, user: { qq: string; role: 1 | 2; nickname?: string }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem('admin_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('admin_user');
}

export function getSavedUser(): { qq: string; role: 1 | 2; nickname?: string } | null {
  try {
    const s = localStorage.getItem('admin_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export { API_BASE_URL };

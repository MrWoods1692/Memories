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

/** 发起 OAuth 登录：获取授权 URL 并跳转到 Campux 校园墙 */
export async function oauthLogin(): Promise<void> {
  const frontendOrigin = window.location.origin;
  const r = await fetch(`${API_BASE_URL}/oauth/start?redirect=${encodeURIComponent(frontendOrigin)}`);
  const data = await r.json();
  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error('OAuth 未配置');
  }
}

/** 从 URL 参数解析 OAuth 回调结果 */
export function parseOAuthCallback(): { token: string; qq: string; role: 1 | 2; nickname: string } | null {
  const p = new URLSearchParams(window.location.search);
  const token = p.get('token');
  const qq = p.get('qq');
  const role = parseInt(p.get('role') || '0') as 1 | 2;
  if (token && qq && (role === 1 || role === 2)) {
    return { token, qq, role, nickname: p.get('nickname') || '' };
  }
  return null;
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

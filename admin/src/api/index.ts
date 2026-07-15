declare global {
  interface Window {
    __API_BASE__?: string;
  }
}

const API_BASE = window.__API_BASE__ || 'http://localhost:8080';

async function apiGet<T = unknown>(path: string): Promise<T> {
  const r = await fetch(API_BASE + path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

async function apiPost<T = string>(path: string, data?: Record<string, string>): Promise<T> {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data ? new URLSearchParams(data) : undefined,
  });
  const text = await r.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

async function apiDelete(path: string): Promise<string> {
  const r = await fetch(API_BASE + path, { method: 'DELETE' });
  return r.text();
}

export { API_BASE, apiGet, apiPost, apiDelete };

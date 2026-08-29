import type { AdminBan, AdminUser } from "@/types";
import { BASE, getAccessToken } from "@/api";

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${url}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `请求失败: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** GET /users — 获取审核员与管理员列表（管理员权限） */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return adminFetch<AdminUser[]>("/users");
}

/** POST /users — 添加用户，role 为 1=审核员、2=管理员（管理员权限） */
export async function addAdminUser(qq: string, role: 1 | 2): Promise<unknown> {
  return adminFetch<unknown>("/users", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ qq, role: String(role) }).toString(),
  });
}

/** DELETE /users/{qq} — 移除审核员或管理员（管理员权限） */
export async function removeAdminUser(qq: string): Promise<unknown> {
  return adminFetch<unknown>(`/users/${encodeURIComponent(qq)}`, { method: "DELETE" });
}

/** GET /bans — 获取封禁用户列表（管理员权限） */
export async function fetchAdminBans(): Promise<AdminBan[]> {
  return adminFetch<AdminBan[]>("/bans");
}

/** POST /bans — 封禁用户（管理员权限） */
export async function banAdminUser(qq: string, reason: string): Promise<unknown> {
  return adminFetch<unknown>("/bans", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ qq, reason }).toString(),
  });
}

/** DELETE /bans/{qq} — 解封用户（管理员权限） */
export async function unbanAdminUser(qq: string): Promise<unknown> {
  return adminFetch<unknown>(`/bans/${encodeURIComponent(qq)}`, { method: "DELETE" });
}

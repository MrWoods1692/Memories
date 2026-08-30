import type { AdminBan, AdminUser } from "@/types";
import { BASE, getAccessToken } from "@/api";

/** 读取本地登录用户的 QQ，用于后端 x-user-qq 鉴权（内网请求不依赖该头） */
function getUserInfoQQ(): string {
  try {
    return String(JSON.parse(localStorage.getItem("user_info") || "{}")?.qq || "");
  } catch {
    return "";
  }
}

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // 后端公网通过 x-user-qq 判断角色；Authorization 保留 Bearer 作为管理员 token 的兼容通道
  const qq = getUserInfoQQ();
  if (qq) headers.set("x-user-qq", qq);

  const res = await fetch(`${BASE}${url}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `请求失败: ${res.status}`);
  }
  // 后端写操作（如 DELETE /users/{qq} 返回 "deleted"）是纯文本而非 JSON，
  // 直接 res.json() 会抛 "unexpected character"，这里做 JSON 兜底解析
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
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
  const res = await adminFetch<AdminBan[]>("/bans", {
    headers: { "x-user-qq": String(getUserInfoQQ() || "") },
  });
  return Array.isArray(res) ? res : [];
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

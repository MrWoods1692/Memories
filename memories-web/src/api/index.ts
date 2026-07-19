import type {
  AuthResponse,
  HealthResponse,
  ImageBedInfo,
  OAuthStartResponse,
  PaginatedResponse,
  UploadImageResponse,
} from "@/types";

/** API 基地址：开发/生产均直连后端，避免 Vite 代理干扰 OAuth 重定向流程 */
const BASE = "https://api.mrcwoods.com";

/* ==================== Token 管理 ==================== */

function saveToken(access: string) {
  localStorage.setItem("access_token", access);
}

export function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_info");
}

/* ==================== 通用请求 ==================== */

/** 通用 GET 请求，自动携带 Bearer token */
async function getRequest<T>(url: string): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${url}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `请求失败: ${res.status}`);
  }
  return res.json();
}

/** 通用 POST 请求 (application/x-www-form-urlencoded)，自动携带 Bearer token */
async function postRequest<T>(url: string, body: Record<string, string>): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const params = new URLSearchParams(body);
  const res = await fetch(`${BASE}${url}`, { method: "POST", headers, body: params });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `请求失败: ${res.status}`);
  }
  // 后端部分接口（如 /images/audit）返回纯文本（如 "updated"）而非 JSON，
  // 这里按 Content-Type 判断：仅当响应为 JSON 时才解析，否则返回空对象占位，
  // 避免对非 JSON 响应调用 res.json() 报 "unexpected character" 错误。
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  // 消费掉响应体，避免连接泄漏；调用方不依赖具体返回值
  await res.text();
  return {} as T;
}

/* ==================== 健康检查 ==================== */

/** GET /health → 纯文本 "OK" */
export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error(`服务器异常: ${res.status}`);
  return { status: "ok" };
}

/* ==================== OAuth 认证 ==================== */

/**
 * 发起 OAuth 登录：直接跳转到后端 /oauth/login
 * 后端 302 重定向到 Campux 授权页，授权后 302 回到前端
 */
export function oauthLogin(): void {
  const frontendOrigin = window.location.origin;
  window.location.href = `${BASE}/oauth/login?redirect=${encodeURIComponent(frontendOrigin)}`;
}

/**
 * 从 URL query params 解析 OAuth 回调结果
 * 后端 302 → 前端 ?token=...&qq=...&role=2&nickname=...
 * 返回 null 表示无需处理（无回调参数或有错误）
 */
export function parseOAuthCallback(): AuthResponse | null {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  // 检测错误参数（封禁、拒绝访问等）
  if (error) {
    window.history.replaceState({}, "", window.location.pathname);
    return null;
  }

  const token = params.get("token");
  const qq = params.get("qq");
  const role = params.get("role");
  const nickname = params.get("nickname");

  if (!token || !qq || !role) return null;

  const roleNum = parseInt(role, 10);
  const user: AuthResponse = {
    qq,
    username: nickname || qq,
    role: roleNum,
    access_token: token,
    is_reviewer: roleNum >= 1,
    is_admin: roleNum >= 2,
  };

  saveToken(token);
  localStorage.setItem("user_info", JSON.stringify(user));

  // 清除 URL 中的敏感参数
  window.history.replaceState({}, "", window.location.pathname);

  return user;
}

/** OAuth 错误信息（含是否可重试标志） */
export interface OAuthErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
}

// 错误码到用户友好提示的映射（与后端 redirectWithError 的 errorCode 对应）
const OAUTH_ERROR_MAP: Record<string, { message: string; retryable: boolean }> = {
  banned: { message: "该账号已被封禁，无法登录", retryable: false },
  access_denied: { message: "权限不足，无法访问", retryable: false },
  // frp 隧道瞬断导致 token 交换失败，可重试
  token_exchange_failed: { message: "网络通道（frp）瞬断导致授权失败，请重新登录", retryable: true },
  // code 已被使用或过期（通常是刷新回调页导致），需重新登录
  invalid_grant: { message: "授权码已失效（可能页面被刷新过），请重新登录", retryable: true },
  // state 在服务器端已过期/丢失（浏览器缓存了旧登录链接）
  state_expired: { message: "登录状态已过期，请重新登录", retryable: true },
  missing_code: { message: "授权码缺失（网络代理截断），请重新登录", retryable: true },
  no_access_token: { message: "服务器未返回访问令牌，请重试", retryable: true },
  userinfo_failed: { message: "获取用户信息失败（网络波动），请重新登录", retryable: true },
  network_error: { message: "无法连接到授权服务器，请检查网络后重试", retryable: true },
};

/** 检查 OAuth 回调是否有错误参数，返回结构化错误信息或 null */
export function getOAuthError(): OAuthErrorInfo | null {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  if (!error) return null;

  const errorMsgParam = params.get("error_msg") || "";
  const info = OAUTH_ERROR_MAP[error] || { message: "登录失败: " + error, retryable: true };

  // 清除 URL 中的错误参数，避免刷新后仍显示
  window.history.replaceState({}, "", window.location.pathname);

  return {
    code: error,
    message: errorMsgParam || info.message,
    retryable: info.retryable,
  };
}

/* ==================== 图片 ==================== */

const IMAGES_CACHE_KEY = "images_cache";
const CACHE_TTL = 10 * 60 * 1000; // 10 分钟

interface CacheEntry {
  data: PaginatedResponse;
  timestamp: number;
}

/** GET /images?page=1&limit=20 — 带本地缓存，forceRefresh 可跳过缓存 */
export async function fetchImages(
  page: number,
  limit: number = 20,
  forceRefresh: boolean = false
): Promise<PaginatedResponse> {
  const cacheKey = `${IMAGES_CACHE_KEY}_${page}_${limit}`;

  // 尝试读取缓存（forceRefresh 时跳过）
  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const entry: CacheEntry = JSON.parse(raw);
        if (Date.now() - entry.timestamp < CACHE_TTL) {
          return entry.data;
        }
      }
    } catch { /* ignore */ }
  }

  // 请求新数据
  const data = await getRequest<PaginatedResponse>(`/images?page=${page}&limit=${limit}`);

  // 写入缓存
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* quota exceeded, ignore */ }

  return data;
}

/** 清除图片列表缓存（上传新图片后调用） */
export function clearImagesCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(IMAGES_CACHE_KEY)) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/** POST /images — 上传图片 URL 到服务端 */
export async function uploadImageToServer(
  imageBedUrl: string
): Promise<UploadImageResponse> {
  return postRequest<UploadImageResponse>("/images", { url: imageBedUrl });
}

/* ==================== 图床上传 ==================== */

/** 上传图片到失控图床，默认存储到 Telegram，保持原格式 */
export async function uploadToImageBed(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("storage_destination", "telegram");

  // 根据文件类型设置输出格式：保持原格式，不支持的交给 auto
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const keepFormat = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  if (keepFormat) {
    const fmt = ext === "jpeg" ? "jpg" : ext;
    formData.append("outputFormat", fmt);
  }
  // 其他格式（如 bmp/tiff/视频）不设 outputFormat，服务端 auto 处理

  const res = await fetch("https://img.scdn.io/api/v1.php", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || err.error || "图床上传失败");
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || data.error || "图床上传失败");
  }

  return data.data?.url || data.url || "";
}

/* ==================== 图床查询 ==================== */

/** 从图片 URL 提取文件名（如 https://img.scdn.io/i/xxx.webp → xxx.webp） */
export function extractImageBedFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").pop() || "";
  } catch {
    return url.split("/").pop() || "";
  }
}

/** GET /api/v1.php?q=文件名 → 查询图片元数据 */
export async function queryImageInfo(filename: string): Promise<ImageBedInfo> {
  const params = new URLSearchParams({ q: filename });
  const res = await fetch(`https://img.scdn.io/api/v1.php?${params}`);

  if (!res.ok) {
    if (res.status === 404) throw new Error("该图片在图床中未找到");
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || err.error || "查询失败");
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || data.error || "查询失败");
  }
  return data.data;
}

/* ==================== 图片审核 ==================== */

/** GET /images?status=all — 获取所有图片（含待审核），需要审核员/管理员权限 */
export async function fetchPendingImages(
  page: number,
  limit: number = 20
): Promise<PaginatedResponse> {
  return getRequest<PaginatedResponse>(`/images?status=all&page=${page}&limit=${limit}`);
}

/** POST /images/audit?url=...&status=... — 审核图片：status=1 通过，status=2 拒绝 */
export async function auditImage(
  url: string,
  status: 1 | 2
): Promise<void> {
  await postRequest<unknown>(`/images/audit?url=${encodeURIComponent(url)}&status=${status}`, {});
}

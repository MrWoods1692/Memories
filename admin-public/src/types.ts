export interface AuthUser {
  qq: string;
  role: 1 | 2; // 1=审核员, 2=管理员
  nickname?: string;
}

export interface ImageItem {
  url: string;
  status: 0 | 1 | 2; // 0=待审核, 1=已通过, 2=已拒绝
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserItem {
  id: number;
  qq: string;
  role: 1 | 2;
}

export interface BanItem {
  qq: string;
  reason: string;
  banned_at: string;
}

export interface CoreFreq {
  cur_khz?: number;
  governor?: string;
  max_khz?: number;
  min_khz?: number;
}

export interface ResourceInfo {
  percent: number; // 0-100
  label?: string;
  cores?: number;       // CPU 核心数
  frequencies?: Record<string, CoreFreq>; // 各核心频率
}

export interface MemoryDiskInfo {
  used: number;   // bytes
  total: number;  // bytes
  percent: number; // 0-100
}

export interface ServerStatus {
  image_count: number;
  db_path: string;
  uptime: number;
  request_count?: number;
  today_request_count?: number;
  battery?: ResourceInfo;
  cpu?: ResourceInfo;
  memory?: MemoryDiskInfo;
  disk?: MemoryDiskInfo;
}

export interface ApiRequestLog {
  id: number;
  method: string;
  path: string;
  status_code: number;
  remote_ip?: string;
  user_qq?: string;
  timestamp_ms: number;
  elapsed_ms: number;
}

export interface ApiDailyStat {
  day: string;
  total_requests: number;
  success_count: number;
  error_count: number;
  last_seen_at: number;
}

export interface SiteConfig {
  platform_name?: string;
  platform_logo?: string;
  server_port?: string;
  admin_port?: string;
  auto_cleanup_rejected?: string;
  admin_token?: string;
}
